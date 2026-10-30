import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot =
  process.env.BROWSER_TEST_DEPS ||
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
const baseUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const records = JSON.parse(
  await readFile(new URL('../src/lib/regional-catalog.json', import.meta.url)),
);
const titles = ['푸른수목원', '검단선사박물관', '화명생태공원', '마이산 탑사'];
const heldIds = ['guide-festival-2995190', 'guide-sports-jeonbuk-2'];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
});
try {
  await mkdir('docs/evidence/district-coverage', { recursive: true });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const title of titles) {
      const expected = records.find((record) => record.title === title);
      assert.ok(expected, `${title}: 검증 장소 누락`);
      await page.goto(`${baseUrl}/explore?q=${encodeURIComponent(title)}`);
      await page.locator('.card-title', { hasText: title }).first().click();
      const href = await page
        .getByRole('link', { name: '지도에서 위치 찾기' })
        .getAttribute('href');
      const query = decodeURIComponent(
        new URL(href).pathname.slice('/p/search/'.length),
      );
      assert.equal(query, expected.reference.location.query);
      await page
        .locator('.reference-info dl > div')
        .filter({ has: page.getByText('지도 검색 장소', { exact: true }) })
        .getByText(query, { exact: true })
        .waitFor();
      assert.equal(await page.getByText(/네이버 지도 대조 ·/).count(), 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      if (title === '검단선사박물관') {
        await page.screenshot({
          path: `docs/evidence/district-coverage/place-link-${width}.png`,
        });
      }
      await page.keyboard.press('Escape');
    }
    for (const id of heldIds) {
      const expected = records.find((record) => record.id === id);
      await page.goto(
        `${baseUrl}/explore?q=${encodeURIComponent(expected.title)}`,
      );
      await page.locator('.card-title', { hasText: expected.title }).click();
      assert.equal(
        await page.getByRole('link', { name: '지도에서 위치 찾기' }).count(),
        0,
      );
      assert.equal(
        await page
          .getByRole('button', { name: '위치 확인 중', exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await page
          .getByRole('button', { name: '현재 위치로 인증하기' })
          .count(),
        0,
      );
      await page.keyboard.press('Escape');
    }
    await page.goto(`${baseUrl}/rewards`);
    await page.locator('.offer-card').first().waitFor();
    assert.equal(await page.locator('.offer-card').count(), 15);
    assert.equal(
      await page
        .locator('.offer-filters button', { hasText: '교통·이동' })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `✔ ${width}px 신규 장소 검색·실제 장소명 지도 링크·미확인 표시·위치 보류/GPS 차단·교통 혜택 제거`,
    );
  }
} finally {
  await browser.close();
}
