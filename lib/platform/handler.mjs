import { createHash } from 'node:crypto';
import { checkPassword, createSession, isConfigured, isOwner, isWorker, sameOrigin, sessionCookie } from './auth.mjs';
import { createPlatformService } from './service.mjs';
import { createStore } from './store.mjs';
import { HttpError, MAX_PLATFORM_BODY_BYTES } from './validation.mjs';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

async function readBody(request, maximum = MAX_PLATFORM_BODY_BYTES) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new HttpError('Solicitação muito grande.', 413);
  if (!request.body) throw new HttpError('Informe um corpo JSON.', 400);
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new HttpError('Solicitação muito grande.', 413);
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { reader.releaseLock(); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
    return value;
  } catch { throw new HttpError('JSON inválido.', 400); }
}

export function createPlatformHandler({ store, env = process.env, clock = Date.now } = {}) {
  let activeStore = store;
  let activeService;
  const storage = () => (activeStore ??= createStore(env));
  const service = () => (activeService ??= createPlatformService(storage(), { clock }));

  return async function handle(request) {
    try {
      const url = new URL(request.url);
      const prefix = '/api/platform';
      if (!url.pathname.startsWith(`${prefix}/`)) throw new HttpError('Rota não encontrada.', 404);
      const route = url.pathname.slice(prefix.length).replace(/\/$/, '');
      const method = request.method;
      if (route === '/session' && method === 'GET') return json({ authenticated: isOwner(request, env, clock()), configured: isConfigured(env) });
      if (!isConfigured(env)) throw new HttpError('A autenticação da plataforma ainda não foi configurada.', 503);
      if (route === '/login' && method === 'POST') {
        if (!sameOrigin(request)) throw new HttpError('Origem da solicitação inválida.', 403);
        const body = await readBody(request, 4096);
        const valid = checkPassword(body.password, env);
        const now = clock();
        // Vercel overwrites the trusted forwarded-IP header; only a digest is stored.
        const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown';
        const fingerprint = createHash('sha256').update(ip.slice(0, 200)).digest('hex');
        const allowed = await storage().transact((state) => {
          const window = 15 * 60 * 1000;
          for (const [key, attempt] of Object.entries(state.authAttempts)) if (now - attempt.startedAt >= window) delete state.authAttempts[key];
          const previous = state.authAttempts[fingerprint];
          if (previous?.count >= 8) return false;
          if (valid) { delete state.authAttempts[fingerprint]; return true; }
          if (Object.keys(state.authAttempts).length >= 2000 && !previous) throw new HttpError('Aguarde antes de tentar entrar novamente.', 429);
          state.authAttempts[fingerprint] = { startedAt: previous?.startedAt ?? now, count: (previous?.count ?? 0) + 1 };
          return true;
        });
        if (!allowed) throw new HttpError('Muitas tentativas. Aguarde quinze minutos.', 429);
        if (!valid) throw new HttpError('Senha incorreta.', 401);
        return json({ ok: true }, 200, { 'set-cookie': sessionCookie(createSession(env, now), 43200, env.NODE_ENV === 'production') });
      }

      const robotRoute = route.startsWith('/robot/');
      if (robotRoute) {
        if (!isWorker(request, env)) throw new HttpError('Credencial do robô inválida.', 401);
      } else {
        if (!isOwner(request, env, clock())) throw new HttpError('Entre para acessar o painel.', 401);
        if (method !== 'GET' && !sameOrigin(request)) throw new HttpError('Origem da solicitação inválida.', 403);
      }

      if (route === '/logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, env.NODE_ENV === 'production') });
      if (route === '/dashboard' && method === 'GET') return json(await service().dashboard());
      if (route === '/jobs' && method === 'POST') return json({ job: await service().createJob(await readBody(request), request.headers.get('idempotency-key')) }, 201);
      let match = /^\/jobs\/([^/]+)$/.exec(route);
      if (match && method === 'GET') return json({ job: await service().getJob(match[1]) });
      match = /^\/jobs\/([^/]+)\/(cancel|retry)$/.exec(route);
      if (match && method === 'POST') return json({ job: await service()[match[2] === 'cancel' ? 'cancelJob' : 'retryJob'](match[1]) });
      if (route === '/settings' && method === 'PUT') return json({ settings: await service().updateSettings(await readBody(request)) });
      if (route === '/monitors' && method === 'POST') return json({ monitor: await service().createMonitor(await readBody(request)) }, 201);
      match = /^\/monitors\/([^/]+)$/.exec(route);
      if (match && method === 'PATCH') return json({ monitor: await service().updateMonitor(match[1], await readBody(request)) });
      if (route === '/notifications/read' && method === 'POST') return json(await service().readNotifications());
      if (route === '/robot/claim' && method === 'POST') return json(await service().claim(await readBody(request)));
      if (route === '/robot/heartbeat' && method === 'POST') return json(await service().heartbeat(await readBody(request)));
      match = /^\/robot\/jobs\/([^/]+)\/(result|error)$/.exec(route);
      if (match && method === 'POST') return json({ job: await service()[match[2] === 'result' ? 'completeJob' : 'failJob'](match[1], await readBody(request)) });
      throw new HttpError('Rota não encontrada.', 404);
    } catch (error) {
      return error instanceof HttpError ? json({ error: error.message }, error.status) : json({ error: 'A plataforma está temporariamente indisponível. Tente novamente.' }, 503);
    }
  };
}
