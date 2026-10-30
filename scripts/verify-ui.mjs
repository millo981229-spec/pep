import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const records = JSON.parse(
  await readFile(
    new URL('../src/lib/regional-catalog.json', import.meta.url),
    'utf8',
  ),
);
const addedCategories = [
  ...new Set(
    records
      .filter((record) => record.reference.kind === 'place')
      .map((record) => record.category),
  ),
];

const require = process.env.BROWSER_TEST_DEPS
  ? createRequire(resolve(process.env.BROWSER_TEST_DEPS, 'package.json'))
  : createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

try {
  await mkdir('docs/evidence/regional-catalog', { recursive: true });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/explore`, { waitUntil: 'networkidle' });
    for (const category of addedCategories) {
      const expectedTitles = records
        .filter((record) => record.category === category)
        .slice(0, 24)
        .map((record) => record.title)
        .sort();
      await page
        .getByRole('group', { name: '활동 분야' })
        .getByRole('button', { name: category, exact: true })
        .click();
      await page.waitForFunction((expected) => {
        const actual = [
          ...document.querySelectorAll('.activity-card .card-title'),
        ]
          .map((node) => node.textContent)
          .sort();
        return JSON.stringify(actual) === JSON.stringify(expected);
      }, expectedTitles);
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error(`${width}px ${category} 분류에 가로 넘침이 있습니다.`);
      await page.locator('.activity-card .card-title').first().click();
      await page.getByRole('link', { name: '공식 이용·참여 안내' }).waitFor();
      if (!(await page.getByText('이용 안내', { exact: true }).isVisible()))
        throw new Error(`${category} 상세에 이용 안내가 없습니다.`);
      await page.keyboard.press('Escape');
    }
    await page.screenshot({
      path: `docs/evidence/regional-catalog/categories-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel('지역 선택').selectOption('jeonnam');
    await page.getByLabel('시·군·구 선택').selectOption('고흥군');
    await page.getByRole('button', { name: '축제·행사', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.activity-card').length === 1 &&
        document.querySelector('.card-title')?.textContent === '고흥유자축제',
    );
    const titles = await page
      .locator('.activity-card .card-title')
      .allTextContents();
    if (titles.length !== 1 || titles[0] !== '고흥유자축제')
      throw new Error(`${width}px 소지역 필터 결과가 올바르지 않습니다.`);
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`${width}px 화면에 가로 넘침이 있습니다.`);
    await page.screenshot({
      path: `docs/evidence/regional-catalog/explore-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: '고흥유자축제', exact: true })
      .click();
    if (
      !(
        await page.locator('.reference-source').getAttribute('href')
      ).startsWith('https://github.com/')
    )
      throw new Error('상세 화면에서 공개 자료의 출처로 연결되지 않습니다.');
    if (
      !(await page
        .getByText('가격 확인 필요', { exact: true })
        .last()
        .isVisible())
    )
      throw new Error('미확인 가격이 잘못 표시됩니다.');
    await page.screenshot({
      path: `docs/evidence/regional-catalog/detail-${width}.png`,
    });
    await page.keyboard.press('Escape');

    await page.getByLabel('지역 선택').selectOption('jeju');
    if ((await page.getByLabel('시·군·구 선택').inputValue()) !== 'all')
      throw new Error('상위 지역 변경 시 소지역이 초기화되지 않았습니다.');
    await page.getByRole('button', { name: '맛집·미식', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.activity-card').length === 2 &&
        [...document.querySelectorAll('.card-location')].every((node) =>
          node.textContent.includes('제주'),
        ),
    );

    await page.getByLabel('지역 선택').selectOption('gyeongbuk');
    await page.getByRole('button', { name: '여행·관광', exact: true }).click();
    for (const district of ['안동시', '영양군', '울릉군']) {
      await page.getByLabel('시·군·구 선택').selectOption(district);
      await page.waitForFunction((selectedDistrict) => {
        const cards = [...document.querySelectorAll('.activity-card')];
        return (
          cards.length >= 2 &&
          cards.every(
            (card) =>
              card
                .querySelector('.card-location')
                ?.textContent.includes(`경북 ${selectedDistrict}`) &&
              card.querySelector('.image-badge')?.textContent === '여행·관광',
          )
        );
      }, district);
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error(
          `${width}px ${district} 관광지 목록에 가로 넘침이 있습니다.`,
        );
      await page.locator('.activity-card .card-title').first().click();
      if (!(await page.getByText('이용 안내', { exact: true }).isVisible()))
        throw new Error(
          `${district} 랜드마크에 이용 안내가 표시되지 않습니다.`,
        );
      const address = await page
        .locator('.reference-info dl > div')
        .filter({ has: page.getByText('지도 검색 장소', { exact: true }) })
        .locator('dd')
        .textContent();
      const href = await page
        .getByRole('link', { name: '지도에서 위치 찾기' })
        .getAttribute('href');
      if (!address?.trim() || !href)
        throw new Error(
          `${district} 랜드마크의 장소 또는 지도 링크가 비어 있습니다.`,
        );
      const mapUrl = new URL(href);
      if (
        mapUrl.origin !== 'https://map.naver.com' ||
        !mapUrl.pathname.startsWith('/p/search/') ||
        decodeURIComponent(mapUrl.pathname.slice('/p/search/'.length)) !==
          address.trim()
      )
        throw new Error(
          `${district} 지도 검색어가 표시된 실제 장소와 다릅니다.`,
        );
      await page.keyboard.press('Escape');
    }

    const emptyYeongyangResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/catalog' &&
        url.searchParams.get('region') === 'gyeongbuk' &&
        url.searchParams.get('district') === '영양군' &&
        url.searchParams.get('category') === '스포츠·레저' &&
        response.status() === 200
      );
    });
    await page.getByLabel('시·군·구 선택').selectOption('영양군');
    await page
      .getByRole('button', { name: '스포츠·레저', exact: true })
      .click();
    await emptyYeongyangResponse;
    const otherActivities = page.getByRole('button', {
      name: '이 지역의 다른 활동 보기',
      exact: true,
    });
    await otherActivities.waitFor();
    if (await page.locator('.activity-card').count())
      throw new Error(
        '영양군의 비어 있는 스포츠 분류에 다른 자료가 섞여 나옵니다.',
      );
    await otherActivities.click();
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll('.activity-card')];
      return (
        cards.length >= 2 &&
        cards.every(
          (card) =>
            card
              .querySelector('.card-location')
              ?.textContent.includes('경북 영양군') &&
            card.querySelector('.image-badge')?.textContent === '여행·관광',
        )
      );
    });
    if (
      (await page.getByLabel('지역 선택').inputValue()) !== 'gyeongbuk' ||
      (await page.getByLabel('시·군·구 선택').inputValue()) !== '영양군'
    )
      throw new Error(
        '다른 활동 보기에서 선택한 경북 영양군이 유지되지 않았습니다.',
      );

    await page.goto(`${baseUrl}/map`, { waitUntil: 'networkidle' });
    if (!(await page.getByLabel('시·군·구 선택').isVisible()))
      throw new Error(`${width}px 지도에 소지역 선택이 보이지 않습니다.`);
    await page.getByLabel('지역 선택').selectOption('jeju');
    await page.waitForFunction(
      (expected) =>
        document.querySelectorAll('.map-activity-row').length === expected,
      records.filter((record) => record.region === 'jeju').length,
    );

    await page.goto(`${baseUrl}/recommend`, { waitUntil: 'networkidle' });
    const interestButtons = page.locator('.interest-options button');
    if ((await interestButtons.count()) !== 14)
      throw new Error('관심활동 14개가 모두 표시되지 않았습니다.');
    for (let index = 0; index < 9; index += 1)
      await interestButtons.nth(index).click();
    if (
      (await page
        .locator('.interest-options button[aria-pressed="true"]')
        .count()) !== 8
    )
      throw new Error('관심활동 최대 8개 제한이 작동하지 않습니다.');
    await page.goto(`${baseUrl}/rewards`, { waitUntil: 'networkidle' });
    await page
      .getByRole('button', { name: '바코드 화면 미리보기' })
      .first()
      .click();
    await page.locator('.barcode').waitFor();
    if ((await page.locator('.barcode rect').count()) < 30)
      throw new Error('Code 128 바코드 막대가 렌더링되지 않았습니다.');
    if (!(await page.getByText(/화면 시연용 쿠폰입니다/).isVisible()))
      throw new Error('바코드 미리보기의 사용 불가 안내가 보이지 않습니다.');
    await page.keyboard.press('Escape');
    await page.goto(`${baseUrl}/my`, { waitUntil: 'networkidle' });
    await page
      .getByRole('button', { name: '로그인하기', exact: true })
      .waitFor();
    if (
      (await page.getByRole('button', { name: /체험판/ }).count()) ||
      (await page.locator('.profile-summary').count())
    )
      throw new Error('비로그인 MY 화면에 체험 계정이 남아 있습니다.');
    if (errors.length) throw new Error(`브라우저 오류: ${errors.join(', ')}`);
    console.log(
      `✔ ${width}px 추가 10개 분류·상세·지역 필터·경북 소지역·주소 지도 링크·빈 분류 복구·관심활동·바코드·체험 계정 없음·가로 넘침 없음`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
