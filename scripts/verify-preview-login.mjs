import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createExpressApp } = require('../server.js');
const browserRequire = createRequire(
  path.join(
    process.env.BROWSER_TEST_DEPS ||
      '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules',
    'package.json',
  ),
);
const { chromium } = browserRequire('playwright');
const directory = await mkdtemp(path.join(tmpdir(), 'gotgot-preview-login-'));
const html = await readFile(new URL('../index.html', import.meta.url));
const { app } = createExpressApp({
  storePath: path.join(directory, 'auth-store.json'),
  secureCookies: false,
  nextHandler: (request, response) =>
    request.path === '/'
      ? response.type('html').send(html)
      : response.status(404).end(),
});
const server = await new Promise((resolve, reject) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  listener.once('error', reject);
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
});
try {
  const evidence =
    process.env.EVIDENCE_DIR || path.join(directory, 'screenshots');
  await mkdir(evidence, { recursive: true });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page
      .getByRole('link', { name: '마이 · 체험', exact: true })
      .waitFor();
    assert.equal(await page.locator('input[name="password"]').count(), 0);
    await page.goto(`${baseUrl}/#/my`);
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
    assert.equal(
      await page.locator('.profile-summary > strong').innerText(),
      '10,000 P',
    );
    await page.reload();
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
    assert.equal(
      await page.locator('.profile-summary > strong').innerText(),
      '10,000 P',
    );
    await page
      .getByRole('button', { name: '마일리지 내역', exact: true })
      .click();
    assert.equal(await page.locator('.saved-row').count(), 1);
    await page.getByText('체험용 마일리지 충전', { exact: true }).waitFor();
    await page.getByText('+10,000 P', { exact: true }).waitFor();
    await page.goto(`${baseUrl}/#/rewards`);
    await page
      .locator('.balance-banner strong', { hasText: '10,000' })
      .waitFor();
    assert.equal(
      await page.locator('.balance-banner strong').innerText(),
      '10,000 P',
    );
    await page.reload();
    await page
      .locator('.balance-banner strong', { hasText: '10,000' })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: path.join(evidence, `my-${width}.png`) });

    // Browser-only preview state must grant no server-side identity or access.
    assert.equal(
      (await (await context.request.get(`${baseUrl}/api/session`)).json()).user,
      null,
    );
    assert.equal(
      (await context.request.get(`${baseUrl}/api/account`)).status(),
      401,
    );
    assert.equal(
      (
        await context.request.post(`${baseUrl}/api/check-in`, { data: {} })
      ).status(),
      401,
    );
    assert.equal(
      (
        await context.request.post(`${baseUrl}/api/preview-login`, { data: {} })
      ).status(),
      404,
    );
    assert.equal(
      (
        await context.request.post(`${baseUrl}/api/preview-coupon-use`, {
          data: {},
        })
      ).status(),
      404,
    );
    assert.equal(
      (await context.cookies()).some(
        (cookie) => cookie.name === 'gotgot-session',
      ),
      false,
    );

    await page.goto(`${baseUrl}/#/explore`);
    await page
      .getByRole('link', { name: '마이 · 체험', exact: true })
      .waitFor();
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page.getByRole('button', { name: '로그인', exact: true }).waitFor();
    await page.goto(`${baseUrl}/#/my`);
    await page
      .getByRole('button', { name: '로그인하기', exact: true })
      .waitFor();
    await page.getByRole('button', { name: '로그인하기', exact: true }).click();
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
    assert.equal(
      await page.locator('.profile-summary > strong').innerText(),
      '10,000 P',
    );
    await page
      .getByRole('button', { name: '마일리지 내역', exact: true })
      .click();
    assert.equal(await page.locator('.saved-row').count(), 1);
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page
      .getByRole('button', { name: '로그인하기', exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole('button', { name: '로그인하기', exact: true })
      .waitFor();
    await page.getByRole('button', { name: '로그인하기', exact: true }).click();
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
    const offers = await page.evaluate(
      async () => (await (await fetch('/api/catalog')).json()).offers,
    );
    const food = offers.find((offer) => offer.cost === 1200);
    const large = offers.find((offer) => offer.cost === 6000);
    const expensive = offers.find((offer) => offer.cost === 4500);
    assert.ok(food && large && expensive);
    await page.goto(`${baseUrl}/#/rewards`);
    const openFood = () =>
      page
        .locator('.offer-card', { hasText: food.title })
        .getByRole('button')
        .click();
    const confirmUse = async () => {
      await page
        .getByRole('button', { name: '직원 확인', exact: true })
        .click();
      await page
        .locator('.coupon-confirm-dialog')
        .getByRole('button', { name: '확인', exact: true })
        .click();
    };
    await openFood();
    await page.getByRole('button', { name: '직원 확인', exact: true }).click();
    await page
      .locator('.coupon-confirm-dialog')
      .getByRole('button', { name: '취소', exact: true })
      .click();
    await page.keyboard.press('Escape');
    assert.equal(
      await page.locator('.balance-banner strong').innerText(),
      '10,000 P',
    );
    await openFood();
    await confirmUse();
    await page
      .getByRole('button', { name: '쿠폰 사용완료', exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(evidence, `coupon-used-${width}.png`),
    });
    await page.keyboard.press('Escape');
    assert.equal(
      await page.locator('.balance-banner strong').innerText(),
      '8,800 P',
    );
    await page.reload();
    await page
      .locator('.balance-banner strong', { hasText: '8,800' })
      .waitFor();
    await openFood();
    assert.equal(
      await page
        .getByRole('button', { name: '쿠폰 사용완료', exact: true })
        .isDisabled(),
      true,
    );
    await page.keyboard.press('Escape');
    const duplicate = await page.evaluate(async (offerId) => {
      const request = () =>
        fetch('/api/preview-coupon-use', {
          method: 'POST',
          body: JSON.stringify({ offerId }),
        });
      return (await Promise.all([request(), request()])).map(
        (response) => response.status,
      );
    }, large.id);
    assert.deepEqual(duplicate.sort(), [200, 201]);
    const replay = await page.evaluate(
      async (offerId) =>
        (
          await fetch('/api/preview-coupon-use', {
            method: 'POST',
            body: JSON.stringify({ offerId }),
          })
        ).status,
      food.id,
    );
    assert.equal(replay, 200);
    await page.reload();
    await page
      .locator('.balance-banner strong', { hasText: '2,800' })
      .waitFor();
    await page
      .locator('.offer-card', { hasText: expensive.title })
      .getByRole('button')
      .click();
    await confirmUse();
    await page
      .getByRole('alert')
      .filter({ hasText: '마일리지가 부족합니다.' })
      .waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: '쿠폰 사용완료', exact: true })
        .count(),
      0,
    );
    await page.keyboard.press('Escape');
    const invalid = await page.evaluate(
      async (offerId) =>
        (
          await fetch('/api/preview-coupon-use', {
            method: 'POST',
            body: JSON.stringify({ offerId, cost: 1 }),
          })
        ).status,
      expensive.id,
    );
    assert.equal(invalid, 400);
    await page.goto(`${baseUrl}/#/my`);
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
    assert.equal(
      await page.locator('.profile-summary > strong').innerText(),
      '2,800 P',
    );
    await page
      .getByRole('button', { name: '마일리지 내역', exact: true })
      .click();
    assert.equal(await page.locator('.saved-row').count(), 3);
    await page.getByText('-1,200 P', { exact: true }).waitFor();
    await page.getByText('-6,000 P', { exact: true }).waitFor();
    await page.getByRole('button', { name: '내 쿠폰함', exact: true }).click();
    assert.equal(await page.locator('.coupon-row:disabled').count(), 0);
    await page.locator('.coupon-row', { hasText: food.title }).click();
    assert.equal(
      await page
        .getByRole('button', { name: '쿠폰 사용완료', exact: true })
        .isDisabled(),
      true,
    );
    await page.getByText(/체험용 마일리지 1,200 P 차감 완료/).waitFor();
    const photo = await page.locator('.coupon-pass-photo').boundingBox();
    const image = await page.locator('.coupon-pass-photo img').boundingBox();
    assert.ok(photo && image && Math.abs(photo.height - image.height) <= 1);
    await page.screenshot({
      path: path.join(evidence, `coupon-history-${width}.png`),
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page.getByRole('button', { name: '로그인하기', exact: true }).click();
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
    assert.equal(
      await page.locator('.profile-summary > strong').innerText(),
      '2,800 P',
    );
    const storageFailure = await page.evaluate(
      async (offerId) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === 'gotgot.preview-wallet.v1')
            throw new DOMException('Storage full', 'QuotaExceededError');
          return original.call(this, key, value);
        };
        const response = await fetch('/api/preview-coupon-use', {
          method: 'POST',
          body: JSON.stringify({ offerId }),
        });
        Storage.prototype.setItem = original;
        return {
          status: response.status,
          account: await (await fetch('/api/account')).json(),
        };
      },
      offers.find((offer) => offer.cost === 1000).id,
    );
    assert.equal(storageFailure.status, 503);
    assert.equal(storageFailure.account.profile[0].balance, 2800);
    assert.equal(storageFailure.account.ledger.length, 3);
    assert.equal(storageFailure.account.coupons.length, 2);
    await page.goto(`${baseUrl}/#/recommend`);
    const unavailable = page.getByRole('button', {
      name: '맞춤 추천 준비 중',
      exact: true,
    });
    await unavailable.waitFor();
    assert.equal(await unavailable.isDisabled(), true);
    await page.screenshot({
      path: path.join(evidence, `ai-status-${width}.png`),
      fullPage: true,
    });
    await page
      .locator('.ai-availability-note')
      .getByRole('link', { name: '활동 둘러보기' })
      .click();
    await page.waitForURL(/#\/explore/);
    console.log(
      `✔ ${width}px 1,200P 사용 차감·취소 무차감·재열기/중복 요청 방지·잔액 부족·MY 내역·재로그인 유지·저장 실패 보호`,
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `✔ ${width}px 곳곳드림·MY 10,000P 표시·충전 내역 1건·새로고침/재로그인 중복 충전 없음·서버 권한 분리`,
    );
  }

  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page
    .getByText(
      '체험 로그인을 위해 브라우저의 사이트 저장 공간을 허용해 주세요.',
    )
    .waitFor();
  assert.equal(
    await page.getByRole('link', { name: '마이 · 체험', exact: true }).count(),
    0,
  );
  await context.close();
  console.log(`✔ 저장 공간 차단 시 오류 안내 · 화면 사진: ${evidence}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
