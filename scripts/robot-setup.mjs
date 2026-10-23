import { createInterface } from 'node:readline/promises';
import { hostname } from 'node:os';
import { CONFIG_PATH, loadConfig, protectDataDirectory, validateConfig, writePrivateJson } from '../robot/config.mjs';

async function hiddenToken(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Para configuração automatizada, envie JSON por stdin usando --stdin.');
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = ''; process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const onData = data => {
      for (const character of data) {
        if (character === '\u0003') { cleanup(); reject(new Error('Configuração cancelada.')); return; }
        if (character === '\r' || character === '\n') { cleanup(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (/^[\x21-\x7e]$/.test(character) && value.length < 512) value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}
try {
  let config;
  if (process.argv.includes('--stdin')) {
    let raw = ''; for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 16000) throw new Error('Configuração muito longa.'); }
    config = validateConfig(JSON.parse(raw));
  } else {
    const existing = await loadConfig().catch(() => null);
    console.log('Configuração local do Milhas Connect. Os segredos ficam somente em .robot-data/config.json.');
    const questions = createInterface({ input: process.stdin, output: process.stdout });
    const siteUrl = (await questions.question(`Endereço HTTPS do seu site${existing ? ` [${existing.siteUrl}]` : ''}: `)).trim() || existing?.siteUrl;
    const suggestedId = existing?.robotId || hostname().replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 70);
    const robotId = (await questions.question(`Nome deste computador [${suggestedId}]: `)).trim() || suggestedId;
    questions.close();
    const workerToken = await hiddenToken(`Token do robô (oculto${existing ? '; Enter mantém o atual' : ''}): `) || existing?.workerToken;
    config = validateConfig({ ...(existing || {}), siteUrl, workerToken, robotId });
  }
  const protectedDirectory = await protectDataDirectory();
  await writePrivateJson(CONFIG_PATH, config);
  console.log('Configuração salva. Execute node scripts/robot-status.mjs --check para conferir os requisitos e a conexão.');
  if (!protectedDirectory) console.log('O Windows não confirmou a ACL exclusiva; confira as permissões da pasta .robot-data.');
  console.log('Depois inicie com Iniciar Milhas Connect.cmd. Para login humano nas companhias: node scripts/robot-login.mjs.');
} catch (error) {
  console.error(error.attention ? error.message : 'Configuração não foi salva. Confira o endereço, token e identificador e tente novamente.');
  process.exitCode = 1;
}
