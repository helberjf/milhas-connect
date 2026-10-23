import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const contract = await import('../robot/contract.mjs').catch(() => ({}));
const protocol = await import('../robot/protocol.mjs').catch(() => ({}));
const executor = await import('../robot/executor.mjs').catch(() => ({}));
const configuration = await import('../robot/config.mjs').catch(() => ({}));
const browser = await import('../robot/browser-server.mjs').catch(() => ({}));

const input = {
  origin: 'SAO', destination: 'RIO', alternatives: [], departure: '2026-12-10', returnDate: null,
  tripType: 'oneway', adults: 2, cabin: 'economy', baggage: 'carry_on', flexDays: 1,
  programs: ['latam', 'azul'], milePrices: { latam: 25, azul: 18, smiles: 17 }, notes: '',
};
const job = { id: 'job-1', input };
const offer = {
  id: 'offer-1', program: 'latam', operator: 'LATAM', origin: 'GRU', destination: 'GIG',
  departure: '2026-12-10', returnDate: null, departureTime: null, arrivalTime: null,
  durationMinutes: null, flights: ['LA3000'], points: 24000, cashRequired: null, currency: 'BRL',
  taxesVerified: false, baggage: 'Mão', eligibility: 'Público', source: 'https://www.latamairlines.com/br/pt',
  checkedAt: '2026-10-23T18:00:00Z', caveat: 'Taxas não confirmadas',
};
const result = { summary: 'Pesquisa parcial', offers: [offer], coverage: [{
  program: 'latam', origin: 'GRU', destination: 'GIG', departure: '2026-12-10', returnDate: null,
  state: 'observed', note: 'Busca para 2 adultos', source: offer.source, checkedAt: offer.checkedAt,
}], attention: [] };
const clone = value => structuredClone(value);

test('scope expands cities, deduplicates airports and preserves trip length across flexible dates', () => {
  assert.equal(typeof contract.searchScope, 'function');
  const scope = contract.searchScope({ ...input, destination: 'GRU', alternatives: ['SAO', 'RIO'],
    tripType: 'roundtrip', departure: '2026-12-10', returnDate: '2026-12-10' });
  assert.deepEqual(scope.origins, ['GRU', 'CGH', 'VCP']);
  assert.deepEqual(scope.destinations, ['GRU', 'CGH', 'VCP', 'GIG', 'SDU']);
  assert.equal(scope.datePairs.length, 3);
  assert.ok(scope.datePairs.every(pair => pair.returnDate >= pair.departure));
});

test('result schema makes every property required while preserving nullable fields', () => {
  assert.equal(typeof contract.RESULT_SCHEMA, 'object');
  const walk = schema => {
    if (schema.type === 'object') {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
      Object.values(schema.properties).forEach(walk);
    }
    if (schema.items) walk(schema.items);
  };
  walk(contract.RESULT_SCHEMA);
  assert.deepEqual(contract.validateResult(result, input), result);
});

test('result validation rejects invented scope, insecure or wrong-program sources and invalid totals', () => {
  assert.equal(typeof contract.validateResult, 'function');
  for (const update of [
    { source: 'http://www.latamairlines.com' }, { source: 'https://latamairlines.com.evil.test' },
    { source: 'https://www.smiles.com.br' }, { origin: 'SAO' }, { departure: '2026-12-14' },
    { returnDate: '2026-12-11' }, { points: -1 }, { cashRequired: null, taxesVerified: true },
    { checkedAt: 'tomorrow' }, { departureTime: '25:99' }, { unexpected: 'field' },
  ]) {
    const value = clone(result); Object.assign(value.offers[0], update);
    assert.throws(() => contract.validateResult(value, input));
  }
  const outside = clone(result); outside.coverage[0].program = 'smiles';
  assert.throws(() => contract.validateResult(outside, input));
});

test('attention result uses pending coverage without inventing no_results or quotes', () => {
  assert.equal(typeof contract.attentionResult, 'function');
  const pending = contract.attentionResult(input, 'Login necessário');
  assert.equal(pending.offers.length, 0);
  assert.equal(pending.coverage.length, 36);
  assert.ok(pending.coverage.every(item => item.state === 'attention_required' && item.checkedAt === null));
  assert.deepEqual(contract.validateResult(pending, input), pending);
});

test('worker rejects duplicate coverage and server text limits before writing an undeliverable outbox', () => {
  const duplicate = clone(result); duplicate.coverage.push(clone(duplicate.coverage[0]));
  assert.throws(() => contract.validateResult(duplicate, input));
  const longOperator = clone(result); longOperator.offers[0].operator = 'x'.repeat(151);
  assert.throws(() => contract.validateResult(longOperator, input));
});

test('worker rejects UTF-8 results beyond the receiving API byte budget', () => {
  const wideInput = { ...input, origin: 'LON', destination: 'PAR', alternatives: ['ROM'],
    programs: ['latam', 'azul', 'smiles'], flexDays: 2 };
  const scope = contract.searchScope(wideInput); const coverage = [];
  for (const program of wideInput.programs) for (const origin of scope.origins) for (const destination of scope.destinations) for (const pair of scope.datePairs) {
    coverage.push({ program, origin, destination, ...pair, state: 'observed', note: 'á'.repeat(1500),
      source: `${contract.PROGRAMS[program].url}/${'x'.repeat(3900)}`, checkedAt: offer.checkedAt });
  }
  const value = { summary: 'Resultado extenso', offers: [], coverage, attention: [] };
  assert.equal(coverage.length, 300);
  assert.ok(Buffer.byteLength(JSON.stringify(value), 'utf8') > 2_000_000);
  assert.throws(() => contract.validateResult(value, wideInput), /limite.*bytes|bytes.*limite/i);
});

test('outbox refuses an oversized exact delivery envelope before persisting it', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'milhas-robot-oversized-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const outbox = new protocol.Outbox(dir);
  await assert.rejects(outbox.save({ jobId: 'job-1', kind: 'result', payload: {
    robotId: 'pc-1', leaseToken: 'x'.repeat(2_000_000), result,
  } }), /limite.*bytes|bytes.*limite/i);
  assert.equal(await outbox.peek(), null);
});

test('API only sends bearer credentials to the configured HTTPS origin and never follows redirects', async () => {
  assert.equal(typeof protocol.RobotApi, 'function');
  const calls = [];
  const api = new protocol.RobotApi({ siteUrl: 'https://connect.example', workerToken: 'private-token' }, async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  await api.post('/robot/heartbeat', { robotId: 'pc-1' });
  assert.equal(calls[0].url, 'https://connect.example/api/platform/robot/heartbeat');
  assert.equal(calls[0].init.headers.authorization, 'Bearer private-token');
  assert.equal(calls[0].init.redirect, 'error');
  await assert.rejects(api.post('https://evil.test', {}));
});

test('delivery is persisted before network and retried with the identical lease and body', async t => {
  assert.equal(typeof protocol.Outbox, 'function');
  const dir = await mkdtemp(path.join(tmpdir(), 'milhas-robot-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const outbox = new protocol.Outbox(dir);
  const payload = { robotId: 'pc-1', leaseToken: 'lease-1', result };
  await outbox.save({ jobId: job.id, kind: 'result', payload });
  const calls = [];
  const api = { post: async (route, body) => {
    assert.equal(JSON.parse(await readFile(path.join(dir, 'outbox.json'), 'utf8')).payload.leaseToken, 'lease-1');
    calls.push({ route, body });
    if (calls.length === 1) throw new Error('rede');
    return { job: { id: job.id } };
  } };
  await assert.rejects(outbox.flush(api));
  assert.ok(await outbox.peek());
  await outbox.flush(api);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(await outbox.peek(), null);
});

test('expired or cancelled lease is preserved in quarantine before active delivery is cleared', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'milhas-robot-rejected-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const outbox = new protocol.Outbox(dir);
  const payload = { robotId: 'pc-1', leaseToken: 'expired-private-lease', result };
  for (const httpStatus of [409, 404, 413, 422]) {
    await outbox.save({ jobId: `job-${httpStatus}`, kind: 'result', payload });
    const outcome = await outbox.flush({ post: async () => { throw new protocol.ApiError(httpStatus); } });
    assert.equal(outcome.quarantined, true);
    assert.equal(await outbox.peek(), null);
  }
  const files = await readdir(path.join(dir, 'rejected-results'));
  assert.equal(files.length, 4);
  for (const file of files) {
    const archived = JSON.parse(await readFile(path.join(dir, 'rejected-results', file), 'utf8'));
    assert.deepEqual(archived.item.payload, payload);
    assert.ok([404, 409, 413, 422].includes(archived.httpStatus));
    assert.ok(Number.isFinite(Date.parse(archived.rejectedAt)));
  }
});

test('unauthorized delivery retains its active outbox and full quarantine never discards pending data', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'milhas-robot-rejected-full-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const outbox = new protocol.Outbox(dir, { maxRejected: 1 });
  const item = { jobId: 'job-1', kind: 'result', payload: { robotId: 'pc-1', leaseToken: 'lease-1', result } };
  await outbox.save(item);
  await assert.rejects(outbox.flush({ post: async () => { throw new protocol.ApiError(401); } }));
  assert.ok(await outbox.peek());
  await outbox.flush({ post: async () => { throw new protocol.ApiError(409); } });
  await outbox.save({ ...item, jobId: 'job-2' });
  await assert.rejects(outbox.flush({ post: async () => { throw new protocol.ApiError(409); } }), /arquivo.*rejeitados.*limite/i);
  assert.equal((await outbox.peek()).jobId, 'job-2');
});

test('worker reports quarantined rejection and can claim again on the next polling step', async () => {
  let pending = true; const calls = []; const states = []; const logs = [];
  const worker = new protocol.RobotWorker({ config: { robotId: 'pc-1' }, api: {
    post: async route => { calls.push(route); return { job: null, retryAfterSeconds: 15 }; },
  }, outbox: { peek: async () => pending ? { jobId: 'expired-job' } : null,
    flush: async () => { pending = false; return { quarantined: true, message: 'Lease rejeitado; resultado salvo no arquivo local.' }; } },
  execute: async () => { throw new Error('Must not execute'); }, log: line => logs.push(line), status: async value => states.push(value) });
  await worker.tick(); await worker.tick();
  assert.ok(states.some(state => state.state === 'needs_attention'));
  assert.ok(logs.some(line => line.includes('rejeitado')));
  assert.deepEqual(calls, ['/robot/claim']);
});

test('worker flushes a pending outbox before it can claim another task', async () => {
  assert.equal(typeof protocol.RobotWorker, 'function');
  const calls = [];
  const worker = new protocol.RobotWorker({ config: { robotId: 'pc-1' }, api: {
    post: async route => { calls.push(route); return { job: null, retryAfterSeconds: 15 }; },
  }, outbox: { peek: async () => ({ jobId: 'old' }), flush: async () => { calls.push('flush'); throw new Error('rede'); } },
  execute: async () => { throw new Error('Must not execute'); }, log: () => {} });
  await assert.rejects(worker.tick());
  assert.deepEqual(calls, ['flush']);
});

test('worker aborts its executor when heartbeat reports cancellation', async () => {
  assert.equal(typeof protocol.RobotWorker, 'function');
  let aborted = false; const deliveries = [];
  const worker = new protocol.RobotWorker({ config: { robotId: 'pc-1' }, heartbeatMs: 5,
    api: { post: async route => route === '/robot/claim' ? { job, leaseToken: 'lease-1' } : { ok: true, cancelled: true } },
    outbox: { save: async item => deliveries.push(item), flush: async () => {}, peek: async () => null },
    execute: async (_job, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }), log: () => {},
  });
  await worker.tick();
  assert.equal(aborted, true);
  assert.equal(deliveries.length, 0);
});

test('Codex invocation disables shell and unrelated integrations and does not expose configuration secrets', () => {
  assert.equal(typeof executor.buildInvocation, 'function');
  const invocation = executor.buildInvocation({ codexPath: 'C:/codex.exe', nodePath: 'C:/node.exe',
    mcpPath: 'C:/app/node_modules/@playwright/mcp/cli.js', workspace: 'C:/data/agent',
    schemaPath: 'C:/data/result.schema.json', outputPath: 'C:/data/result.json',
    profilePath: 'C:/data/chrome-profile', artifactsPath: 'C:/data/artifacts',
  }, { PATH: 'C:/Windows', USERPROFILE: 'C:/User', WORKER_TOKEN: 'secret-worker', DATABASE_URL: 'secret-db', OPENAI_API_KEY: 'secret-key' });
  const joined = invocation.args.join(' ');
  assert.match(joined, /--ignore-user-config/);
  assert.match(joined, /--sandbox read-only/);
  assert.match(joined, /features\.shell_tool=false/);
  assert.match(joined, /enabled_tools/);
  assert.doesNotMatch(joined, /browser_evaluate|browser_run_code|danger-full-access|bypass/);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.env.WORKER_TOKEN, undefined);
  assert.equal(invocation.env.DATABASE_URL, undefined);
  assert.equal(invocation.env.OPENAI_API_KEY, undefined);
});

test('config accepts localhost HTTP only and enforces bounded polling and job timeout', () => {
  assert.equal(typeof configuration.validateConfig, 'function');
  const config = configuration.validateConfig({ siteUrl: 'https://connect.example/', workerToken: 'abc123', robotId: 'pc-1' });
  assert.equal(config.siteUrl, 'https://connect.example');
  assert.equal(config.pollSeconds, 15);
  assert.equal(config.jobTimeoutMinutes, 30);
  assert.throws(() => configuration.validateConfig({ ...config, siteUrl: 'http://external.test' }));
  assert.throws(() => configuration.validateConfig({ ...config, siteUrl: 'https://user:pass@connect.example' }));
  assert.throws(() => configuration.validateConfig({ ...config, pollSeconds: 0 }));
  assert.equal(configuration.validateConfig({ ...config, siteUrl: 'http://localhost:3000' }).siteUrl, 'http://localhost:3000');
});

test('browser bridge rejects code, files, off-domain navigation and explicit purchase actions', () => {
  assert.equal(typeof browser.guardTool, 'function');
  assert.equal(browser.guardTool('browser_snapshot', {}), null);
  assert.equal(browser.guardTool('browser_navigate', { url: 'https://www.smiles.com.br' }), null);
  for (const [name, args] of [
    ['browser_evaluate', { function: '() => localStorage' }],
    ['browser_navigate', { url: 'file:///C:/secret.txt' }],
    ['browser_navigate', { url: 'https://evil.test' }],
    ['browser_tabs', { action: 'new', url: 'http://127.0.0.1:3000/api/private' }],
    ['browser_tabs', { action: 'new', url: 'https://evil.test' }],
    ['browser_click', { element: 'Confirmar pagamento', ref: 'e1' }],
    ['browser_press_key', { key: 'Control+Shift+I' }],
  ]) assert.equal(typeof browser.guardTool(name, args), 'string');
});

test('browser bridge stamps successful observations with a real local UTC timestamp', () => {
  assert.equal(typeof browser.stampObservation, 'function');
  const stamped = browser.stampObservation({ content: [{ type: 'text', text: 'Snapshot' }] });
  assert.match(stamped.content.at(-1).text, /Milhas Connect observedAt: \d{4}-\d{2}-\d{2}T/);
  assert.ok(Number.isFinite(Date.parse(stamped.content.at(-1).text.split(': ').at(-1))));
});
