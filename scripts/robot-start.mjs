import path from 'node:path';
import { appendFile, rename, stat } from 'node:fs/promises';
import { DATA_DIR, acquireLock, loadConfig, protectDataDirectory, writePrivateJson } from '../robot/config.mjs';
import { createExecutor } from '../robot/executor.mjs';
import { Outbox, RobotApi, RobotWorker } from '../robot/protocol.mjs';
import { VERSION } from '../robot/contract.mjs';

const controller = new AbortController();
const stop = () => { if (!controller.signal.aborted) { console.log('\nEncerrando o robô e o navegador que ele iniciou…'); controller.abort(new Error('Robô interrompido no computador.')); } };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
let release; let logs = Promise.resolve();
try {
  const protectedDirectory = await protectDataDirectory();
  const config = await loadConfig();
  release = await acquireLock();
  const startedAt = new Date().toISOString();
  const status = async update => writePrivateJson(path.join(DATA_DIR, 'status.json'), {
    version: VERSION, robotId: config.robotId, siteUrl: config.siteUrl, pid: process.pid, startedAt,
    updatedAt: new Date().toISOString(), ...update,
  });
  const log = message => {
    const safe = String(message).split(config.workerToken).join('[protegido]').replace(/[\r\n]/g, ' ').slice(0, 1500);
    const line = `${new Date().toISOString()} ${safe}`;
    console.log(line);
    logs = logs.then(async () => {
      const file = path.join(DATA_DIR, 'worker.log');
      if ((await stat(file).catch(() => ({ size: 0 }))).size > 256000) await rename(file, `${file}.old`).catch(() => {});
      await appendFile(file, `${line}\n`, { mode: 0o600 });
    }).catch(() => {});
  };
  if (!protectedDirectory) log('Não foi possível aplicar ACL exclusiva no diretório local; confira as permissões do Windows.');
  log(`Milhas Connect ${VERSION} — ${config.robotId}. Computador deve permanecer ligado e com internet.`);
  log('Aguardando pesquisas do site. Ctrl+C encerra este robô. Login/CAPTCHA é feito diretamente no Chrome exclusivo.');
  const worker = new RobotWorker({ config, api: new RobotApi(config), outbox: new Outbox(DATA_DIR),
    execute: createExecutor(config), log, status });
  if (process.argv.includes('--once')) await worker.tick(controller.signal);
  else await worker.run(controller.signal);
} catch (error) {
  const message = error.attention ? error.message : 'Falha ao iniciar o robô. Execute node scripts/robot-status.mjs.';
  console.error(message);
  await writePrivateJson(path.join(DATA_DIR, 'status.json'), { state: 'needs_attention', message, pid: process.pid, updatedAt: new Date().toISOString() }).catch(() => {});
  process.exitCode = 1;
} finally {
  await logs;
  await release?.();
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
}
