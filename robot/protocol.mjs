import { mkdir, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { VERSION, validateResult } from './contract.mjs';
import { AttentionError, writePrivateJson } from './config.mjs';
import { MAX_PLATFORM_BODY_BYTES } from '../lib/platform/validation.mjs';

function assertBodySize(payload) {
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PLATFORM_BODY_BYTES) throw new AttentionError('O envio excede o limite de bytes da API. O resultado local deve ser revisado antes do envio.');
}

export class ApiError extends Error {
  constructor(status) {
    super(status ? `O site recusou a operação do robô (HTTP ${status}).` : 'Falha de rede ao comunicar com o site.');
    this.status = status; this.attention = [401, 403, 409, 422].includes(status);
  }
}
export class RobotApi {
  constructor(config, fetchImpl = fetch) { this.config = config; this.fetch = fetchImpl; }
  async post(route, payload, signal) {
    if (!/^\/robot\/[A-Za-z0-9/_-]+$/.test(route)) throw new Error('Rota de robô inválida.');
    assertBodySize(payload);
    const timeout = AbortSignal.timeout(15000);
    let response;
    try {
      response = await this.fetch(`${this.config.siteUrl}/api/platform${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.workerToken}` },
        body: JSON.stringify(payload), redirect: 'error', cache: 'no-store',
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      });
    } catch { throw new ApiError(0); }
    if (!response.ok) throw new ApiError(response.status);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Resposta do site excedeu o limite do robô.');
    try { return JSON.parse(text); } catch { throw new Error('O site devolveu uma resposta inválida.'); }
  }
}
export class Outbox {
  constructor(directory, { maxRejected = 100 } = {}) {
    this.file = path.join(directory, 'outbox.json');
    this.rejectedDirectory = path.join(directory, 'rejected-results');
    this.maxRejected = maxRejected;
  }
  async peek() {
    try { return JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Caixa de envio local ilegível. Preserve o arquivo e execute o diagnóstico.'); }
  }
  async save(item) {
    if (await this.peek()) throw new Error('A caixa de envio ainda contém um resultado pendente.');
    assertBodySize(item.payload);
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await writePrivateJson(this.file, { ...item, deliveryId: randomUUID(), savedAt: new Date().toISOString() });
  }
  async rejectedCount() {
    return (await readdir(this.rejectedDirectory).catch(error => { if (error.code === 'ENOENT') return []; throw error; })).filter(name => name.endsWith('.json')).length;
  }
  async quarantine(item, httpStatus) {
    // Stable identity makes recovery idempotent if the PC stops after archiving but before unlink.
    const identity = createHash('sha256').update(JSON.stringify(item)).digest('hex');
    const archiveFile = path.join(this.rejectedDirectory, `${identity}.json`);
    if (!(await stat(archiveFile).catch(() => null))) {
      if (await this.rejectedCount() >= this.maxRejected) throw new AttentionError('O arquivo local de resultados rejeitados atingiu o limite. Preserve/exporte os arquivos antes de liberar novos envios.');
      await writePrivateJson(archiveFile, { rejectedAt: new Date().toISOString(), httpStatus,
        reason: [404, 409].includes(httpStatus) ? 'O site rejeitou este lease: pesquisa cancelada, inexistente ou retomada por outro lease.' : 'O site rejeitou o tamanho ou conteúdo deste resultado; cópia integral preservada para revisão.', item });
    }
    // Removal is permitted only after the complete original payload is safely present in quarantine.
    await unlink(this.file);
    return { quarantined: true, message: `Resultado de ${item.jobId} rejeitado pelo site (HTTP ${httpStatus}); cópia integral preservada em .robot-data/rejected-results. O robô pode receber novas pesquisas.` };
  }
  async flush(api) {
    const item = await this.peek();
    if (!item) return;
    if (!['result', 'error'].includes(item.kind) || !/^[A-Za-z0-9_-]{1,100}$/.test(item.jobId) || !item.payload?.robotId || !item.payload?.leaseToken) throw new Error('Caixa de envio contém um registro inválido. Preserve o arquivo e execute o diagnóstico.');
    try { await api.post(`/robot/jobs/${encodeURIComponent(item.jobId)}/${item.kind}`, item.payload); }
    catch (error) {
      if ([404, 409, 413, 422].includes(error.status)) return this.quarantine(item, error.status);
      throw error;
    }
    await unlink(this.file);
  }
}
class CancelledError extends Error { constructor() { super('Pesquisa cancelada no painel.'); this.cancelled = true; } }
export class RobotWorker {
  constructor({ config, api, outbox, execute, heartbeatMs = 20000, log = console.log, status = async () => {} }) {
    Object.assign(this, { config, api, outbox, execute, heartbeatMs, log, status });
    this.busy = false;
  }
  async tick(signal) {
    if (this.busy) throw new Error('Uma pesquisa já está em execução neste robô.');
    if (await this.outbox.peek()) {
      await this.status({ state: 'delivering', message: 'Reenviando resultado salvo no computador.' });
      const outcome = await this.outbox.flush(this.api);
      if (outcome?.quarantined) {
        this.log(outcome.message);
        await this.status({ state: 'needs_attention', message: outcome.message });
      } else this.log('Resultado pendente entregue ao site.');
      return this.config.pollSeconds || 15;
    }
    const claimed = await this.api.post('/robot/claim', { robotId: this.config.robotId, version: VERSION }, signal);
    if (!claimed.job) {
      await this.status({ state: 'idle', message: 'Conectado; aguardando pesquisa.' });
      return Math.min(300, Math.max(5, claimed.retryAfterSeconds || this.config.pollSeconds || 15));
    }
    const { job, leaseToken } = claimed;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(job.id) || typeof leaseToken !== 'string' || !leaseToken) throw new Error('O site enviou uma tarefa inválida.');
    this.busy = true;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason || new Error('Robô interrompido no computador.'));
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    let cancelled = false; let lastHeartbeat = Date.now(); let heartbeatInFlight = null;
    const heartbeat = () => {
      if (heartbeatInFlight) return;
      heartbeatInFlight = (async () => {
        try {
          const response = await this.api.post('/robot/heartbeat', { robotId: this.config.robotId, version: VERSION,
            jobId: job.id, leaseToken, message: 'Consultando sites oficiais no navegador local.' });
          lastHeartbeat = Date.now();
          if (response.cancelled) { cancelled = true; controller.abort(new CancelledError()); }
        } catch (error) {
          if ([404, 409].includes(error.status)) { cancelled = true; controller.abort(new CancelledError()); }
          else if (Date.now() - lastHeartbeat >= 90000) controller.abort(new Error('Conexão com o site perdida; pesquisa interrompida para preservar o lease.'));
        } finally { heartbeatInFlight = null; }
      })();
    };
    const timer = setInterval(heartbeat, this.heartbeatMs);
    let delivery;
    try {
      await this.status({ state: 'running', jobId: job.id, message: 'Consultando sites oficiais no navegador local.' });
      this.log(`Pesquisa ${job.id}: iniciando consulta no perfil exclusivo.`);
      const result = validateResult(await this.execute(job, { signal: controller.signal }), job.input);
      delivery = { jobId: job.id, kind: 'result', payload: { robotId: this.config.robotId, leaseToken, result } };
      assertBodySize(delivery.payload);
    } catch (error) {
      if (!cancelled && !error.cancelled) {
        let message = String(error.message || 'Falha inesperada durante a pesquisa.').slice(0, 1000);
        if (this.config.workerToken) message = message.split(this.config.workerToken).join('[protegido]');
        delivery = { jobId: job.id, kind: 'error', payload: { robotId: this.config.robotId, leaseToken, message, attention: Boolean(error.attention) } };
      }
    } finally {
      clearInterval(timer);
      if (heartbeatInFlight) await heartbeatInFlight;
      signal?.removeEventListener('abort', abort);
      this.busy = false;
    }
    if (cancelled) {
      await this.status({ state: 'idle', message: 'Pesquisa cancelada no painel; navegador do robô interrompido.' });
      this.log('Pesquisa cancelada no painel.');
      return this.config.pollSeconds || 15;
    }
    if (delivery) {
      // Disk precedes network. A crash or failed HTTP response replays this exact body and lease.
      await this.outbox.save(delivery);
      await this.status({ state: 'delivering', jobId: job.id, message: 'Enviando resultado ao site.' });
      const outcome = await this.outbox.flush(this.api);
      if (outcome?.quarantined) {
        this.log(outcome.message);
        await this.status({ state: 'needs_attention', message: outcome.message });
        return this.config.pollSeconds || 15;
      }
      this.log(`Pesquisa ${job.id}: ${delivery.kind === 'result' ? 'resultado entregue' : 'pendência registrada'}.`);
      await this.status({ state: delivery.kind === 'error' && delivery.payload.attention ? 'needs_attention' : 'idle',
        message: delivery.kind === 'error' ? delivery.payload.message : 'Resultado entregue; aguardando pesquisa.' });
    }
    return this.config.pollSeconds || 15;
  }
  async run(signal) {
    let previousError = '';
    while (!signal?.aborted) {
      let seconds = this.config.pollSeconds || 15;
      try { seconds = await this.tick(signal); previousError = ''; }
      catch (error) {
        const message = error instanceof ApiError ? error.message : 'Falha no robô; a caixa de envio foi preservada. Consulte o diagnóstico local.';
        if (message !== previousError) this.log(message);
        previousError = message;
        await this.status({ state: error.attention ? 'needs_attention' : 'offline', message });
      }
      try { await delay(seconds * 1000, undefined, { signal }); } catch { break; }
    }
    await this.status({ state: 'stopped', message: 'Robô parado neste computador.' });
  }
}
