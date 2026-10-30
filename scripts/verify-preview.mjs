#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const catalogRecords = JSON.parse(
  await readFile(new URL('../src/lib/regional-catalog.json', import.meta.url)),
);

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
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  geolocation: { latitude: 37.6494434001, longitude: 127.0656870873 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
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
  .locator('.search-result-summary', { hasText: '“진주” 검색 결과' })
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
  (count) => document.querySelectorAll('.activity-card').length === count,
  Math.min(
    24,
    catalogRecords.filter((record) => record.category === '공연·음악').length,
  ),
);

await page.goto(`${previewUrl}#/map`);
await page.locator('.dokdo-hit-area').click();
await page.locator('.map-activity-row', { hasText: '독도' }).waitFor();
await page.screenshot({
  path: '/workspace/곳곳-독도-지도.png',
  fullPage: true,
});

await page.goto(`${previewUrl}#/rewards`);
await page.waitForFunction(
  () => document.querySelectorAll('.offer-card').length === 15,
);
await page.screenshot({
  path: '/workspace/곳곳-마일리지-교환소.png',
  fullPage: true,
});
await page.locator('.offer-filters button', { hasText: '스포츠·레저' }).click();
await page.waitForFunction(
  () => document.querySelectorAll('.offer-card').length === 2,
);
await page.locator('.offer-card').first().getByRole('button').click();
await page.locator('.coupon-pass').waitFor();
if (await page.locator('.offer-demo-label').count())
  throw new Error('교환소 카드에 DEMO 좌측 상단 표기가 남아 있습니다.');
await page.getByRole('button', { name: '직원 확인' }).click();
await page
  .getByRole('heading', { name: '직원 확인 처리를 하시겠습니까?' })
  .waitFor();
await page
  .locator('.coupon-confirm-dialog')
  .getByRole('button', { name: '확인' })
  .click();
await page.getByRole('button', { name: '쿠폰 사용완료' }).waitFor();
await page.screenshot({
  path: '/workspace/곳곳-쿠폰-사용완료.png',
  fullPage: true,
});
await page.locator('.modal .icon-button').click();
await page.getByRole('button', { name: '인증 장소 열기' }).click();
await page.locator('#modal-title', { hasText: '노원달빛산책' }).waitFor();
await page.getByRole('button', { name: '현재 위치로 인증하기' }).click();
await page.getByText(/현장 위치가 확인되었습니다/).waitFor();
await page.locator('.modal .icon-button').click();

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 37.6494434001, longitude: 127.0656870873 },
  permissions: ['geolocation'],
});
const mobilePage = await mobileContext.newPage();
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
await mobilePage.goto(`${previewUrl}#/rewards`);
await mobilePage.waitForFunction(
  () => document.querySelectorAll('.offer-card').length === 15,
);
if (
  await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
)
  throw new Error('390px 마일리지 교환소 화면에 가로 넘침이 있습니다.');
await mobilePage.screenshot({
  path: '/workspace/곳곳-마일리지-교환소-모바일.png',
});
await mobilePage.locator('.offer-card').first().getByRole('button').click();
await mobilePage.locator('.coupon-pass').waitFor();
if (
  await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
)
  throw new Error('390px 쿠폰 화면에 가로 넘침이 있습니다.');
await mobilePage.getByRole('button', { name: '직원 확인' }).click();
await mobilePage.locator('.coupon-confirm-dialog').waitFor();
await mobilePage.screenshot({
  path: '/workspace/곳곳-쿠폰-직원확인-모바일.png',
});
await mobilePage.close();
await mobileContext.close();
await context.close();

if (errors.length) throw new Error(`미리보기 실행 오류: ${errors.join(' | ')}`);
await browser.close();
console.log(
  'Preview navigation: photos, search, activity category, GPS, coupon staff confirmation, mobile passed',
);
