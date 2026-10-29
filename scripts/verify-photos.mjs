import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot =
  process.env.BROWSER_TEST_DEPS ||
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
const baseUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const categoryFiles = {
  '문화·예술': 'culture-art.webp',
  '공연·음악': 'performance-music.webp',
  '전시·박물관': 'exhibition-museum.webp',
  '스포츠·레저': 'sports-leisure.webp',
  '자연·생태': 'nature-ecology.webp',
  '여행·관광': 'travel-tourism.webp',
  '축제·행사': 'festival-event.webp',
  '맛집·미식': 'food-gourmet.webp',
  '공예·원데이': 'craft-one-day.webp',
  '역사·전통': 'history-tradition.webp',
  '가족·키즈': 'family-kids.webp',
  '교육·배움': 'education-learning.webp',
  '봉사·커뮤니티': 'volunteer-community.webp',
  '웰니스·휴식': 'wellness-rest.webp',
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});

try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.home-photo-card').length === 4 &&
        [...document.querySelectorAll('.home-photo-card img')].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
    );
    const sources = await page
      .locator('.home-photo-card img')
      .evaluateAll((images) => images.map((image) => image.currentSrc));
    if (new Set(sources).size !== 4)
      throw new Error(`${width}px 지역 실사 사진이 중복됐습니다.`);
    const quickPhotoSources = await page
      .locator('.quick-item img')
      .evaluateAll((images) =>
        images.map((image) => decodeURIComponent(image.getAttribute('src'))),
      );
    if (
      quickPhotoSources.length !== 14 ||
      new Set(quickPhotoSources).size !== 14
    )
      throw new Error(`${width}px 홈에 카테고리 사진 14종이 없습니다.`);
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
    )
      throw new Error(`${width}px 홈 화면에 가로 넘침이 있습니다.`);
    await page.close();
  }

  const categoryPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await categoryPage.goto(`${baseUrl}/explore`, { waitUntil: 'networkidle' });
  for (const [category, filename] of Object.entries(categoryFiles)) {
    await categoryPage
      .getByRole('group', { name: '활동 분야' })
      .getByRole('button', { name: category, exact: true })
      .click();
    await categoryPage.waitForFunction(
      ([expectedCategory, expectedFilename]) => {
        const card = document.querySelector('.activity-card');
        const image = card?.querySelector('img');
        return (
          card?.querySelector('.image-badge')?.textContent ===
            expectedCategory &&
          image?.complete &&
          image.naturalWidth > 0 &&
          decodeURIComponent(image.getAttribute('src') || '').includes(
            `/photos/categories/${expectedFilename}`,
          )
        );
      },
      [category, filename],
    );
    const credit = await categoryPage
      .locator('.activity-card .photo-credit')
      .first()
      .textContent();
    if (credit?.trim() !== '카테고리 대표 이미지 · AI 생성')
      throw new Error(`${category} 대표 이미지의 AI 생성 표시가 없습니다.`);
  }
  await categoryPage.close();

  const fallbackPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await fallbackPage.route('https://tong.visitkorea.or.kr/**', (route) =>
    route.abort(),
  );
  await fallbackPage.goto(`${baseUrl}/explore?category=축제·행사`, {
    waitUntil: 'networkidle',
  });
  await fallbackPage.locator('.activity-card').first().waitFor();
  const images = fallbackPage.locator('.activity-card img');
  for (let index = 0; index < (await images.count()); index += 1) {
    await images.nth(index).scrollIntoViewIfNeeded();
  }
  await fallbackPage.waitForTimeout(1000);
  const failedFallbacks = await images.evaluateAll((items) =>
    items
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => ({
        alt: image.alt,
        src: image.getAttribute('src'),
        fallback: image.dataset.fallbackSrc,
      })),
  );
  if (failedFallbacks.length)
    throw new Error(
      `공식 사진 차단 시 대체 실패: ${JSON.stringify(failedFallbacks)}`,
    );
  if (
    (await fallbackPage
      .getByText('카테고리 대표 이미지 · AI 생성', {
        exact: true,
      })
      .count()) < 2
  )
    throw new Error('공식 사진 차단 후 카테고리 이미지로 바뀌지 않았습니다.');
  await fallbackPage.close();
  console.log(
    '✔ 390px·1280px 지역 실사·14개 카테고리 이미지·공식 사진 서버 실패 대체',
  );
} finally {
  await browser.close();
}
