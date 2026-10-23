import { access, chmod, mkdir, readFile, rename, writeFile, open, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, '.robot-data');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
export class AttentionError extends Error {
  constructor(message) { super(message); this.name = 'AttentionError'; this.attention = true; }
}
export function validateConfig(value) {
  if (!value || typeof value !== 'object') throw new AttentionError('Configuração ausente. Execute a configuração do robô.');
  let url; try { url = new URL(value.siteUrl); } catch { throw new AttentionError('Endereço do site inválido.'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new AttentionError('Use a origem HTTPS do site, sem credenciais nem caminho.');
  if (typeof value.workerToken !== 'string' || !/^[\x21-\x7e]{6,512}$/.test(value.workerToken)) throw new AttentionError('Token do robô ausente ou inválido.');
  if (typeof value.robotId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.robotId)) throw new AttentionError('Identificador do robô inválido.');
  const pollSeconds = value.pollSeconds ?? 15; const jobTimeoutMinutes = value.jobTimeoutMinutes ?? 30;
  if (!Number.isInteger(pollSeconds) || pollSeconds < 5 || pollSeconds > 300) throw new AttentionError('Intervalo de consulta deve estar entre 5 e 300 segundos.');
  if (!Number.isInteger(jobTimeoutMinutes) || jobTimeoutMinutes < 1 || jobTimeoutMinutes > 120) throw new AttentionError('Limite da pesquisa deve estar entre 1 e 120 minutos.');
  if (value.codexPath !== undefined && (typeof value.codexPath !== 'string' || !path.isAbsolute(value.codexPath))) throw new AttentionError('codexPath deve ser um caminho absoluto.');
  return { siteUrl: url.origin, workerToken: value.workerToken, robotId: value.robotId, pollSeconds, jobTimeoutMinutes,
    ...(value.codexPath ? { codexPath: value.codexPath } : {}) };
}
export async function loadConfig(file = CONFIG_PATH) {
  let contents;
  try { contents = await readFile(file, 'utf8'); } catch { throw new AttentionError('Configuração não encontrada. Execute node scripts/robot-setup.mjs.'); }
  let config; try { config = JSON.parse(contents); } catch { throw new AttentionError('O arquivo local de configuração não contém JSON válido.'); }
  return validateConfig(config);
}
export async function writePrivateJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600).catch(() => {});
  await rename(temporary, file);
}
export async function runSmall(command, args, { timeoutMs = 15000, env = process.env, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env, cwd });
    let output = ''; let overflow = false;
    const append = data => { if (output.length < 64000) output += data.toString(); else overflow = true; };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, output: overflow ? output.slice(0, 64000) : output }); });
  });
}
export async function protectDataDirectory(directory = DATA_DIR) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {});
  if (process.platform !== 'win32') return true;
  try {
    const identity = await runSmall('whoami.exe', ['/user', '/fo', 'csv', '/nh']);
    const sid = identity.output.match(/S-1-\d+(?:-\d+)+/)?.[0];
    if (!sid) return false;
    const acl = await runSmall('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`]);
    return acl.code === 0;
  } catch { return false; }
}
export async function discoverCodex(config = {}) {
  if (config.codexPath) {
    try { await access(config.codexPath); return config.codexPath; } catch { throw new AttentionError('Codex não encontrado no codexPath configurado.'); }
  }
  try {
    const found = await runSmall(process.platform === 'win32' ? 'where.exe' : 'which', ['codex']);
    for (const candidate of found.output.split(/\r?\n/).filter(Boolean)) {
      if (process.platform === 'win32' && !candidate.toLowerCase().endsWith('.exe')) continue;
      try { await access(candidate); return candidate; } catch {}
    }
  } catch {}
  if (process.platform === 'win32') {
    const { readdir } = await import('node:fs/promises');
    const base = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
    for (const entry of (await readdir(base).catch(() => [])).reverse()) {
      const candidate = path.join(base, entry, 'codex.exe');
      try { await access(candidate); return candidate; } catch {}
    }
  }
  throw new AttentionError('Instale ou abra o Codex e entre na sua conta; depois execute o diagnóstico.');
}
export async function checkPrerequisites(config) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new AttentionError('Atualize o Node.js para a versão 22 ou superior.');
  const codexPath = await discoverCodex(config);
  const mcpPath = path.join(ROOT, 'node_modules', '@playwright', 'mcp', 'cli.js');
  try { await access(mcpPath); } catch { throw new AttentionError('Dependência Playwright MCP ausente. Execute npm install nesta pasta.'); }
  const help = await runSmall(codexPath, ['exec', '--help']);
  if (help.code !== 0 || !['--ignore-user-config', '--output-schema', '--ephemeral'].every(flag => help.output.includes(flag))) throw new AttentionError('Atualize o Codex CLI: faltam opções necessárias para execução isolada.');
  const features = await runSmall(codexPath, ['features', 'list']);
  if (features.code !== 0 || !/^shell_tool\s/m.test(features.output)) throw new AttentionError('Esta versão do Codex não permite desativar o shell. Atualize o aplicativo.');
  const login = await runSmall(codexPath, ['login', 'status']);
  if (login.code !== 0 || !/logged in/i.test(login.output)) throw new AttentionError('Abra o Codex e entre com sua conta ChatGPT. O robô não solicita sua senha.');
  const { chromium } = await import('playwright');
  const chrome = chromium.executablePath('chrome');
  // Chrome channel is system installed; executablePath() otherwise returns bundled Chromium.
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ] : [chrome, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'];
  if (!(await Promise.all(candidates.map(candidate => access(candidate).then(() => true, () => false)))).some(Boolean)) throw new AttentionError('Google Chrome não foi encontrado. Instale o Chrome para usar o perfil exclusivo do robô.');
  return { codexPath, mcpPath, nodePath: process.execPath };
}
export async function acquireLock(directory = DATA_DIR) {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'worker.lock');
  try {
    const handle = await open(file, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), host: os.hostname() }));
    await handle.close();
    return async () => { await unlink(file).catch(() => {}); };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let active = true;
    try { const lock = JSON.parse(await readFile(file, 'utf8')); process.kill(lock.pid, 0); }
    catch (error) { if (error.code === 'ESRCH') active = false; }
    if (active) throw new AttentionError('Já existe um robô ou navegador de configuração nesta pasta. Feche-o antes de iniciar outro.');
    await unlink(file); return acquireLock(directory);
  }
}
