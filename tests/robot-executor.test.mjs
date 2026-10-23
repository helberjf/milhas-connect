import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createExecutor, runOwnedProcess, stopOwnedProcessTree } from '../robot/executor.mjs';
import { ROOT } from '../robot/config.mjs';

const simpleInvocation = args => ({ command: process.execPath, args, env: process.env,
  options: { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] } });
const input = { origin: 'GRU', destination: 'GIG', alternatives: [], departure: '2026-12-10',
  returnDate: null, tripType: 'oneway', adults: 2, cabin: 'economy', baggage: 'carry_on', flexDays: 0,
  programs: ['latam'], milePrices: { latam: 25, azul: 18, smiles: 17 }, notes: '' };

test('owned child is stopped on timeout without requiring a browser or shell', async () => {
  const start = Date.now();
  await assert.rejects(runOwnedProcess(simpleInvocation(['-e', 'setInterval(() => {}, 1000)']), '',
    { timeoutMs: 300 }), error => error.attention && /Tempo limite/.test(error.message));
  assert.ok(Date.now() - start < 10000);
});

test('owned child responds to cancellation and enforces bounded output', async () => {
  const controller = new AbortController();
  const reason = new Error('controlled cancellation');
  const timer = setTimeout(() => controller.abort(reason), 300);
  await assert.rejects(runOwnedProcess(simpleInvocation(['-e', 'setInterval(() => {}, 1000)']), '',
    { signal: controller.signal, timeoutMs: 10000 }), error => error === reason);
  clearTimeout(timer);
  await assert.rejects(runOwnedProcess(simpleInvocation(['-e', 'process.stdout.write("x".repeat(100000)); setInterval(() => {}, 1000)']), '',
    { maxOutputBytes: 1024, timeoutMs: 10000 }), /excedeu o limite local/);
});

test('executor runs a real controlled child, reads strict result and removes its temporary workspace', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milhas-robot-executor-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fixture = path.join(directory, 'researcher-fixture.mjs');
  await writeFile(fixture, `import {writeFile} from 'node:fs/promises';
    let prompt=''; for await (const part of process.stdin) prompt+=part;
    if(!prompt.includes('TODOS os 2 passageiros')) process.exit(3);
    await writeFile(process.argv[2], JSON.stringify({summary:'Fixture local sem tarifas',offers:[],coverage:[],attention:[]}));`);
  let workspace;
  const execute = createExecutor({ jobTimeoutMinutes: 1 }, { directory,
    prerequisites: async () => ({ codexPath: process.execPath, nodePath: process.execPath, mcpPath: fixture }),
    processRunner: async (invocation, prompt, options) => {
      workspace = invocation.options.cwd;
      assert.deepEqual(await readdir(workspace), []);
      const outputPath = invocation.args[invocation.args.indexOf('--output-last-message') + 1];
      return runOwnedProcess({ ...invocation, command: process.execPath, args: [fixture, outputPath] }, prompt, options);
    },
  });
  const result = await execute({ id: 'fixture-job', input });
  assert.deepEqual(result, { summary: 'Fixture local sem tarifas', offers: [], coverage: [], attention: [] });
  await assert.rejects(readdir(workspace), { code: 'ENOENT' });
  const runs = await readdir(path.join(directory, 'runs'));
  const metadata = JSON.parse(await readFile(path.join(directory, 'runs', runs[0], 'run.json'), 'utf8'));
  assert.equal(metadata.jobId, 'fixture-job');
  assert.equal(metadata.offers, 0);
});

test('real stdio bridge filters MCP tools and stamps fixture observations without launching Chrome', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milhas-robot-mcp-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fixture = path.join(directory, 'mcp-fixture.mjs');
  await writeFile(fixture, `import {createInterface} from 'node:readline';
    const rl=createInterface({input:process.stdin});
    rl.on('line',line=>{const m=JSON.parse(line); if(m.id===undefined)return;
      let result={};
      if(m.method==='tools/list')result={tools:[{name:'browser_snapshot'},{name:'browser_evaluate'}]};
      if(m.method==='tools/call')result={content:[{type:'text',text:'- Page URL: https://www.latamairlines.com/br/pt\\nFixture sem tarifas'}]};
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');
    });`);
  const child = spawn(process.execPath, [path.join(ROOT, 'robot', 'browser-server.mjs'), fixture,
    path.join(directory, 'profile'), path.join(directory, 'artifacts')], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(async () => { child.stdin.end(); await stopOwnedProcessTree(child); });
  const pending = new Map(); let id = 0;
  const stdout = createInterface({ input: child.stdout });
  stdout.on('line', line => { const response = JSON.parse(line); const resolve = pending.get(response.id); if (resolve) { pending.delete(response.id); resolve(response.result); } });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('MCP fixture timeout')); }, 5000);
    pending.set(requestId, result => { clearTimeout(timer); resolve(result); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`);
  });
  const listed = await request('tools/list');
  assert.deepEqual(listed.tools.map(tool => tool.name), ['browser_snapshot']);
  const observed = await request('tools/call', { name: 'browser_snapshot', arguments: {} });
  assert.match(observed.content.at(-1).text, /Milhas Connect observedAt:/);
  const blocked = await request('tools/call', { name: 'browser_navigate', arguments: { url: 'file:///secret' } });
  assert.equal(blocked.isError, true);
});
