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
  const evidence = path.join(directory, 'screenshots');
  await mkdir(evidence);
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
    await page.reload();
    await page.getByRole('heading', { name: '체험 여행자님의 곳곳' }).waitFor();
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
    await page.reload();
    await page
      .getByRole('button', { name: '로그인하기', exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `✔ ${width}px 한 번 클릭 로그인·MY·새로고침/화면 이동 유지·로그아웃·서버 권한 분리`,
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
