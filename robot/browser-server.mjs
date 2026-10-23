import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { officialSource } from './contract.mjs';

export const BROWSER_TOOLS = ['browser_navigate', 'browser_navigate_back', 'browser_snapshot', 'browser_find',
  'browser_click', 'browser_type', 'browser_fill_form', 'browser_select_option', 'browser_press_key',
  'browser_wait_for', 'browser_tabs'];
const official = url => ['latam', 'azul', 'smiles'].some(program => officialSource(url, program));
export function guardTool(name, args = {}) {
  if (!BROWSER_TOOLS.includes(name)) return 'Ferramenta não autorizada. Use somente navegação e leitura da pesquisa.';
  if ((name === 'browser_navigate' || (name === 'browser_tabs' && args.url !== undefined)) && !official(args.url)) return 'Navegação permitida somente por HTTPS nos sites oficiais LATAM, Azul e Smiles/GOL.';
  const description = [args.element, ...(Array.isArray(args.fields) ? args.fields.map(field => field.name) : [])].join(' ');
  if (/\b(pagar|pagamento|payment|pay now|comprar|purchase|reservar|reserve|book now|emitir|checkout|finalizar compra)\b/i.test(description)) return 'Reserva, emissão e pagamento não fazem parte da pesquisa e estão bloqueados.';
  if (name === 'browser_press_key' && !/^(?:Enter|Escape|Tab|Shift\+Tab|ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Home|End|Backspace|Delete|PageDown|PageUp|Control\+a|Meta\+a)$/i.test(args.key || '')) return 'Atalho fora do fluxo de pesquisa bloqueado.';
  return null;
}
export function stampObservation(result) {
  if (!result || result.isError) return result;
  const text = (result.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
  const pageUrl = text.match(/Page URL:\s*(\S+)/i)?.[1];
  if (pageUrl && pageUrl !== 'about:blank' && !official(pageUrl)) return { isError: true, content: [{ type: 'text', text: 'Página redirecionada para domínio fora do escopo oficial; interrompa esta consulta e registre atenção necessária.' }] };
  return { ...result, content: [...(result.content || []), { type: 'text', text: `Milhas Connect observedAt: ${new Date().toISOString()}` }] };
}

// Transparent stdio MCP bridge: the installed Microsoft server drives the browser.
// The bridge removes unsafe tools and provides a real observation time to the researcher.
export async function serveBrowser({ mcpPath, profilePath, artifactsPath }) {
  const child = spawn(process.execPath, [mcpPath, '--browser', 'chrome', '--user-data-dir', profilePath,
    '--output-dir', artifactsPath, '--output-max-size', '20000000', '--no-webmcp', '--codegen', 'none',
    '--console-level', 'error', '--timeout-action', '15000', '--timeout-navigation', '60000'],
  { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  const pending = new Map();
  const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);
  const inbound = createInterface({ input: process.stdin });
  const outbound = createInterface({ input: child.stdout });
  inbound.on('line', line => {
    if (line.length > 1_000_000) return;
    let message; try { message = JSON.parse(line); } catch { return; }
    if (message.method === 'tools/call') {
      const error = guardTool(message.params?.name, message.params?.arguments);
      if (error) { send({ jsonrpc: '2.0', id: message.id, result: { isError: true, content: [{ type: 'text', text: error }] } }); return; }
    }
    if (message.id !== undefined && message.method) pending.set(message.id, message.method);
    if (child.stdin.writable) child.stdin.write(`${line}\n`);
  });
  outbound.on('line', line => {
    if (line.length > 4_000_000) return;
    let message; try { message = JSON.parse(line); } catch { return; }
    const method = pending.get(message.id);
    if (method === 'tools/list' && message.result?.tools) message.result.tools = message.result.tools.filter(tool => BROWSER_TOOLS.includes(tool.name));
    if (method === 'tools/call' && message.result) message.result = stampObservation(message.result);
    if (method) pending.delete(message.id);
    send(message);
  });
  child.on('error', () => { process.stderr.write('Não foi possível iniciar o servidor de navegador.\n'); process.exitCode = 1; inbound.close(); });
  child.on('close', code => { process.exitCode = code || 0; inbound.close(); process.stdin.destroy(); });
  inbound.on('close', () => {
    child.stdin.end();
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.pid) {
        if (process.platform === 'win32') spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' });
        else child.kill('SIGTERM');
      }
    }, 1500);
    timer.unref();
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mcpPath, profilePath, artifactsPath] = process.argv.slice(2);
  if (!mcpPath || !profilePath || !artifactsPath) { process.stderr.write('Configuração interna do navegador incompleta.\n'); process.exitCode = 1; }
  else await serveBrowser({ mcpPath, profilePath, artifactsPath });
}
