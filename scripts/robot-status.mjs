import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_PATH, DATA_DIR, checkPrerequisites, loadConfig } from '../robot/config.mjs';
import { RobotApi, Outbox } from '../robot/protocol.mjs';
import { VERSION } from '../robot/contract.mjs';

try {
  const config = await loadConfig();
  console.log(`Milhas Connect ${VERSION} | computador ${config.robotId}`);
  console.log(`Site: ${config.siteUrl}`);
  const status = await readFile(path.join(DATA_DIR, 'status.json'), 'utf8').then(JSON.parse).catch(() => null);
  let active = false;
  const lock = await readFile(path.join(DATA_DIR, 'worker.lock'), 'utf8').then(JSON.parse).catch(() => null);
  if (lock?.pid) { try { process.kill(lock.pid, 0); active = true; } catch {} }
  console.log(`Processo local: ${active ? 'em execução' : 'parado'}`);
  if (status) console.log(`Último estado: ${status.state} | ${status.message || ''} | ${status.updatedAt}`);
  const outbox = new Outbox(DATA_DIR);
  console.log(`Caixa de envio: ${await outbox.peek() ? 'resultado pendente; será reenviado antes da próxima pesquisa' : 'vazia'}`);
  const rejected = await outbox.rejectedCount();
  if (rejected) console.log(`Atenção: ${rejected} resultado(s) com lease rejeitado preservado(s) em .robot-data/rejected-results. A fila pode continuar; revise os arquivos localmente.`);
  const prerequisites = await checkPrerequisites(config);
  console.log('Requisitos: Node, Codex autenticado, shell desativável, Playwright MCP e Chrome encontrados.');
  console.log(`Codex: ${prerequisites.codexPath}`);
  if (process.argv.includes('--check')) {
    if (active) console.log('Conexão: há um processo ativo; use o estado do painel para acompanhar sua conexão.');
    else {
      await new RobotApi(config).post('/robot/heartbeat', { robotId: config.robotId, version: VERSION, message: 'Diagnóstico local de conexão.' });
      console.log('Conexão com o site: confirmada.');
    }
  }
} catch (error) {
  console.error(error.attention ? error.message : 'Diagnóstico encontrou uma falha. Confira conexão, configuração local e dependências.');
  console.error(`Configuração local: ${CONFIG_PATH}`);
  process.exitCode = 1;
}
