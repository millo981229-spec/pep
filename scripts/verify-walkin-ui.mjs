import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const dependencyRoot =
  process.env.BROWSER_TEST_DEPS ||
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
const baseUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const places = JSON.parse(
  await readFile(new URL('../src/lib/checkin-places.json', import.meta.url)),
);
const records = JSON.parse(
  await readFile(new URL('../src/lib/regional-catalog.json', import.meta.url)),
);
const shelters = records.filter((record) =>
  record.id.startsWith('guide-animal-welfare-'),
);
assert.ok(shelters.length >= 8);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
});
try {
  await mkdir('docs/evidence/walkin-rewards', { recursive: true });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      geolocation: {
        latitude: places[0].latitude,
        longitude: places[0].longitude,
      },
      permissions: ['geolocation'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/explore`);
    await page
      .getByRole('button', { name: '유기견 보호센터', exact: true })
      .click();
    await page.waitForFunction(
      (count) => document.querySelectorAll('.activity-card').length === count,
      shelters.length,
    );
    await page.locator('.card-title').first().click();
    assert.equal(
      await page.getByRole('button', { name: '현재 위치로 인증하기' }).count(),
      0,
    );
    await page
      .getByText(/봉사·입양은 센터 상담과 신청 조건 확인이 필요/)
      .waitFor();
    await page.screenshot({
      path: `docs/evidence/walkin-rewards/shelter-${width}.png`,
    });
    await page.keyboard.press('Escape');
    await page.goto(`${baseUrl}/rewards`);
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll('.gps-place-picker option').length === count,
      places.length,
    );
    await page.screenshot({
      path: `docs/evidence/walkin-rewards/rewards-${width}.png`,
    });
    await context.close();
    assert.deepEqual(errors, []);
    console.log(
      `✔ ${width}px 보호센터 필터·예약조건 안내·자동 적립 제외·공공 산책 목록`,
    );
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    geolocation: {
      latitude: places[0].latitude,
      longitude: places[0].longitude,
    },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/my`);
  await page.getByRole('button', { name: '로그인하기', exact: true }).click();
  await page.getByRole('button', { name: '처음이신가요? 회원가입' }).click();
  const username = `산책검증${Date.now().toString().slice(-8)}`;
  await page.getByLabel('아이디').fill(username);
  await page.getByLabel('비밀번호').fill('산책-검증용-안전한-비밀번호-2026');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByText(`@${username}`, { exact: true }).waitFor();
  await page.goto(`${baseUrl}/rewards`);
  await page.getByRole('button', { name: '인증 장소 열기' }).click();
  await page.getByRole('button', { name: '현재 위치로 인증하기' }).click();
  const completed = page.getByRole('button', {
    name: '인증·적립 완료',
    exact: true,
  });
  await completed.waitFor();
  assert.equal(await completed.isDisabled(), true);
  await page.keyboard.press('Escape');
  await page.goto(`${baseUrl}/my`);
  await page.getByRole('button', { name: '방문 기록', exact: true }).click();
  await page.locator('.card-title', { hasText: places[0].title }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '인증·적립 완료', exact: true })
      .isDisabled(),
    true,
  );
  await page.keyboard.press('Escape');
  await page.goto(`${baseUrl}/rewards`);
  await page
    .locator('.gps-place-picker select')
    .selectOption(places[1].activityId);
  await page.getByRole('button', { name: '인증 장소 열기' }).click();
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      window.pendingLocationSuccess = success;
    };
  });
  await page.getByRole('button', { name: '현재 위치로 인증하기' }).click();
  await page.keyboard.press('Escape');
  await page
    .locator('.gps-place-picker select')
    .selectOption(places[2].activityId);
  await page.getByRole('button', { name: '인증 장소 열기' }).click();
  await page.locator('#modal-title', { hasText: places[2].title }).waitFor();
  await page.evaluate(
    (place) =>
      window.pendingLocationSuccess({
        coords: {
          latitude: place.latitude,
          longitude: place.longitude,
          accuracy: 10,
        },
        timestamp: Date.now(),
      }),
    places[1],
  );
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator('.gps-check-result').count(),
    0,
    '지난 장소의 GPS 응답이 다른 상세 화면에 표시되면 안 됩니다.',
  );
  await page.keyboard.press('Escape');
  await context.setGeolocation({
    latitude: places[2].latitude,
    longitude: places[2].longitude,
  });
  await page.reload();
  await page
    .locator('.gps-place-picker select')
    .selectOption(places[2].activityId);
  await page.getByRole('button', { name: '인증 장소 열기' }).click();
  await page.route('**/api/check-in', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: '로그인이 만료되었습니다.' }),
    }),
  );
  await page.getByRole('button', { name: '현재 위치로 인증하기' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: '로그인이 만료되었습니다. 다시 로그인해 주세요.' })
    .waitFor();
  assert.equal(await page.locator('.profile-summary').count(), 0);
  assert.equal(
    await page.getByRole('button', { name: '로그인', exact: true }).count(),
    2,
  );
  await context.close();
  console.log(
    '✔ 실제 로그인·1회 적립·MY 완료 상태·늦은 GPS 응답 무시·401 재로그인 복구',
  );
} finally {
  await browser.close();
}
