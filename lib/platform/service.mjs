import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { coverageSummary, estimateCost, HttpError, normalizeMilePrices, normalizeResult, normalizeSearch, resultStatus, todayInBrazil } from './validation.mjs';

const LEASE_MS = 120_000;
const TERMINAL = new Set(['completed', 'partial', 'attention_required', 'failed', 'cancelled']);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const iso = (now) => new Date(now).toISOString();

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError('Corpo da solicitação inválido.');
  return value;
}
function text(value, label, maximum = 80, optional = false) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\x00-\x1f\x7f]/.test(value)) throw new HttpError(`${label} inválido.`);
  return value.trim();
}
function worker(raw) {
  object(raw);
  const robotId = text(raw.robotId, 'Identificador do robô');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(robotId)) throw new HttpError('Identificador do robô inválido.');
  return { robotId, version: text(raw.version, 'Versão do robô', 50, true) };
}
function findJob(state, id) {
  const job = state.jobs.find((item) => item.id === id);
  if (!job) throw new HttpError('Pesquisa não encontrada.', 404);
  return job;
}
function publicJob(job) {
  return structuredClone(Object.fromEntries(Object.entries(job).filter(([key]) => !key.startsWith('_'))));
}
function publicMonitor(monitor) {
  return structuredClone(Object.fromEntries(Object.entries(monitor).filter(([key]) => !key.startsWith('_'))));
}
function makeJob(input, now, id, monitorId = null) {
  return { id, input, status: 'queued', createdAt: iso(now), updatedAt: iso(now), startedAt: null, finishedAt: null, message: 'Pesquisa aguardando o robô.', attempts: 0, result: null, monitorId };
}
function clearLease(job) {
  delete job._leaseHash;
  delete job._leaseWorkerId;
  delete job._leaseUntil;
  delete job._resultDigest;
}
function matchingLease(job, robotId, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) || job._leaseWorkerId !== robotId || !/^[a-f0-9]{64}$/.test(job._leaseHash || '')) return false;
  return timingSafeEqual(Buffer.from(job._leaseHash, 'hex'), Buffer.from(digest(token), 'hex'));
}
function requireLease(job, robotId, token, now) {
  if (job.status !== 'running' || !matchingLease(job, robotId, token) || !(job._leaseUntil > now)) throw new HttpError('A reserva desta pesquisa expirou ou pertence a outro robô.', 409);
}
function updateRobot(state, robotId, version, now, currentJobId) {
  state.robot = { id: robotId, lastSeenAt: iso(now), version: version ?? (state.robot.id === robotId ? state.robot.version : null), currentJobId };
}
function clearRobotJob(state, jobId) {
  if (state.robot.currentJobId === jobId) state.robot.currentJobId = null;
}
function addNotification(state, notification) {
  while (state.notifications.length >= 200) {
    const index = state.notifications.findIndex((item) => item.read);
    state.notifications.splice(index < 0 ? 0 : index, 1);
  }
  state.notifications.push(notification);
}

export function createPlatformService(store, { clock = Date.now } = {}) {
  return {
    async dashboard() {
      const state = await store.read();
      const now = clock();
      return {
        jobs: state.jobs.slice(-100).reverse().map((job) => {
          const coverage = coverageSummary(job.result, job.input);
          return { ...publicJob(job), result: null, resultAvailable: Boolean(job.result), offerCount: job.result?.offers.length ?? 0, coverageCompleted: coverage.completed, coverageExpected: coverage.expected };
        }),
        settings: structuredClone(state.settings),
        robot: { ...structuredClone(state.robot), online: state.robot.lastSeenAt !== null && now - Date.parse(state.robot.lastSeenAt) >= 0 && now - Date.parse(state.robot.lastSeenAt) < LEASE_MS },
        monitors: state.monitors.map(publicMonitor),
        notifications: structuredClone(state.notifications),
        now: iso(now), storage: store.mode,
      };
    },

    async getJob(id) {
      return publicJob(findJob(await store.read(), id));
    },

    async createJob(raw, idempotencyKey) {
      if (typeof idempotencyKey !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(idempotencyKey)) throw new HttpError('Informe uma chave de idempotência UUID válida.');
      const now = clock();
      const id = randomUUID();
      const key = idempotencyKey.toLowerCase();
      return store.transact((state) => {
        const input = normalizeSearch(raw, state.settings.milePrices, todayInBrazil(now));
        const fingerprint = digest(JSON.stringify({ ...input, milePrices: undefined }));
        const previous = state.idempotency[key];
        if (previous) {
          if (previous.digest !== fingerprint) throw new HttpError('Esta chave já foi usada para outra pesquisa.', 409);
          return publicJob(findJob(state, previous.jobId));
        }
        if (state.jobs.length >= 500) throw new HttpError('O histórico atingiu o limite de 500 pesquisas.', 409);
        const job = makeJob(input, now, id);
        state.jobs.push(job);
        state.idempotency[key] = { jobId: id, digest: fingerprint };
        return publicJob(job);
      });
    },

    async cancelJob(id) {
      const now = clock();
      return store.transact((state) => {
        const job = findJob(state, id);
        if (job.status === 'cancelled') return publicJob(job);
        if (TERMINAL.has(job.status)) throw new HttpError('Esta pesquisa já foi finalizada.', 409);
        job.status = 'cancelled'; job.updatedAt = iso(now); job.finishedAt = iso(now); job.message = 'Pesquisa cancelada pelo proprietário.';
        clearRobotJob(state, id);
        return publicJob(job);
      });
    },

    async retryJob(id) {
      const now = clock();
      return store.transact((state) => {
        const job = findJob(state, id);
        if (!TERMINAL.has(job.status)) throw new HttpError('Somente pesquisas finalizadas podem ser repetidas.', 409);
        normalizeSearch(job.input, job.input.milePrices, todayInBrazil(now));
        clearLease(job);
        job.status = 'queued'; job.result = null; job.attempts = 0; job.startedAt = null; job.finishedAt = null; job.updatedAt = iso(now); job.message = 'Pesquisa aguardando nova tentativa.';
        delete job._notified;
        clearRobotJob(state, id);
        return publicJob(job);
      });
    },

    async updateSettings(raw) {
      const prices = normalizeMilePrices(object(raw).milePrices);
      return store.transact((state) => {
        state.settings.milePrices = prices;
        return structuredClone(state.settings);
      });
    },

    async createMonitor(raw) {
      object(raw);
      const jobId = text(raw.jobId, 'Identificador da pesquisa', 100);
      if (typeof raw.targetCost !== 'number' || !Number.isFinite(raw.targetCost) || raw.targetCost <= 0 || raw.targetCost > 1e9) throw new HttpError('Custo alvo inválido.');
      if (!Number.isSafeInteger(raw.intervalHours) || raw.intervalHours < 1 || raw.intervalHours > 168) throw new HttpError('O intervalo deve ser de 1 a 168 horas.');
      const now = clock(); const id = randomUUID();
      return store.transact((state) => {
        const job = findJob(state, jobId);
        normalizeSearch(job.input, state.settings.milePrices, todayInBrazil(now));
        let monitor = state.monitors.find((item) => item._sourceJobId === jobId || item.lastJobId === jobId);
        if (!monitor && state.monitors.length >= 20) throw new HttpError('O limite é de 20 monitores.', 409);
        if (!monitor) {
          monitor = { id, input: structuredClone(job.input), _sourceJobId: jobId, lastJobId: jobId };
          state.monitors.push(monitor);
        }
        Object.assign(monitor, { enabled: true, targetCost: raw.targetCost, intervalHours: raw.intervalHours, nextRunAt: iso(now + raw.intervalHours * 3_600_000) });
        if (job.monitorId === null) job.monitorId = monitor.id;
        return publicMonitor(monitor);
      });
    },

    async updateMonitor(id, raw) {
      if (typeof object(raw).enabled !== 'boolean') throw new HttpError('Estado do monitor inválido.');
      const now = clock();
      return store.transact((state) => {
        const monitor = state.monitors.find((item) => item.id === id);
        if (!monitor) throw new HttpError('Monitor não encontrado.', 404);
        if (raw.enabled) normalizeSearch(monitor.input, state.settings.milePrices, todayInBrazil(now));
        monitor.enabled = raw.enabled;
        if (raw.enabled) monitor.nextRunAt = iso(now + monitor.intervalHours * 3_600_000);
        return publicMonitor(monitor);
      });
    },

    async readNotifications() {
      return store.transact((state) => {
        for (const notification of state.notifications) notification.read = true;
        return { ok: true };
      });
    },

    async claim(raw) {
      const { robotId, version } = worker(raw);
      const now = clock(); const leaseToken = randomBytes(32).toString('base64url');
      // Stable identifiers across a Postgres compare-and-swap retry.
      const ids = Array.from({ length: 40 }, () => randomUUID());
      return store.transact((state) => {
        let index = 0;
        for (const job of state.jobs) {
          if (job.status !== 'running' || job._leaseUntil > now) continue;
          clearRobotJob(state, job.id);
          clearLease(job);
          job.updatedAt = iso(now);
          if (job.attempts >= 3) {
            job.status = 'failed'; job.finishedAt = iso(now); job.message = 'O robô perdeu a conexão após três tentativas.';
          } else {
            job.status = 'queued'; job.message = 'Conexão interrompida. Aguardando nova tentativa.';
          }
        }
        for (const monitor of state.monitors) {
          if (!monitor.enabled || Date.parse(monitor.nextRunAt) > now) continue;
          monitor.nextRunAt = iso(now + monitor.intervalHours * 3_600_000);
          let input;
          try { input = normalizeSearch(monitor.input, state.settings.milePrices, todayInBrazil(now)); } catch (error) {
            if (!(error instanceof HttpError)) throw error;
            monitor.enabled = false;
            addNotification(state, { id: ids[index++], jobId: monitor.lastJobId, message: 'Monitor desativado: as datas da viagem expiraram.', createdAt: iso(now), read: false });
            continue;
          }
          const lastJob = state.jobs.find((job) => job.id === monitor.lastJobId);
          if (lastJob && ['queued', 'running'].includes(lastJob.status)) continue;
          if (state.jobs.length >= 500) continue;
          const job = makeJob(input, now, ids[index++], monitor.id);
          state.jobs.push(job); monitor.lastJobId = job.id;
        }
        const active = state.jobs.find((job) => job.status === 'running' && job._leaseWorkerId === robotId && job._leaseUntil > now);
        if (active) {
          updateRobot(state, robotId, version, now, active.id);
          return { job: null, retryAfterSeconds: 15 };
        }
        const job = state.jobs.find((item) => item.status === 'queued');
        updateRobot(state, robotId, version, now, job?.id ?? null);
        if (!job) return { job: null, retryAfterSeconds: 15 };
        job.status = 'running'; job.attempts += 1; job.startedAt = iso(now); job.finishedAt = null; job.updatedAt = iso(now); job.message = 'O robô iniciou a pesquisa.';
        job._leaseHash = digest(leaseToken); job._leaseWorkerId = robotId; job._leaseUntil = now + LEASE_MS;
        return { job: publicJob(job), leaseToken, retryAfterSeconds: 15 };
      });
    },

    async heartbeat(raw) {
      const { robotId, version } = worker(raw);
      const now = clock();
      const message = text(raw.message, 'Mensagem', 1500, true);
      const jobId = text(raw.jobId, 'Identificador da pesquisa', 100, true);
      return store.transact((state) => {
        if (!jobId) {
          const active = state.jobs.find((job) => job.status === 'running' && job._leaseWorkerId === robotId && job._leaseUntil > now);
          updateRobot(state, robotId, version, now, active?.id ?? null);
          return { ok: true, cancelled: false };
        }
        const job = findJob(state, jobId);
        if (job.status === 'cancelled' && matchingLease(job, robotId, raw.leaseToken)) {
          updateRobot(state, robotId, version, now, null);
          return { ok: true, cancelled: true };
        }
        requireLease(job, robotId, raw.leaseToken, now);
        job._leaseUntil = now + LEASE_MS; job.updatedAt = iso(now);
        if (message !== null) job.message = message;
        updateRobot(state, robotId, version, now, job.id);
        return { ok: true, cancelled: false };
      });
    },

    async completeJob(id, raw) {
      const { robotId } = worker(raw);
      const now = clock(); const notificationId = randomUUID();
      return store.transact((state) => {
        const job = findJob(state, id);
        if (!matchingLease(job, robotId, raw.leaseToken) || job.status === 'cancelled') throw new HttpError('Reserva da pesquisa inválida.', 409);
        const result = normalizeResult(raw.result, job.input);
        const resultDigest = digest(JSON.stringify({ kind: 'result', result }));
        if (job._resultDigest) {
          if (job._resultDigest !== resultDigest) throw new HttpError('Esta pesquisa já recebeu outro resultado.', 409);
          return publicJob(job);
        }
        requireLease(job, robotId, raw.leaseToken, now);
        job.result = result; job.status = resultStatus(result, job.input); job.finishedAt = iso(now); job.updatedAt = iso(now); job.message = result.summary || 'Pesquisa finalizada.'; job._resultDigest = resultDigest;
        clearRobotJob(state, id);
        if (state.robot.id === robotId) state.robot.lastSeenAt = iso(now);
        const monitor = state.monitors.find((item) => item.id === job.monitorId);
        const matchingOffer = monitor?.enabled && result.offers.find((offer) => {
          const cost = estimateCost(offer, job.input.milePrices);
          return offer.checkedAt !== null && cost !== null && cost <= monitor.targetCost;
        });
        if (matchingOffer && !job._notified) {
          addNotification(state, { id: notificationId, jobId: job.id, message: `Oferta encontrada dentro do alvo: R$ ${estimateCost(matchingOffer, job.input.milePrices).toFixed(2)}.`, createdAt: iso(now), read: false });
          job._notified = true;
        }
        return publicJob(job);
      });
    },

    async failJob(id, raw) {
      const { robotId } = worker(raw);
      const message = text(raw.message, 'Mensagem de erro', 3000);
      if (raw.attention !== undefined && typeof raw.attention !== 'boolean') throw new HttpError('Indicador de intervenção inválido.');
      const now = clock(); const resultDigest = digest(JSON.stringify({ kind: 'error', message, attention: raw.attention === true }));
      return store.transact((state) => {
        const job = findJob(state, id);
        if (!matchingLease(job, robotId, raw.leaseToken) || job.status === 'cancelled') throw new HttpError('Reserva da pesquisa inválida.', 409);
        if (job._resultDigest) {
          if (job._resultDigest !== resultDigest) throw new HttpError('Esta pesquisa já foi finalizada com outro resultado.', 409);
          return publicJob(job);
        }
        requireLease(job, robotId, raw.leaseToken, now);
        job.status = raw.attention ? 'attention_required' : 'failed'; job.result = null; job.message = message; job.updatedAt = iso(now); job.finishedAt = iso(now); job._resultDigest = resultDigest;
        clearRobotJob(state, id);
        if (state.robot.id === robotId) state.robot.lastSeenAt = iso(now);
        return publicJob(job);
      });
    },
  };
}
