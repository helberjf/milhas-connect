import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'milhas-connect-session';
const SESSION_MILLISECONDS = 12 * 60 * 60 * 1000;
const MAX_CREDENTIAL_LENGTH = 8192;
const MAX_TOKEN_LENGTH = 2048;

function validString(value, minimum = 1, maximum = MAX_CREDENTIAL_LENGTH) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

export function isConfigured(env = process.env) {
  return validString(env.PLATFORM_PASSWORD)
    && validString(env.PLATFORM_SESSION_SECRET, 32)
    && validString(env.PLATFORM_WORKER_TOKEN, 32);
}

function equalSecrets(left, right) {
  const digest = (value) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(left), digest(right));
}

export function checkPassword(password, env = process.env) {
  return isConfigured(env) && validString(password) && equalSecrets(password, env.PLATFORM_PASSWORD);
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(env = process.env, now = Date.now()) {
  if (!isConfigured(env)) throw new Error('Platform authentication is not configured.');
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid session time.');
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    iat: now,
    exp: now + SESSION_MILLISECONDS,
    nonce: randomBytes(24).toString('base64url'),
  })).toString('base64url');
  return `${payload}.${sign(payload, env.PLATFORM_SESSION_SECRET)}`;
}

export function verifySession(token, env = process.env, now = Date.now()) {
  if (!isConfigured(env) || !validString(token, 1, MAX_TOKEN_LENGTH) || !Number.isSafeInteger(now)) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  if (!equalSecrets(signature, sign(payload, env.PLATFORM_SESSION_SECRET))) return false;
  try {
    const decoded = Buffer.from(payload, 'base64url');
    if (decoded.toString('base64url') !== payload) return false;
    const claims = JSON.parse(decoded.toString('utf8'));
    return claims !== null
      && claims.v === 1
      && Number.isSafeInteger(claims.iat) && claims.iat >= 0 && claims.iat <= now
      && Number.isSafeInteger(claims.exp) && claims.exp === claims.iat + SESSION_MILLISECONDS && claims.exp > now
      && typeof claims.nonce === 'string' && /^[A-Za-z0-9_-]{32}$/.test(claims.nonce);
  } catch {
    return false;
  }
}

export function sessionCookie(token, maxAge = 43200, secure = process.env.NODE_ENV === 'production') {
  if (!Number.isSafeInteger(maxAge) || maxAge < 0 || maxAge > 43200
    || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH
    || (token === '' ? maxAge !== 0 : !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(token))) {
    throw new Error('Invalid session cookie.');
  }
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function header(request, name) {
  try {
    return request.headers.get(name);
  } catch {
    return null;
  }
}

export function isOwner(request, env = process.env, now = Date.now()) {
  const cookies = header(request, 'cookie');
  if (!validString(cookies, 1, 16384)) return false;
  const matches = cookies.split(';').flatMap((cookie) => {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE_NAME) return [];
    return [cookie.slice(separator + 1).trim()];
  });
  return matches.length === 1 && verifySession(matches[0], env, now);
}

export function isWorker(request, env = process.env) {
  if (!isConfigured(env)) return false;
  const authorization = header(request, 'authorization');
  if (!validString(authorization, 1, MAX_CREDENTIAL_LENGTH + 7)) return false;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  return Boolean(match && validString(match[1]) && equalSecrets(match[1], env.PLATFORM_WORKER_TOKEN));
}

export function sameOrigin(request) {
  const origin = header(request, 'origin');
  if (!validString(origin, 1, MAX_TOKEN_LENGTH)) return false;
  try {
    return new URL(origin).origin === origin && new URL(request.url).origin === origin;
  } catch {
    return false;
  }
}
