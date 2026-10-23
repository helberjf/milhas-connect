import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlatformHandler } from '../lib/platform/handler.mjs';
import { createSession, SESSION_COOKIE_NAME } from '../lib/platform/auth.mjs';
import { MemoryStore } from '../lib/platform/store.mjs';

const env = { PLATFORM_PASSWORD: 'example-only-owner-password', PLATFORM_SESSION_SECRET: 'example-only-session-secret-of-32-characters', PLATFORM_WORKER_TOKEN: 'example-only-worker-token-of-32-characters' };
const input = { origin: 'GRU', destination: 'LIS', alternatives: [], departure: '2027-03-10', returnDate: null, tripType: 'oneway', adults: 1, cabin: 'economy', baggage: 'carry_on', flexDays: 0, programs: ['latam'], notes: '' };
const origin = 'https://example.invalid';
const cookie = `${SESSION_COOKIE_NAME}=${createSession(env)}`;
function request(route, { method = 'GET', body, owner = false, worker = false, sameSite = true, headers = {} } = {}) {
  return new Request(`${origin}/api/platform${route}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(owner ? { cookie } : {}), ...(worker ? { authorization: `Bearer ${env.PLATFORM_WORKER_TOKEN}` } : {}), ...(sameSite ? { origin } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}
function fixture(options = {}) {
  const store = new MemoryStore();
  return { store, handle: createPlatformHandler({ store, env, ...options }) };
}

test('session is public, configuration fails closed and protected routes need correct auth', async () => {
  const { handle } = fixture();
  assert.deepEqual(await (await handle(request('/session'))).json(), { authenticated: false, configured: true });
  assert.equal((await handle(request('/dashboard'))).status, 401);
  assert.equal((await handle(request('/robot/claim', { method: 'POST', owner: true, body: { robotId: 'robot-1' } }))).status, 401);
  const unconfigured = fixture({ env: {} }).handle;
  assert.deepEqual(await (await unconfigured(request('/session'))).json(), { authenticated: false, configured: false });
  assert.equal((await unconfigured(request('/login', { method: 'POST', body: { password: 'any' } }))).status, 503);
});

test('login checks origin, sets a private session cookie and logout clears it', async () => {
  const { handle } = fixture();
  assert.equal((await handle(request('/login', { method: 'POST', sameSite: false, body: { password: env.PLATFORM_PASSWORD } }))).status, 403);
  const loggedIn = await handle(request('/login', { method: 'POST', body: { password: env.PLATFORM_PASSWORD } }));
  assert.equal(loggedIn.status, 200);
  assert.match(loggedIn.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await handle(request('/logout', { method: 'POST', owner: true }))).headers.get('set-cookie').includes('Max-Age=0'), true);
  assert.equal((await handle(request('/settings', { method: 'PUT', owner: true, sameSite: false, body: { milePrices: { latam: 26, smiles: 15, azul: 15 } } }))).status, 403);
});

test('injected handler clock governs session issuance and expiration consistently', async () => {
  let time = Date.UTC(2026, 0, 1, 12);
  const { handle } = fixture({ clock: () => time });
  const login = await handle(request('/login', { method: 'POST', body: { password: env.PLATFORM_PASSWORD } }));
  const issuedCookie = login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await handle(request('/session', { headers: { cookie: issuedCookie } }))).json(), { authenticated: true, configured: true });
  time += 12 * 60 * 60 * 1000;
  assert.deepEqual(await (await handle(request('/session', { headers: { cookie: issuedCookie } }))).json(), { authenticated: false, configured: true });
});

test('failed login attempts are persisted, bounded and expire after fifteen minutes', async () => {
  let time = Date.now();
  const { handle, store } = fixture({ clock: () => time });
  for (let index = 0; index < 8; index += 1) assert.equal((await handle(request('/login', { method: 'POST', body: { password: 'wrong' } }))).status, 401);
  assert.equal((await handle(request('/login', { method: 'POST', body: { password: env.PLATFORM_PASSWORD } }))).status, 429);
  const attempts = (await store.read()).authAttempts;
  assert.equal(Object.keys(attempts).length, 1);
  assert.match(Object.keys(attempts)[0], /^[a-f0-9]{64}$/);
  time += 15 * 60 * 1000 + 1;
  assert.equal((await handle(request('/login', { method: 'POST', body: { password: env.PLATFORM_PASSWORD } }))).status, 200);
});

test('owner creation/detail/dashboard and native worker claims honor separate boundaries', async () => {
  const { handle } = fixture();
  const created = await handle(request('/jobs', { method: 'POST', owner: true, body: input, headers: { 'idempotency-key': '00000000-0000-4000-8000-000000000001' } }));
  assert.equal(created.status, 201);
  const { job } = await created.json();
  const claimed = await handle(request('/robot/claim', { method: 'POST', worker: true, sameSite: false, body: { robotId: 'robot-1', version: '1.0' } }));
  assert.equal(claimed.status, 200);
  const leased = await claimed.json();
  assert.equal(leased.job.id, job.id);
  assert.ok(leased.leaseToken);
  const dashboard = await handle(request('/dashboard', { owner: true }));
  const dashboardText = await dashboard.text();
  assert.equal(dashboardText.includes(leased.leaseToken), false);
  assert.equal(dashboardText.includes('_lease'), false);
  assert.equal(dashboard.headers.get('cache-control'), 'no-store');
  assert.equal((await (await handle(request(`/jobs/${job.id}`, { owner: true }))).json()).job.id, job.id);
  assert.equal((await handle(request('/dashboard', { worker: true }))).status, 401);
});

test('JSON parsing and streaming size limits reject invalid bodies without exposing internals', async () => {
  const { handle } = fixture();
  assert.equal((await handle(request('/login', { method: 'POST', body: '{bad-json' }))).status, 400);
  assert.equal((await handle(request('/login', { method: 'POST', body: { password: 'x'.repeat(4096) } }))).status, 413);
  assert.equal((await handle(request('/jobs', { method: 'POST', owner: true, body: { notes: 'x'.repeat(2_000_000) }, headers: { 'idempotency-key': '00000000-0000-4000-8000-000000000001' } }))).status, 413);
  assert.equal((await handle(request('/missing', { owner: true }))).status, 404);
  const broken = createPlatformHandler({ env, store: { mode: 'postgres', async read() { throw new Error(`private database ${env.PLATFORM_WORKER_TOKEN}`); } } });
  const failure = await broken(request('/dashboard', { owner: true }));
  assert.equal(failure.status, 503);
  assert.equal((await failure.text()).includes(env.PLATFORM_WORKER_TOKEN), false);
});

test('changing caller-controlled User-Agent cannot bypass the IP login limit', async () => {
  const { handle } = fixture();
  for (let index = 0; index < 9; index += 1) {
    const response = await handle(request('/login', {
      method: 'POST', body: { password: 'wrong' },
      headers: { 'x-vercel-forwarded-for': '192.0.2.10', 'user-agent': `browser-${index}` },
    }));
    assert.equal(response.status, index < 8 ? 401 : 429);
  }
  const otherIp = await handle(request('/login', { method: 'POST', body: { password: env.PLATFORM_PASSWORD }, headers: { 'x-vercel-forwarded-for': '192.0.2.11' } }));
  assert.equal(otherIp.status, 200);
});
