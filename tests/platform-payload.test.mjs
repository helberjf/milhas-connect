import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, SESSION_COOKIE_NAME } from '../lib/platform/auth.mjs';
import { createPlatformHandler } from '../lib/platform/handler.mjs';
import { MemoryStore } from '../lib/platform/store.mjs';
import { searchScope } from '../lib/platform/validation.mjs';
import { validateResult } from '../robot/contract.mjs';

test('a large valid UTF-8 research result reaches the API instead of trapping delivery with HTTP 413', async () => {
  const env = { PLATFORM_PASSWORD: 'test-password', PLATFORM_SESSION_SECRET: 's'.repeat(32), PLATFORM_WORKER_TOKEN: 'w'.repeat(32) };
  const origin = 'https://connect.example';
  const handler = createPlatformHandler({ env, store: new MemoryStore() });
  const departure = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const send = (route, body, headers) => handler(new Request(`${origin}/api/platform${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  }));
  const created = await send('/jobs', {
    origin: 'RIO', destination: 'PAR', alternatives: ['LON'], departure, tripType: 'oneway', adults: 1,
    cabin: 'economy', baggage: 'carry_on', flexDays: 3, programs: ['latam', 'azul', 'smiles'], notes: '',
  }, { origin, cookie: `${SESSION_COOKIE_NAME}=${createSession(env)}`, 'idempotency-key': '10000000-0000-4000-8000-000000000001' });
  assert.equal(created.status, 201);
  const { job } = await created.json();
  const authorization = `Bearer ${env.PLATFORM_WORKER_TOKEN}`;
  const claimed = await send('/robot/claim', { robotId: 'test-pc', version: '1.0.0' }, { authorization });
  assert.equal(claimed.status, 200);
  const { leaseToken } = await claimed.json();
  const scope = searchScope(job.input);
  assert.equal(scope.length, 294);
  const sources = { latam: 'https://www.latamairlines.com/', azul: 'https://www.voeazul.com.br/', smiles: 'https://www.smiles.com.br/' };
  const checkedAt = new Date().toISOString();
  const result = {
    summary: 'Fixture de entrega com campos válidos e texto UTF-8.', attention: [],
    coverage: scope.map(row => ({ ...row, state: 'observed', source: sources[row.program], checkedAt, note: 'ç'.repeat(1000) })),
    offers: Array.from({ length: 50 }, (_, index) => ({
      ...scope[0], id: `fixture-${index}`, operator: 'LATAM', departureTime: null, arrivalTime: null,
      durationMinutes: null, flights: [], points: 10_000, cashRequired: 50, currency: 'BRL', taxesVerified: true,
      baggage: 'ç'.repeat(500), eligibility: 'ç'.repeat(500), source: sources.latam, checkedAt, caveat: 'ç'.repeat(1000),
    })),
  };
  validateResult(result, job.input);
  const payload = { robotId: 'test-pc', leaseToken, result };
  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  assert.ok(bytes > 512 * 1024, `Fixture must exercise the old HTTP limit, received ${bytes} bytes.`);
  assert.ok(bytes < 2_000_000);
  const delivered = await send(`/robot/jobs/${job.id}/result`, payload, { authorization });
  assert.equal(delivered.status, 200, JSON.stringify(await delivered.clone().json()));
  const { job: completed } = await delivered.json();
  assert.equal(completed.result.offers.length, 50);
  assert.equal(completed.result.coverage.length, 294);
  assert.equal(completed.result.coverage[0].note, result.coverage[0].note);
});
