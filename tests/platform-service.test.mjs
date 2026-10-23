import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStore, createInitialState } from '../lib/platform/store.mjs';
import { createPlatformService } from '../lib/platform/service.mjs';

const start = Date.UTC(2026, 9, 23, 12);
const input = { origin: 'GRU', destination: 'LIS', alternatives: [], departure: '2027-03-10', returnDate: null, tripType: 'oneway', adults: 1, cabin: 'economy', baggage: 'carry_on', flexDays: 0, programs: ['latam'], notes: '' };
const key = (number = 1) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
function fixture(initial) {
  let time = start;
  const store = new MemoryStore(initial);
  const service = createPlatformService(store, { clock: () => time });
  return { service, store, advance: (milliseconds) => { time += milliseconds; } };
}
const result = { summary: 'Consulta concluída.', offers: [], coverage: [{ program: 'latam', origin: 'GRU', destination: 'LIS', departure: input.departure, returnDate: null, state: 'no_results', note: 'Sem disponibilidade.', source: 'https://www.latamairlines.com/', checkedAt: new Date(start).toISOString() }], attention: [] };

test('job creation is idempotent, freezes latest prices and rejects reused keys with other input', async () => {
  const { service, store } = fixture();
  await service.updateSettings({ milePrices: { latam: 29, smiles: 16, azul: 17 } });
  const first = await service.createJob({ ...input, milePrices: { latam: 1, smiles: 1, azul: 1 } }, key());
  const repeated = await service.createJob(input, key());
  assert.equal(first.id, repeated.id);
  assert.equal(first.input.milePrices.latam, 29);
  await assert.rejects(service.createJob({ ...input, destination: 'MAD' }, key()), { status: 409 });
  assert.equal((await store.read()).jobs.length, 1);
});

test('concurrent claims issue one lease, store only its hash and never disclose it again', async () => {
  const { service, store } = fixture();
  await service.createJob(input, key());
  const claims = await Promise.all(Array.from({ length: 10 }, (_, index) => service.claim({ robotId: `robot-${index}`, version: '1.0' })));
  const claimed = claims.filter((item) => item.job);
  assert.equal(claimed.length, 1);
  assert.ok(claimed[0].leaseToken.length >= 40);
  assert.equal(JSON.stringify(await store.read()).includes(claimed[0].leaseToken), false);
  assert.equal(Object.keys(claimed[0].job).some((name) => name.startsWith('_')), false);
  const repeated = await service.claim({ robotId: 'robot-0', version: '1.0' });
  assert.equal(repeated.job, null);
  assert.equal('leaseToken' in repeated, false);
});

test('one robot cannot hold two active jobs and an expired lease cannot complete a reassigned job', async () => {
  const { service, advance } = fixture();
  await service.createJob(input, key());
  await service.createJob(input, key(2));
  const first = await service.claim({ robotId: 'robot-1' });
  assert.equal((await service.claim({ robotId: 'robot-1' })).job, null);
  advance(120_001);
  const reassigned = await service.claim({ robotId: 'robot-2' });
  assert.equal(reassigned.job.id, first.job.id);
  assert.equal(reassigned.job.attempts, 2);
  await assert.rejects(service.completeJob(first.job.id, { robotId: 'robot-1', leaseToken: first.leaseToken, result }), { status: 409 });
});

test('third expired lease ends a job instead of requeueing it forever', async () => {
  const { service, advance } = fixture();
  const job = await service.createJob(input, key());
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await service.claim({ robotId: `robot-${index}` })).job.id, job.id);
    advance(120_001);
  }
  assert.equal((await service.claim({ robotId: 'robot-4' })).job, null);
  assert.equal((await service.getJob(job.id)).status, 'failed');
});

test('heartbeats extend valid leases and reject another worker or expired lease', async () => {
  const { service, advance } = fixture();
  const job = await service.createJob(input, key());
  const claim = await service.claim({ robotId: 'robot-1' });
  advance(100_000);
  assert.deepEqual(await service.heartbeat({ robotId: 'robot-1', jobId: job.id, leaseToken: claim.leaseToken, message: 'Consultando.' }), { ok: true, cancelled: false });
  advance(100_000);
  assert.equal((await service.claim({ robotId: 'robot-2' })).job, null);
  await assert.rejects(service.heartbeat({ robotId: 'robot-2', jobId: job.id, leaseToken: claim.leaseToken }), { status: 409 });
  advance(20_001);
  await assert.rejects(service.heartbeat({ robotId: 'robot-1', jobId: job.id, leaseToken: claim.leaseToken }), { status: 409 });
});

test('owner cancellation signals the worker and blocks late results; retry invalidates old lease', async () => {
  const { service } = fixture();
  const job = await service.createJob(input, key());
  const claim = await service.claim({ robotId: 'robot-1' });
  await service.cancelJob(job.id);
  assert.deepEqual(await service.heartbeat({ robotId: 'robot-1', jobId: job.id, leaseToken: claim.leaseToken }), { ok: true, cancelled: true });
  await assert.rejects(service.completeJob(job.id, { robotId: 'robot-1', leaseToken: claim.leaseToken, result }), { status: 409 });
  const retried = await service.retryJob(job.id);
  assert.equal(retried.status, 'queued');
  assert.equal(retried.attempts, 0);
  await assert.rejects(service.heartbeat({ robotId: 'robot-1', jobId: job.id, leaseToken: claim.leaseToken }), { status: 409 });
  await assert.rejects(service.retryJob(job.id), { status: 409 });
});

test('results are scoped, classified and idempotent after lease expiry but conflicting retries fail', async () => {
  const { service, advance } = fixture();
  const job = await service.createJob(input, key());
  const claim = await service.claim({ robotId: 'robot-1' });
  const payload = { robotId: 'robot-1', leaseToken: claim.leaseToken, result };
  await assert.rejects(service.completeJob(job.id, { ...payload, result: { ...result, coverage: [{ ...result.coverage[0], destination: 'MAD' }] } }), { status: 422 });
  const completed = await service.completeJob(job.id, payload);
  assert.equal(completed.status, 'completed');
  advance(500_000);
  assert.deepEqual(await service.completeJob(job.id, payload), completed);
  await assert.rejects(service.completeJob(job.id, { ...payload, result: { ...result, summary: 'Different' } }), { status: 409 });
  const dashboard = await service.dashboard();
  assert.equal(dashboard.jobs[0].result, null);
  assert.equal(dashboard.jobs[0].resultAvailable, true);
  assert.equal(dashboard.jobs[0].coverageExpected, 1);
  assert.equal(dashboard.jobs[0].coverageCompleted, 1);
  assert.deepEqual((await service.getJob(job.id)).result, completed.result);
  assert.equal(JSON.stringify(dashboard).includes('_lease'), false);
});

test('worker technical errors remain failures and error retries are idempotent', async () => {
  const { service, advance } = fixture();
  const job = await service.createJob(input, key());
  const claim = await service.claim({ robotId: 'robot-1' });
  const payload = { robotId: 'robot-1', leaseToken: claim.leaseToken, message: 'Navegador indisponível.' };
  const failed = await service.failJob(job.id, payload);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.result, null);
  advance(500_000);
  assert.deepEqual(await service.failJob(job.id, payload), failed);
  await assert.rejects(service.failJob(job.id, { ...payload, attention: true }), { status: 409 });
});

test('due monitors create one job with latest prices, skip active rounds and disable expired travel dates', async () => {
  const { service, store, advance } = fixture();
  const job = await service.createJob(input, key());
  const monitor = await service.createMonitor({ jobId: job.id, targetCost: 2500, intervalHours: 1 });
  const upsert = await service.createMonitor({ jobId: job.id, targetCost: 2400, intervalHours: 1 });
  assert.equal(upsert.id, monitor.id);
  advance(3_600_001);
  const first = await service.claim({ robotId: 'robot-1' });
  assert.equal((await store.read()).jobs.length, 1, 'the original active round suppresses duplicate work');
  await service.completeJob(first.job.id, { robotId: 'robot-1', leaseToken: first.leaseToken, result });
  await service.updateSettings({ milePrices: { latam: 30, smiles: 15, azul: 15 } });
  advance(3_600_001);
  const next = await service.claim({ robotId: 'robot-1' });
  assert.equal(next.job.monitorId, monitor.id);
  assert.equal(next.job.input.milePrices.latam, 30);
  assert.equal((await store.read()).jobs.length, 2);
  await service.completeJob(next.job.id, { robotId: 'robot-1', leaseToken: next.leaseToken, result });
  advance(200 * 24 * 3_600_000);
  await service.claim({ robotId: 'robot-1' });
  assert.equal((await store.read()).monitors[0].enabled, false);
  assert.equal((await service.dashboard()).notifications.length, 1);
});

test('matching real complete-cost offers notify once and notifications can be read', async () => {
  const { service } = fixture();
  const job = await service.createJob(input, key());
  await service.createMonitor({ jobId: job.id, targetCost: 2500, intervalHours: 1 });
  const claim = await service.claim({ robotId: 'robot-1' });
  const offer = { id: 'offer-1', program: 'latam', operator: 'LATAM', origin: 'GRU', destination: 'LIS', departure: input.departure, returnDate: null, departureTime: null, arrivalTime: null, durationMinutes: null, flights: [], points: 50_000, cashRequired: 200, currency: 'BRL', taxesVerified: true, baggage: 'Conferir.', eligibility: 'Conferir.', source: 'https://www.latamairlines.com/', checkedAt: new Date(start).toISOString(), caveat: '' };
  const payload = { robotId: 'robot-1', leaseToken: claim.leaseToken, result: { ...result, offers: [offer], coverage: [{ ...result.coverage[0], state: 'observed' }] } };
  await service.completeJob(job.id, payload);
  await service.completeJob(job.id, payload);
  assert.equal((await service.dashboard()).notifications.length, 1);
  await service.readNotifications();
  assert.equal((await service.dashboard()).notifications[0].read, true);
});

test('dashboard caps summaries at 100 and creation refuses full history without deleting jobs', async () => {
  const state = createInitialState();
  const base = await fixture().service.createJob(input, key());
  state.jobs = Array.from({ length: 500 }, (_, index) => ({ ...base, id: `history-${index}` }));
  const { service, store } = fixture(state);
  assert.equal((await service.dashboard()).jobs.length, 100);
  await assert.rejects(service.createJob(input, key(3)), { status: 409 });
  assert.equal((await store.read()).jobs.length, 500);
});
