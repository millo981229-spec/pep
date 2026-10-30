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
const otherUsername = '다른테스트사용자';
const password = '안전한-테스트-비밀번호-2026';
const fixedNow = new Date('2026-10-30T03:00:00.000Z').getTime();
const checkInPlace = checkInPlaces.find(
  (place) => place.activityId === 'walk-seoul-danghyeoncheon',
);
assert.ok(checkInPlace, '예약 없는 산책 방문 인증 테스트 장소가 필요합니다.');
assert.equal(checkInPlace.accessPolicy, 'walk-in');
assert.equal(checkInPlace.startDate, undefined);
assert.equal(checkInPlace.endDate, undefined);

const checkInBody = {
  activityId: checkInPlace.activityId,
  latitude: checkInPlace.latitude,
  longitude: checkInPlace.longitude,
  accuracy: 12,
  capturedAt: fixedNow,
};

async function start() {
  const { app } = createExpressApp({
    storePath,
    secureCookies: false,
    now: () => fixedNow,
    nextHandler: (_request, response) => response.status(404).end(),
  });
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.on('error', reject);
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
  const anonymousCheckIn = await request(running.baseUrl, '/api/check-in', {
    body: checkInBody,
  });
  assert.equal(anonymousCheckIn.status, 401);

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
  const otherAccount = await request(running.baseUrl, '/api/register', {
    body: { username: otherUsername, password },
  });
  assert.equal(otherAccount.status, 201);

  const account = await request(running.baseUrl, '/api/account', {
    cookie: loggedIn.cookie,
  });
  assert.equal(account.status, 200);
  assert.equal(account.data.profile[0].display_name, username);

  // A caller cannot turn a removed event into a walk-in place by submitting
  // a fake access policy or reward. Only the server's canonical list is used.
  for (const activityId of ['guide-sports-2371631', 'guide-festival-2862358']) {
    const removedEvent = await request(running.baseUrl, '/api/check-in', {
      body: {
        ...checkInBody,
        activityId,
        accessPolicy: 'walk-in',
        reward: 999999,
      },
      cookie: loggedIn.cookie,
    });
    assert.equal(removedEvent.status, 404);
  }

  const poorAccuracy = await request(running.baseUrl, '/api/check-in', {
    body: { ...checkInBody, accuracy: checkInPlace.maxAccuracyMeters + 1 },
    cookie: loggedIn.cookie,
  });
  assert.equal(poorAccuracy.status, 422);
  const farAway = await request(running.baseUrl, '/api/check-in', {
    body: { ...checkInBody, latitude: checkInPlace.latitude + 0.1 },
    cookie: loggedIn.cookie,
  });
  assert.equal(farAway.status, 422);

  // Two requests arrive before either completes. Only one balance/ledger entry
  // may be created, and client-supplied user/region/reward cannot override it.
  const doubleCheckIn = await Promise.all(
    [0, 1].map(() =>
      request(running.baseUrl, '/api/check-in', {
        body: {
          ...checkInBody,
          accessPolicy: 'walk-in',
          reward: 999999,
          region: 'jeju',
          userId: otherAccount.data.user.id,
        },
        cookie: loggedIn.cookie,
      }),
    ),
  );
  assert.deepEqual(
    doubleCheckIn.map((response) => response.status).sort(),
    [201, 409],
  );
  const checkedIn = doubleCheckIn.find((response) => response.status === 201);
  assert.equal(checkedIn.data.checkIn.reward, checkInPlace.reward);
  assert.equal(checkedIn.data.checkIn.distanceMeters, 0);

  const rewardedAccount = await request(running.baseUrl, '/api/account', {
    cookie: loggedIn.cookie,
  });
  assert.equal(rewardedAccount.data.profile[0].balance, checkInPlace.reward);
  assert.equal(rewardedAccount.data.participations.length, 1);
  assert.equal(
    rewardedAccount.data.participations[0].region,
    checkInPlace.region,
  );
  assert.equal(rewardedAccount.data.ledger.length, 1);
  assert.equal(rewardedAccount.data.ledger[0].amount, checkInPlace.reward);
  const activitySnapshot = rewardedAccount.data.participations[0].activities;
  assert.equal(activitySnapshot.id, checkInPlace.activityId);
  assert.equal(activitySnapshot.title, checkInPlace.title);
  assert.ok(activitySnapshot.reference.address);
  assert.ok(activitySnapshot.reference.location.query.includes('당현천'));
  assert.equal(activitySnapshot.date.includes('undefined'), false);
  const storeAfterCheckIn = await readFile(storePath, 'utf8');
  assert.equal(storeAfterCheckIn.includes('"latitude"'), false);
  assert.equal(storeAfterCheckIn.includes('"longitude"'), false);

  const otherHistory = await request(
    running.baseUrl,
    `/api/account?userId=${registered.data.user.id}`,
    { cookie: otherAccount.cookie },
  );
  assert.equal(otherHistory.status, 200);
  assert.equal(otherHistory.data.profile[0].display_name, otherUsername);
  assert.equal(otherHistory.data.profile[0].balance, 0);
  assert.deepEqual(otherHistory.data.participations, []);
  assert.deepEqual(otherHistory.data.ledger, []);

  await stop(running.server);
  running = await start();
  const afterRestart = await request(running.baseUrl, '/api/session', {
    cookie: loggedIn.cookie,
  });
  assert.equal(afterRestart.data.user.username, username);
  const persistedAccount = await request(running.baseUrl, '/api/account', {
    cookie: loggedIn.cookie,
  });
  assert.equal(persistedAccount.data.profile[0].balance, checkInPlace.reward);
  assert.equal(persistedAccount.data.participations.length, 1);
  assert.equal(persistedAccount.data.ledger.length, 1);

  const loggedOut = await request(running.baseUrl, '/api/logout', {
    body: {},
    cookie: loggedIn.cookie,
  });
  assert.equal(loggedOut.status, 200);
  const ended = await request(running.baseUrl, '/api/session', {
    cookie: loggedIn.cookie,
  });
  assert.equal(ended.data.user, null);
  const afterLogout = await request(running.baseUrl, '/api/check-in', {
    body: checkInBody,
    cookie: loggedIn.cookie,
  });
  assert.equal(afterLogout.status, 401);

  console.log(
    '✔ 회원가입·scrypt·HttpOnly 세션·예약/행사 적립 제외·GPS 거리/오차·동시 중복 방지·서버 적립금·MY 장소·타인 기록 차단·좌표 비저장·재시작 보존·로그아웃 차단',
  );
} finally {
  if (running.server.listening) await stop(running.server);
}
