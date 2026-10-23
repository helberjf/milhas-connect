import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { checkPassword, createSession, isConfigured, isOwner, isWorker, sameOrigin, SESSION_COOKIE_NAME, sessionCookie, verifySession } from '../lib/platform/auth.mjs';

const env = {
  PLATFORM_PASSWORD: 'example-only-owner-password-never-production',
  PLATFORM_SESSION_SECRET: 'example-only-session-secret-with-at-least-32-characters',
  PLATFORM_WORKER_TOKEN: 'example-only-worker-token-with-at-least-32-characters',
};
const now = Date.UTC(2026, 9, 23, 12);
const request = (headers = {}, url = 'https://example.invalid/api/platform') => new Request(url, { headers });

test('configuration requires all three server credentials and minimum secret lengths', () => {
  assert.equal(isConfigured(env), true);
  for (const name of Object.keys(env)) assert.equal(isConfigured({ ...env, [name]: '' }), false);
  assert.equal(isConfigured({ ...env, PLATFORM_SESSION_SECRET: 'too-short' }), false);
  assert.equal(isConfigured({ ...env, PLATFORM_WORKER_TOKEN: 'too-short' }), false);
  assert.equal(isConfigured({}), false);
});

test('password verification rejects malformed and oversized input without throwing', () => {
  assert.equal(checkPassword(env.PLATFORM_PASSWORD, env), true);
  assert.equal(checkPassword('wrong', env), false);
  assert.equal(checkPassword(env.PLATFORM_WORKER_TOKEN, env), false);
  for (const value of [null, undefined, {}, '', 'x'.repeat(20_000)]) assert.equal(checkPassword(value, env), false);
  assert.equal(checkPassword('anything', {}), false);
});

test('sessions expire at twelve hours, reject tampering and have random nonces', () => {
  const token = createSession(env, now);
  assert.equal(verifySession(token, env, now), true);
  assert.equal(verifySession(token, env, now + 12 * 60 * 60 * 1000 - 1), true);
  assert.equal(verifySession(token, env, now + 12 * 60 * 60 * 1000), false);
  assert.equal(verifySession(`${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`, env, now), false);
  assert.equal(verifySession(token, { ...env, PLATFORM_SESSION_SECRET: 'another-session-secret-that-is-long-enough' }, now), false);
  assert.notEqual(createSession(env, now), token);
  assert.ok(!token.includes(env.PLATFORM_PASSWORD));
  assert.ok(!token.includes(env.PLATFORM_WORKER_TOKEN));
  assert.throws(() => createSession({}, now), /configur/i);
});

test('session parsing rejects malformed tokens and invalid signed claims', () => {
  for (const value of ['', null, {}, 'x'.repeat(20_000), 'a.b.c', 'a.b', '!!!!.!!!!']) {
    assert.equal(verifySession(value, env, now), false);
  }
  const validClaims = { v: 1, iat: now, exp: now + 43_200_000, nonce: 'a'.repeat(32) };
  const tokenFor = (claims) => {
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', env.PLATFORM_SESSION_SECRET).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  };
  assert.equal(verifySession(tokenFor(validClaims), env, now), true);
  const invalidClaims = [
    { ...validClaims, iat: now + 60_000, exp: now + 43_260_000 },
    { ...validClaims, exp: now + 43_200_001 },
    { ...validClaims, v: 2 },
    { ...validClaims, exp: 'never' },
    { ...validClaims, nonce: '' },
    { ...validClaims, iat: -1, exp: 43_199_999 },
  ];
  for (const claims of invalidClaims) assert.equal(verifySession(tokenFor(claims), env, now), false);
});

test('session cookies are private, strict and can be cleared', () => {
  assert.equal(SESSION_COOKIE_NAME, 'milhas-connect-session');
  assert.equal(sessionCookie('valid.token', 43200, true), 'milhas-connect-session=valid.token; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200; Secure');
  assert.equal(sessionCookie('', 0, false), 'milhas-connect-session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  assert.throws(() => sessionCookie('token; injected=value'), /invalid/i);
  assert.throws(() => sessionCookie('token\r\nX-Injected: yes'), /invalid/i);
});

test('owner auth accepts only the exact nonduplicated session cookie', () => {
  const token = createSession(env);
  assert.equal(isOwner(request({ cookie: `another=value; ${SESSION_COOKIE_NAME}=${token}` }), env), true);
  for (const cookie of [
    `${SESSION_COOKIE_NAME}-fake=${token}`,
    `fake-${SESSION_COOKIE_NAME}=${token}`,
    `${SESSION_COOKIE_NAME}=garbage`,
    `${SESSION_COOKIE_NAME}=%ZZ`,
    `${SESSION_COOKIE_NAME}=${token}; ${SESSION_COOKIE_NAME}=garbage`,
  ]) assert.equal(isOwner(request({ cookie }), env), false);
  assert.equal(isOwner(request(), env), false);
  assert.equal(isOwner(request({ authorization: `Bearer ${env.PLATFORM_WORKER_TOKEN}` }), env), false);
});

test('worker auth accepts only a well-formed bearer credential and never owner credentials', () => {
  assert.equal(isWorker(request({ authorization: `Bearer ${env.PLATFORM_WORKER_TOKEN}` }), env), true);
  for (const authorization of [
    `Bearer ${env.PLATFORM_PASSWORD}`, `Basic ${env.PLATFORM_WORKER_TOKEN}`,
    `Bearer ${env.PLATFORM_WORKER_TOKEN} extra`, `Bearer wrong`, `Bearer ${'x'.repeat(20_000)}`,
  ]) assert.equal(isWorker(request({ authorization }), env), false);
  assert.equal(isWorker(request(), env), false);
  assert.equal(isWorker(request({ authorization: `Bearer ${env.PLATFORM_WORKER_TOKEN}` }), {}), false);
});

test('origin checking compares complete origins and rejects missing or malformed origins', () => {
  assert.equal(sameOrigin(request({ origin: 'https://example.invalid' })), true);
  for (const origin of ['https://other.invalid', 'http://example.invalid', 'https://example.invalid:444', 'null', 'https://example.invalid/path', 'https://example.invalid, https://other.invalid']) {
    assert.equal(sameOrigin(request({ origin })), false);
  }
  assert.equal(sameOrigin(request()), false);
});
