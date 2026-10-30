import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createExpressApp } = require('../server.js');
const checkInPlaces = require('../src/lib/checkin-places.json');

const directory = await mkdtemp(path.join(tmpdir(), 'gotgot-auth-'));
const storePath = path.join(directory, 'auth-store.json');
const username = '테스트사용자';
const password = '안전한-테스트-비밀번호-2026';
const fixedNow = new Date('2026-10-30T03:00:00.000Z').getTime();
const checkInPlace = checkInPlaces.find(
  (place) =>
    place.activityId === 'guide-festival-2862358' &&
    place.startDate <= '2026-10-30' &&
    place.endDate >= '2026-10-30',
);
assert.ok(checkInPlace, 'GPS 인증 테스트 장소가 필요합니다.');

async function start() {
  const { app } = createExpressApp({
    storePath,
    secureCookies: false,
    now: () => fixedNow,
    nextHandler: (_request, response) => response.status(404).end(),
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stop(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function request(baseUrl, pathname, { body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined
        ? {}
        : {
            'Content-Type': 'application/json',
            Origin: baseUrl,
          }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get('set-cookie');
  return {
    status: response.status,
    data: await response.json(),
    cookie: setCookie?.split(';')[0] || null,
    setCookie,
  };
}

let running = await start();
try {
  const anonymous = await request(running.baseUrl, '/api/session');
  assert.equal(anonymous.status, 200);
  assert.deepEqual(anonymous.data, { configured: true, user: null });

  const weak = await request(running.baseUrl, '/api/register', {
    body: { username: 'ab', password: 'short' },
  });
  assert.equal(weak.status, 400);

  const registered = await request(running.baseUrl, '/api/register', {
    body: { username, password },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.username, username);
  assert.ok(registered.cookie?.startsWith('gotgot-session='));
  assert.match(registered.setCookie, /HttpOnly/i);
  assert.match(registered.setCookie, /SameSite=Lax/i);

  const persisted = await request(running.baseUrl, '/api/session', {
    cookie: registered.cookie,
  });
  assert.equal(persisted.data.user.username, username);

  const duplicate = await request(running.baseUrl, '/api/register', {
    body: { username, password },
  });
  assert.equal(duplicate.status, 409);

  const rawStore = await readFile(storePath, 'utf8');
  assert.equal(rawStore.includes(password), false);
  assert.equal(rawStore.includes(registered.cookie.split('=')[1]), false);
  const parsedStore = JSON.parse(rawStore);
  assert.equal(parsedStore.users[0].password.algorithm, 'scrypt');
  assert.ok(parsedStore.users[0].password.salt);
  assert.ok(parsedStore.users[0].password.hash);

  const wrong = await request(running.baseUrl, '/api/login', {
    body: { username, password: '틀린-비밀번호-충분히-길게-2026' },
  });
  assert.equal(wrong.status, 401);

  const loggedIn = await request(running.baseUrl, '/api/login', {
    body: { username, password },
  });
  assert.equal(loggedIn.status, 200);
  assert.ok(loggedIn.cookie);

  const account = await request(running.baseUrl, '/api/account', {
    cookie: loggedIn.cookie,
  });
  assert.equal(account.status, 200);
  assert.equal(account.data.profile[0].display_name, username);

  const farAway = await request(running.baseUrl, '/api/check-in', {
    body: {
      activityId: checkInPlace.activityId,
      latitude: checkInPlace.latitude + 0.1,
      longitude: checkInPlace.longitude,
      accuracy: 12,
      capturedAt: fixedNow,
    },
    cookie: loggedIn.cookie,
  });
  assert.equal(farAway.status, 422);

  const checkedIn = await request(running.baseUrl, '/api/check-in', {
    body: {
      activityId: checkInPlace.activityId,
      latitude: checkInPlace.latitude,
      longitude: checkInPlace.longitude,
      accuracy: 12,
      capturedAt: fixedNow,
    },
    cookie: loggedIn.cookie,
  });
  assert.equal(checkedIn.status, 201);
  assert.equal(checkedIn.data.checkIn.reward, checkInPlace.reward);
  assert.equal(checkedIn.data.checkIn.distanceMeters, 0);

  const duplicateCheckIn = await request(running.baseUrl, '/api/check-in', {
    body: {
      activityId: checkInPlace.activityId,
      latitude: checkInPlace.latitude,
      longitude: checkInPlace.longitude,
      accuracy: 12,
      capturedAt: fixedNow,
    },
    cookie: loggedIn.cookie,
  });
  assert.equal(duplicateCheckIn.status, 409);

  const rewardedAccount = await request(running.baseUrl, '/api/account', {
    cookie: loggedIn.cookie,
  });
  assert.equal(rewardedAccount.data.profile[0].balance, checkInPlace.reward);
  assert.equal(rewardedAccount.data.participations.length, 1);
  assert.equal(rewardedAccount.data.ledger[0].amount, checkInPlace.reward);
  const storeAfterCheckIn = await readFile(storePath, 'utf8');
  assert.equal(storeAfterCheckIn.includes('"latitude"'), false);
  assert.equal(storeAfterCheckIn.includes('"longitude"'), false);

  await stop(running.server);
  running = await start();
  const afterRestart = await request(running.baseUrl, '/api/session', {
    cookie: loggedIn.cookie,
  });
  assert.equal(afterRestart.data.user.username, username);

  const loggedOut = await request(running.baseUrl, '/api/logout', {
    body: {},
    cookie: loggedIn.cookie,
  });
  assert.equal(loggedOut.status, 200);
  const ended = await request(running.baseUrl, '/api/session', {
    cookie: loggedIn.cookie,
  });
  assert.equal(ended.data.user, null);

  console.log(
    '✔ 회원가입·scrypt 저장·로그인·HttpOnly 쿠키·GPS 거리/중복/적립·좌표 비저장·재시작 세션·로그아웃',
  );
} finally {
  if (running.server.listening) await stop(running.server);
}
