import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { subregions } from '../src/lib/locations.ts';
import { activityCategories, catalogArtNames } from '../src/lib/catalog.ts';

const base = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const records = JSON.parse(
  await readFile(
    new URL('../src/lib/regional-catalog.json', import.meta.url),
    'utf8',
  ),
);
const festivalPhotos = JSON.parse(
  await readFile(
    new URL('../src/lib/festival-photo-manifest.json', import.meta.url),
    'utf8',
  ),
);
const expectedCategoryPhotos = [
  'craft-one-day.webp',
  'culture-art.webp',
  'education-learning.webp',
  'exhibition-museum.webp',
  'family-kids.webp',
  'festival-event.webp',
  'food-gourmet.webp',
  'history-tradition.webp',
  'nature-ecology.webp',
  'performance-music.webp',
  'sports-leisure.webp',
  'travel-tourism.webp',
  'volunteer-community.webp',
  'wellness-rest.webp',
];
const categories = ['축제·행사', '스포츠·레저', '맛집·미식'];
const regionIds = [...new Set(records.map((record) => record.region))];
const get = async (params) => {
  const response = await fetch(
    `${base}/api/catalog?${new URLSearchParams(params)}`,
    { signal: AbortSignal.timeout(15000) },
  );
  return { status: response.status, data: await response.json() };
};
assert.ok(records.length >= 204);
assert.equal(regionIds.length, 17);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
for (const record of records) {
  assert.ok(activityCategories.includes(record.category), record.title);
  assert.ok(
    subregions[record.region]?.includes(record.reference.district),
    `${record.title}: 선택 목록에 없는 소지역`,
  );
  assert.ok(catalogArtNames.includes(record.image), record.title);
  if (record.photo) {
    assert.match(record.photo.path, /^\/photos\/[a-z0-9-]+\.jpg$/);
    assert.ok(record.photo.alt.trim());
    assert.ok(record.photo.credit.includes('한국관광공사'));
    await readFile(new URL(`../public${record.photo.path}`, import.meta.url));
  }
  assert.equal(new URL(record.reference.sourceUrl).protocol, 'https:');
  assert.equal(
    record.price,
    null,
    'Unknown prices must not be represented as free.',
  );
  if (record.reference.startDate) {
    assert.match(record.reference.startDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.reference.endDate >= record.reference.startDate);
  }
}
console.log(`✔ ${records.length}개 고유 항목·HTTPS 출처·미확인 가격·날짜 형식`);
const festivalPhotoEntries = Object.entries(festivalPhotos);
assert.equal(festivalPhotoEntries.length, 18);
for (const [activityId, photo] of festivalPhotoEntries) {
  assert.ok(
    records.some((record) => record.id === activityId),
    `${activityId}: 카탈로그에 없는 사진`,
  );
  assert.match(
    photo.path,
    /^https:\/\/tong\.visitkorea\.or\.kr\/cms\/resource\//,
  );
  assert.equal(photo.sourceUrl, photo.path);
  assert.ok(photo.alt.trim());
  assert.ok(photo.credit.includes('한국관광공사'));
  assert.ok(photo.sourceLabel.includes('TourAPI'));
  assert.equal(photo.scope, 'place');
}
console.log('✔ 행사 ID와 정확히 연결된 한국관광공사 TourAPI 사진 18개');
const categoryPhotoDirectory = new URL(
  '../public/photos/categories/',
  import.meta.url,
);
const categoryPhotoFiles = (await readdir(categoryPhotoDirectory))
  .filter((filename) => filename.endsWith('.webp'))
  .sort();
assert.deepEqual(categoryPhotoFiles, expectedCategoryPhotos);
for (const filename of categoryPhotoFiles) {
  const details = await stat(new URL(filename, categoryPhotoDirectory));
  assert.ok(details.size > 20_000, `${filename}: 이미지 용량이 비정상입니다.`);
  assert.ok(details.size < 200_000, `${filename}: 웹 이미지가 너무 큽니다.`);
}
console.log('✔ 14개 활동 카테고리별 WebP 대표 이미지·웹 용량 최적화');
for (const region of regionIds) {
  for (const category of categories) {
    const { status, data } = await get({ region, category });
    assert.equal(status, 200);
    const expectedCount = category === '축제·행사' ? 3 : 2;
    assert.equal(
      data.activities.length,
      expectedCount,
      `${region} / ${category}`,
    );
    assert.equal(data.hasMore, false);
    assert.ok(
      data.activities.every(
        (item) => item.region === region && item.category === category,
      ),
    );
  }
}
console.log('✔ 실제 HTTP API: 17개 지역의 축제 3개·스포츠/음식점 2개');
for (const category of activityCategories) {
  const expected = records.filter((record) => record.category === category);
  assert.ok(expected.length >= 4, `${category}: 안내 최소 4개`);
  const { status, data } = await get({ category });
  assert.equal(status, 200);
  assert.equal(data.activities.length, Math.min(24, expected.length));
  assert.ok(data.activities.every((item) => item.category === category));
  assert.deepEqual(
    data.activities.map((item) => item.id),
    expected.slice(0, 24).map((item) => item.id),
  );
}
console.log('✔ 14개 관심활동 분류 모두 최소 4개·분류별 API 목록 일치');
for (const district of subregions.gyeongbuk) {
  const { status, data } = await get({
    region: 'gyeongbuk',
    district,
    category: '여행·관광',
  });
  assert.equal(status, 200);
  assert.ok(data.activities.length >= 2, `${district}에 명소가 부족합니다.`);
  assert.ok(
    data.activities.every(
      (item) =>
        item.reference.kind === 'landmark' &&
        item.reference.district === district &&
        item.reference.address.trim(),
    ),
  );
}
console.log('✔ 경북 22개 시·군별 여행·관광 명소 최소 2개와 장소 검색어');
const ids = [];
for (let page = 0; ; page++) {
  assert.ok(
    page <= Math.ceil(records.length / 24),
    'Pagination must terminate.',
  );
  const { data, status } = await get({ page });
  assert.equal(status, 200);
  assert.ok(data.activities.length <= 24);
  ids.push(...data.activities.map((item) => item.id));
  if (!data.hasMore) break;
}
assert.equal(ids.length, records.length);
assert.equal(new Set(ids).size, records.length);
console.log(
  `✔ 24개씩 나누어 읽기·전체 ${records.length}개·중복/누락 없음·마지막 페이지 종료`,
);
const search = await get({ query: '천짓골' });
assert.equal(search.data.activities.length, 1);
assert.equal(search.data.activities[0].title, '천짓골식당');
const district = await get({
  region: 'jeonnam',
  district: '고흥군',
  category: '축제·행사',
});
assert.equal(district.data.activities.length, 1);
assert.equal(district.data.activities[0].title, '고흥유자축제');
const detail = await get({ activityId: district.data.activities[0].id });
assert.equal(detail.data.activities[0].reference.district, '고흥군');
console.log('✔ 첫 페이지 밖의 검색·소지역 필터·상세 다시 읽기');
for (const invalid of [
  { region: 'unknown' },
  { region: 'jeju', district: '고흥군' },
  { page: -1 },
  { page: 'NaN' },
  { category: 'invalid' },
  { query: 'x'.repeat(101) },
  { activityId: 'not-a-valid-id' },
]) {
  assert.equal((await get(invalid)).status, 400);
}
const empty = await get({ query: '없는자료000000' });
assert.deepEqual(empty.data.activities, []);
assert.equal(empty.data.hasMore, false);
console.log(
  '✔ 잘못된 지역·소지역·페이지·분류·긴 검색어·ID 입력 차단 및 빈 결과',
);
