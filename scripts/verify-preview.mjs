#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const dependencyRoot =
  process.env.BROWSER_TEST_DEPS ||
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
const previewTarget = process.argv[2] || '/workspace/곳곳-웹-미리보기.html';
const previewUrl = /^https?:\/\//.test(previewTarget)
  ? previewTarget
  : pathToFileURL(path.resolve(previewTarget)).href;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(previewUrl);
await page.waitForFunction(
  () =>
    document.querySelectorAll('.home-photo-card').length === 4 &&
    [...document.querySelectorAll('.home-photo-card img')].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
);
const homePhotoSources = await page
  .locator('.home-photo-card img')
  .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
if (new Set(homePhotoSources).size !== 4)
  throw new Error('홈 지역 실사 4장이 서로 다른 사진으로 표시되지 않습니다.');
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw new Error('PC 홈 화면에 가로 넘침이 있습니다.');
await page.locator('.activity-card').first().waitFor();
const homeCardImages = page.locator('.activity-card img');
for (let index = 0; index < (await homeCardImages.count()); index += 1) {
  await homeCardImages.nth(index).scrollIntoViewIfNeeded();
}
await page.waitForFunction(() =>
  [...document.querySelectorAll('.activity-card img')].every(
    (image) => image.complete && image.naturalWidth > 0,
  ),
);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({
  path: '/workspace/곳곳-실사확대-홈.png',
  fullPage: true,
});
await page.locator('.home-photo-card', { hasText: '경북 상주' }).click();
await page.waitForURL(/#\/explore\?q=/);
await page
  .locator('.search-result-summary', { hasText: '“상주” 검색 결과' })
  .waitFor();

await page.goto(previewUrl);
await page.locator('.header-search input').fill('진주');
await page
  .locator('.header-suggestions .suggestion-title', {
    hasText: '진주남강유등축제',
  })
  .waitFor();
await page.locator('.header-search-trigger').click();
await page
  .locator('.search-result-summary', { hasText: '“진주” 검색 결과 1개' })
  .waitFor();
await page.locator('.card-title', { hasText: '진주남강유등축제' }).waitFor();
if (await page.locator('.hero').count()) {
  throw new Error('돋보기 검색 후 홈 배너가 사라지지 않았습니다.');
}
await page.screenshot({
  path: '/workspace/곳곳-진주-검색결과.png',
  fullPage: true,
});

await page.goto(previewUrl);
await page.locator('.header-search input').fill('진주');
await page
  .locator('.header-suggestions .suggestion-title', {
    hasText: '진주남강유등축제',
  })
  .waitFor();
await page
  .locator('.header-suggestion-item', { hasText: '진주남강유등축제' })
  .click();
await page.locator('#modal-title', { hasText: '진주남강유등축제' }).waitFor();
await page.locator('.modal .icon-button').click();

await page.goto(previewUrl);
await page.locator('.quick-item', { hasText: '공연·음악' }).click();
await page.waitForURL(/#\/explore\?category=/);
await page
  .locator('.category-tabs button.selected', { hasText: '공연·음악' })
  .waitFor();
await page.waitForFunction(
  () => document.querySelectorAll('.activity-card').length === 4,
);

await page.goto(`${previewUrl}#/map`);
await page.locator('.dokdo-hit-area').click();
await page.locator('.map-activity-row', { hasText: '독도' }).waitFor();
await page.screenshot({
  path: '/workspace/곳곳-독도-지도.png',
  fullPage: true,
});

const mobilePage = await browser.newPage({
  viewport: { width: 390, height: 844 },
});
await mobilePage.goto(previewUrl);
await mobilePage.waitForFunction(
  () =>
    document.querySelectorAll('.home-photo-card').length === 4 &&
    [...document.querySelectorAll('.home-photo-card img')].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
);
await mobilePage.locator('.activity-card').first().waitFor();
const mobileCardImages = mobilePage.locator('.activity-card img');
for (let index = 0; index < (await mobileCardImages.count()); index += 1) {
  await mobileCardImages.nth(index).scrollIntoViewIfNeeded();
}
await mobilePage.waitForFunction(() =>
  [...document.querySelectorAll('.activity-card img')].every(
    (image) => image.complete && image.naturalWidth > 0,
  ),
);
await mobilePage.evaluate(() => window.scrollTo(0, 0));
if (
  await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
)
  throw new Error('390px 홈 화면에 가로 넘침이 있습니다.');
await mobilePage.screenshot({
  path: '/workspace/곳곳-실사확대-모바일.png',
  fullPage: true,
});
await mobilePage.close();

if (errors.length) throw new Error(`미리보기 실행 오류: ${errors.join(' | ')}`);
await browser.close();
console.log(
  'Preview navigation: four photos, photo search, direct search, suggestion, category, mobile passed',
);
