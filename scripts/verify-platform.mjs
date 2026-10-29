import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const zod = require('zod');
const source = fs.readFileSync(
  resolve(projectRoot, 'src/lib/platform.ts'),
  'utf8',
);
let cookieData = new Map();
let fetchImpl = async () => new Response('{}');
const context = {
  exports: {},
  process: {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
  },
  Headers,
  Response,
  Request,
  URL,
  AbortSignal,
  TextDecoder,
  Uint8Array,
  fetch: (...args) => fetchImpl(...args),
  require: (name) =>
    name === 'zod'
      ? zod
      : name === 'next/headers'
        ? {
            cookies: async () => ({
              get: (k) =>
                cookieData.has(k) ? { value: cookieData.get(k) } : undefined,
              set: (k, v) => cookieData.set(k, v),
            }),
          }
        : {},
};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  context,
);
const api = context.exports;
// Each test invokes the actual TypeScript module with mocked transport and cookies.
// Fixtures are isolated from the real process environment; no credentials or live network are used.
test('publishable key only in apikey, never anonymous Bearer', async () => {
  fetchImpl = async (url, init) => {
    assert.equal(url, 'https://example.supabase.co/rest/v1/activities');
    assert.equal(init.headers.get('apikey'), 'sb_publishable_test');
    assert.equal(init.headers.has('Authorization'), false);
    assert.equal(init.cache, 'no-store');
    return new Response('[]');
  };
  assert.equal(JSON.stringify(await api.supabase('/rest/v1/activities')), '[]');
});
test('session token replaces supplied Authorization without dropping Prefer', async () => {
  fetchImpl = async (_, init) => {
    assert.equal(init.headers.get('Authorization'), 'Bearer session-token');
    assert.equal(init.headers.get('Prefer'), 'return=minimal');
    return new Response(null, { status: 204 });
  };
  assert.equal(
    await api.supabase(
      '/rest/v1/x',
      {
        headers: { Prefer: 'return=minimal', Authorization: 'Bearer attacker' },
      },
      'session-token',
    ),
    null,
  );
});
test('quota exception maps to safe HTTP 429', async () => {
  fetchImpl = async () =>
    new Response(
      JSON.stringify({
        code: 'P0001',
        message: 'daily_limit_reached',
        details: 'PRIVATE_TOKEN',
      }),
      { status: 400 },
    );
  await assert.rejects(
    api.supabase('/rest/v1/rpc/reserve_ai_request'),
    (e) => e.status === 429 && !e.message.includes('PRIVATE_TOKEN'),
  );
});
test('offer balance exception maps to conflict, unknown provider body is never echoed', async () => {
  fetchImpl = async () =>
    new Response(
      JSON.stringify({ code: 'P0001', message: 'insufficient_balance' }),
      { status: 400 },
    );
  await assert.rejects(
    api.supabase('/rest/v1/rpc/exchange_offer'),
    (e) => e.status === 409,
  );
  fetchImpl = async () =>
    new Response(JSON.stringify({ code: 'bad', message: 'PRIVATE_TOKEN' }), {
      status: 400,
    });
  await assert.rejects(
    api.supabase('/rest/v1/x'),
    (e) => e.status === 400 && !e.message.includes('PRIVATE_TOKEN'),
  );
});
test('missing migration is service unavailable', async () => {
  fetchImpl = async () =>
    new Response(
      JSON.stringify({ code: 'PGRST205', message: 'table missing' }),
      { status: 404 },
    );
  await assert.rejects(api.supabase('/rest/v1/x'), (e) => e.status === 503);
});
test('network timeout is safe 504', async () => {
  fetchImpl = async () => {
    throw new Error('PRIVATE_INTERNAL');
  };
  await assert.rejects(
    api.supabase('/rest/v1/x'),
    (e) => e.status === 504 && !e.message.includes('PRIVATE_INTERNAL'),
  );
});
test('malformed URL and URL credentials rejected as configuration error', async () => {
  for (const url of [
    'not-a-url',
    'http://example.com',
    'https://u:p@example.com',
    'https://example.com/path',
  ]) {
    context.process.env.SUPABASE_URL = url;
    await assert.rejects(api.supabase('/rest/v1/x'), (e) => e.status === 503);
  }
  context.process.env.SUPABASE_URL = 'https://example.supabase.co';
});
test('unauthenticated user rejected before database access', async () => {
  await assert.rejects(api.requireUser(), (e) => e.status === 401);
});
test('user identity is validated using session against provider', async () => {
  cookieData.set('gotgot-session', 'session-token');
  fetchImpl = async (url, init) => {
    assert.equal(url, 'https://example.supabase.co/auth/v1/user');
    assert.equal(init.headers.get('Authorization'), 'Bearer session-token');
    return new Response(
      JSON.stringify({
        id: '79a34768-1827-4678-ac68-5275bab74294',
        email: 'test@example.test',
      }),
    );
  };
  assert.equal(
    (await api.requireUser()).user.id,
    '79a34768-1827-4678-ac68-5275bab74294',
  );
});
test('CSRF origin required and exact origin enforced', async () => {
  api.assertOrigin(
    new Request('https://site.test/api/account', {
      headers: { origin: 'https://site.test' },
    }),
  );
  for (const origin of [
    undefined,
    'https://evil.test',
    'https://site.test.evil.test',
  ]) {
    assert.throws(
      () =>
        api.assertOrigin(
          new Request('https://site.test/api/account', {
            headers: origin ? { origin } : {},
          }),
        ),
      (e) => e.status === 403,
    );
  }
});
test('JSON parsing and strict body byte limit', async () => {
  assert.equal(
    (
      await api.body(
        new Request('https://x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"ok":true}',
        }),
      )
    ).ok,
    true,
  );
  await assert.rejects(
    api.body(
      new Request('https://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a: '한'.repeat(3000) }),
      }),
    ),
    (e) => e.status === 413,
  );
  await assert.rejects(
    api.body(
      new Request('https://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    ),
    (e) => e.status === 400,
  );
  await assert.rejects(
    api.body(new Request('https://x', { method: 'POST', body: '{}' })),
    (e) => e.status === 415,
  );
});
test('unexpected error response never leaks internals', async () => {
  const result = api.failure(new Error('PRIVATE_TOKEN'));
  assert.equal(result.status, 500);
  assert.equal((await result.text()).includes('PRIVATE_TOKEN'), false);
});

test('Auth provider errors with numeric HTTP code use safe known error_code messages', async () => {
  fetchImpl = async () =>
    new Response(
      JSON.stringify({
        code: 400,
        error_code: 'email_not_confirmed',
        msg: 'PRIVATE_PROVIDER_DETAIL',
      }),
      { status: 400 },
    );
  await assert.rejects(
    api.supabase('/auth/v1/token?grant_type=password'),
    (e) => e.status === 403 && !e.message.includes('PRIVATE_PROVIDER_DETAIL'),
  );
  fetchImpl = async () =>
    new Response(
      JSON.stringify({ code: 400, error_code: 'invalid_credentials' }),
      { status: 400 },
    );
  await assert.rejects(
    api.supabase('/auth/v1/token?grant_type=password'),
    (e) => e.status === 400 && e.message.includes('비밀번호'),
  );
});

test('missing configuration returns 503 without making a network call', async () => {
  const existing = context.process.env.SUPABASE_PUBLISHABLE_KEY;
  delete context.process.env.SUPABASE_PUBLISHABLE_KEY;
  fetchImpl = async () => {
    throw new Error('network must not be called');
  };
  await assert.rejects(
    api.supabase('/rest/v1/activities'),
    (e) => e.status === 503,
  );
  context.process.env.SUPABASE_PUBLISHABLE_KEY = existing;
});
