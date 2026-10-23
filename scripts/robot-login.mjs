import path from 'node:path';
import { DATA_DIR, acquireLock, checkPrerequisites, loadConfig, protectDataDirectory } from '../robot/config.mjs';
import { PROGRAMS } from '../robot/contract.mjs';

let release; let context;
try {
  await protectDataDirectory();
  const config = await loadConfig(); await checkPrerequisites(config);
  release = await acquireLock();
  const requested = process.argv.slice(2);
  const selected = requested.length ? requested : Object.keys(PROGRAMS);
  if (selected.some(program => !Object.hasOwn(PROGRAMS, program))) throw new Error('Programa inválido.');
  const { chromium } = await import('playwright');
  context = await chromium.launchPersistentContext(path.join(DATA_DIR, 'chrome-profile'), { channel: 'chrome', headless: false });
  console.log('Entre nas companhias diretamente neste Chrome exclusivo. Não envie senhas ou códigos pelo chat.');
  console.log('Resolva CAPTCHA/2FA manualmente. Feche esta janela do navegador quando terminar; depois inicie o robô novamente.');
  const closed = new Promise(resolve => context.once('close', resolve));
  for (const program of selected) {
    const page = await context.newPage();
    await page.goto(PROGRAMS[program].url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  }
  await closed;
} catch (error) {
  console.error(error.attention ? error.message : 'Não foi possível abrir o perfil exclusivo. Feche o robô e tente novamente: node scripts/robot-login.mjs [latam azul smiles]');
  process.exitCode = 1;
} finally { await context?.close().catch(() => {}); await release?.(); }
