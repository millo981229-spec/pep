'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const path = require('node:path');
const express = require('express');
const next = require('next');
const { AuthError, AuthStore } = require('./server/auth-store');

const SESSION_COOKIE = 'gotgot-session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cookieValue(request, name) {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function cookieOptions(secure) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

function sameOrigin(request, response, nextMiddleware) {
  const origin = request.get('origin');
  if (!origin) return nextMiddleware();
  const expected = `${request.protocol}://${request.get('host')}`;
  if (origin !== expected)
    return response
      .status(403)
      .json({ error: '이 사이트에서 다시 시도해 주세요.' });
  return nextMiddleware();
}

function rateLimiter({ limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return (request, response, nextMiddleware) => {
    const now = Date.now();
    const key = `${request.ip}:${request.path}`;
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return nextMiddleware();
    }
    if (current.count >= limit) {
      response.set(
        'Retry-After',
        String(Math.ceil((current.resetAt - now) / 1000)),
      );
      return response
        .status(429)
        .json({ error: '로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.' });
    }
    current.count += 1;
    return nextMiddleware();
  };
}

function createExpressApp({
  nextHandler = (_request, response) => response.status(404).end(),
  storePath = process.env.AUTH_STORE_PATH ||
    path.join(process.cwd(), 'data', 'auth-store.json'),
  secureCookies = process.env.NODE_ENV === 'production',
} = {}) {
  const app = express();
  const store = new AuthStore(storePath, { sessionTtlMs: SESSION_TTL_MS });
  const authLimit = rateLimiter();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use('/api', (_request, response, nextMiddleware) => {
    response.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    nextMiddleware();
  });
  app.use(
    ['/api/register', '/api/login', '/api/logout', '/api/account'],
    express.json({ limit: '8kb', strict: true }),
  );

  const setSession = (response, token) =>
    response.cookie(SESSION_COOKIE, token, cookieOptions(secureCookies));
  const clearSession = (response) =>
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
    });
  const requireSession = async (request) => {
    const user = await store.session(cookieValue(request, SESSION_COOKIE));
    if (!user) throw new AuthError(401, '로그인 후 이용해 주세요.');
    return user;
  };

  app.get('/api/health', (_request, response) =>
    response.json({ ok: true, service: 'gotgot-auth' }),
  );

  app.post(
    '/api/register',
    sameOrigin,
    authLimit,
    async (request, response) => {
      const oldToken = cookieValue(request, SESSION_COOKIE);
      const result = await store.register(
        request.body?.username,
        request.body?.password,
      );
      if (oldToken) await store.logout(oldToken);
      setSession(response, result.token);
      response.status(201).json({
        message: '회원가입과 로그인을 완료했습니다.',
        user: result.user,
      });
    },
  );

  app.post('/api/login', sameOrigin, authLimit, async (request, response) => {
    const oldToken = cookieValue(request, SESSION_COOKIE);
    const result = await store.login(
      request.body?.username,
      request.body?.password,
    );
    if (oldToken) await store.logout(oldToken);
    setSession(response, result.token);
    response.json({ message: '로그인했습니다.', user: result.user });
  });

  app.get('/api/session', async (request, response) => {
    const user = await store.session(cookieValue(request, SESSION_COOKIE));
    if (!user) clearSession(response);
    response.json({ configured: true, user });
  });

  app.post('/api/logout', sameOrigin, async (request, response) => {
    await store.logout(cookieValue(request, SESSION_COOKIE));
    clearSession(response);
    response.json({ message: '로그아웃했습니다.' });
  });

  app.get('/api/account', async (request, response) => {
    const user = await requireSession(request);
    response.json(await store.account(user.id));
  });

  app.post('/api/account', sameOrigin, async (request, response) => {
    const user = await requireSession(request);
    if (request.body?.action !== 'profile')
      throw new AuthError(
        501,
        '이 기능은 데이터베이스 연결 후 사용할 수 있습니다.',
      );
    await store.updateProfile(user.id, request.body);
    response.json({ message: '추천 프로필을 저장했습니다.' });
  });

  app.use((request, response) => nextHandler(request, response));

  app.use((error, _request, response, _nextMiddleware) => {
    void _nextMiddleware;
    if (response.headersSent) return;
    if (error instanceof AuthError)
      return response.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError && 'body' in error)
      return response
        .status(400)
        .json({ error: 'JSON 입력 형식을 확인해 주세요.' });
    console.error(
      'Request failed:',
      error instanceof Error ? error.message : error,
    );
    return response.status(500).json({
      error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  });

  return { app, store };
}

async function startServer() {
  const development = process.env.NODE_ENV !== 'production';
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535.');
  const nextApp = next({ dev: development, hostname, port });
  await nextApp.prepare();
  const { app } = createExpressApp({
    nextHandler: nextApp.getRequestHandler(),
  });
  app.listen(port, hostname, () => {
    console.log(`곳곳 server ready: http://${hostname}:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { createExpressApp, startServer };
