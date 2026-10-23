import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createInitialState, createStore, FileStore, MemoryStore, PostgresStore } from '../lib/platform/store.mjs';

const pause = () => new Promise((resolve) => setImmediate(resolve));

test('initial state has independent defaults and no account credentials', () => {
  const state = createInitialState();
  assert.deepEqual(state, {
    schemaVersion: 1,
    settings: { milePrices: { latam: 26, smiles: 15, azul: 15 } },
    jobs: [], monitors: [], notifications: [],
    robot: { id: null, lastSeenAt: null, currentJobId: null, version: null },
    idempotency: {}, authAttempts: {},
  });
  state.jobs.push({ id: 'changed' });
  assert.deepEqual(createInitialState().jobs, []);
});

test('memory transactions serialize concurrent claims so only one worker gets a job', async () => {
  const initial = createInitialState();
  initial.jobs.push({ id: 'job-1', status: 'queued' });
  const store = new MemoryStore(initial);
  const claims = await Promise.all(Array.from({ length: 20 }, (_, index) => store.transact(async (state) => {
    const job = state.jobs.find((item) => item.status === 'queued');
    await pause();
    if (!job) return null;
    job.status = 'running';
    job.workerId = `worker-${index}`;
    return job.id;
  })));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal((await store.read()).jobs[0].status, 'running');
  assert.equal(store.mode, 'local');
});

test('memory rollback and references cannot mutate committed state', async () => {
  const initial = createInitialState();
  const store = new MemoryStore(initial);
  initial.settings.milePrices.latam = 999;
  const read = await store.read();
  read.settings.milePrices.latam = 888;
  await assert.rejects(store.transact((state) => {
    state.settings.milePrices.latam = 777;
    throw new Error('cancel mutation');
  }), /cancel mutation/);
  assert.equal((await store.read()).settings.milePrices.latam, 26);
  let retained;
  const result = await store.transact((state) => {
    retained = state;
    state.jobs.push({ id: 'saved' });
    return state.jobs[0];
  });
  retained.jobs.length = 0;
  result.id = 'tampered';
  assert.deepEqual((await store.read()).jobs, [{ id: 'saved' }]);
});

test('file transactions survive recreation and serialize across instances for the same path', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milhas-connect-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'nested', 'state.json');
  const first = new FileStore(file);
  const second = new FileStore(file);
  await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? first : second).transact(async (state) => {
    const previous = state.settings.milePrices.latam;
    await pause();
    state.settings.milePrices.latam = previous + 1;
    return index;
  })));
  const recreated = new FileStore(file);
  assert.equal((await recreated.read()).settings.milePrices.latam, 56);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).settings.milePrices.latam, 56);
  assert.deepEqual(await readdir(path.dirname(file)), ['state.json']);
  assert.equal(recreated.mode, 'local');
});

test('failed file mutations leave the prior persisted document intact and the queue usable', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milhas-connect-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'state.json');
  const store = new FileStore(file);
  await store.transact((state) => { state.jobs.push({ id: 'original' }); });
  const original = await readFile(file, 'utf8');
  await assert.rejects(store.transact(async (state) => {
    state.jobs.length = 0;
    await pause();
    throw new Error('worker failed');
  }), /worker failed/);
  assert.equal(await readFile(file, 'utf8'), original);
  await assert.rejects(store.transact((state) => { state.circular = state; }), /circular/i);
  assert.equal(await readFile(file, 'utf8'), original);
  const result = await store.transact((state) => { state.notifications.push({ id: 'after-failure' }); return 'saved'; });
  assert.equal(result, 'saved');
  assert.equal((await store.read()).jobs[0].id, 'original');
});

test('file store refuses corrupt persisted data instead of resetting it', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milhas-connect-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'state.json');
  await writeFile(file, '{broken-json', 'utf8');
  await assert.rejects(new FileStore(file).read(), /JSON|persisted state/i);
  assert.equal(await readFile(file, 'utf8'), '{broken-json');
});

// A deterministic SQL boundary permits contention tests without a live database.
function fakeDatabase({ alwaysConflict = false } = {}) {
  let row;
  const queries = [];
  let updates = 0;
  const query = async (sql, parameters = []) => {
    queries.push({ sql, parameters });
    await pause();
    if (sql.startsWith('CREATE TABLE')) return [];
    if (sql.startsWith('INSERT INTO')) {
      row ??= { version: '0', data: JSON.parse(parameters[1]) };
      return [];
    }
    if (sql.startsWith('SELECT')) return [structuredClone(row)];
    if (sql.startsWith('UPDATE')) {
      updates += 1;
      if (alwaysConflict || String(parameters[2]) !== row.version) return [];
      row = { version: String(BigInt(row.version) + 1n), data: JSON.parse(parameters[1]) };
      return [{ version: row.version }];
    }
    throw new Error('Unexpected query');
  };
  return { query, queries, get updates() { return updates; } };
}

test('postgres compare-and-swap retries contenders without losing changes or double claims', async () => {
  const database = fakeDatabase();
  const first = new PostgresStore('unused-test-connection', { query: database.query });
  const second = new PostgresStore('unused-test-connection', { query: database.query });
  await first.transact((state) => { state.jobs.push({ id: 'job-1', status: 'queued' }); });
  let mutationCalls = 0;
  const claims = await Promise.all([first, second].map((store, index) => store.transact(async (state) => {
    mutationCalls += 1;
    const job = state.jobs.find((item) => item.status === 'queued');
    await pause();
    if (!job) return null;
    job.status = 'running';
    job.workerId = `worker-${index}`;
    return job.id;
  })));
  assert.deepEqual(claims.filter(Boolean), ['job-1']);
  assert.ok(mutationCalls > 2, 'a conflicting mutator was retried');
  const result = await first.read();
  assert.equal(result.jobs[0].status, 'running');
  result.jobs.length = 0;
  assert.equal((await first.read()).jobs.length, 1);
  assert.equal(first.mode, 'postgres');
  assert.ok(database.queries.some(({ sql }) => /version = \$3/.test(sql)));
});

test('postgres mutations use parameters and abort after bounded conflicts', async () => {
  const database = fakeDatabase();
  const store = new PostgresStore('unused-test-connection', { query: database.query });
  const callerText = "'); DROP TABLE milhas_connect_state; --";
  await store.transact((state) => { state.jobs.push({ id: callerText }); });
  assert.ok(database.queries.every(({ sql }) => !sql.includes(callerText)));
  await assert.rejects(store.transact((state) => { state.jobs.length = 0; throw new Error('abort'); }), /abort/);
  assert.equal((await store.read()).jobs.length, 1);
  const conflicting = fakeDatabase({ alwaysConflict: true });
  const contestedStore = new PostgresStore('unused-test-connection', { query: conflicting.query });
  await assert.rejects(contestedStore.transact((state) => { state.jobs.push({ id: 'never-saved' }); }), /conflict|contention/i);
  assert.equal(conflicting.updates, 10);
});

test('store selection requires durable database configuration in production', () => {
  assert.ok(createStore({ DATABASE_URL: 'postgresql://test:test@example.invalid/test' }) instanceof PostgresStore);
  assert.ok(createStore({ POSTGRES_URL: 'postgresql://test:test@example.invalid/test' }) instanceof PostgresStore);
  assert.ok(createStore({ PLATFORM_DATA_FILE: '/temporary-test/state.json', NODE_ENV: 'development' }) instanceof FileStore);
  assert.throws(() => createStore({ NODE_ENV: 'production' }), /DATABASE_URL|POSTGRES_URL/);
  assert.throws(() => createStore({ VERCEL: '1' }), /DATABASE_URL|POSTGRES_URL/);
});
