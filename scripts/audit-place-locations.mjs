import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { subregions } from '../src/lib/locations.ts';
import { naverMapUrl } from '../src/lib/place-location.ts';

const records = JSON.parse(
  await readFile(new URL('../src/lib/regional-catalog.json', import.meta.url)),
);
const checkIns = JSON.parse(
  await readFile(new URL('../src/lib/checkin-places.json', import.meta.url)),
);
const statuses = {};
for (const activity of records) {
  const location = activity.reference.location;
  assert.ok(location, `${activity.title}: 위치 점검 기록 누락`);
  const state = location.verification;
  assert.ok(
    ['source-coordinates', 'locality-query', 'conflict', 'unknown'].includes(
      state,
    ),
  );
  statuses[state] = (statuses[state] || 0) + 1;
  if (['conflict', 'unknown'].includes(state)) {
    assert.equal(naverMapUrl(activity), null);
    assert.equal(
      checkIns.some((place) => place.activityId === activity.id),
      false,
    );
    continue;
  }
  assert.ok(location.query.trim(), `${activity.title}: 지도 검색어 누락`);
  assert.ok(location.placeName.trim(), `${activity.title}: 실제 장소명 누락`);
  const url = new URL(naverMapUrl(activity));
  assert.equal(url.origin, 'https://map.naver.com');
  assert.equal(
    decodeURIComponent(url.pathname.slice('/p/search/'.length)),
    location.query,
  );
  if (state === 'source-coordinates') {
    assert.ok(location.latitude > 33 && location.latitude < 39);
    assert.ok(location.longitude > 124 && location.longitude < 132);
  }
  // No live Naver comparison was possible in this environment. Do not promote
  // a syntactically valid URL or a source coordinate into verified map evidence.
  assert.equal(location.naverVerifiedAt, null);
}
const coverage = [];
for (const [region, districts] of Object.entries(subregions)) {
  for (const district of districts) {
    const places = records.filter(
      (record) =>
        record.region === region &&
        record.reference.district === district &&
        naverMapUrl(record),
    );
    const distinctPlaces = new Set(
      places.map((record) => record.reference.location.query),
    ).size;
    assert.ok(distinctPlaces >= 2, `${region} ${district}: 장소 2개 미만`);
    coverage.push({ region, district, places: places.length, distinctPlaces });
  }
}
const report = {
  checkedOn: '2026-10-30',
  catalogRecords: records.length,
  districts: coverage.length,
  districtsWithTwoPlaces: coverage.filter((entry) => entry.distinctPlaces >= 2)
    .length,
  locationsByStatus: statuses,
  gpsEligibleActivities: checkIns.length,
  naverDirectlyVerified: 0,
  naverVerificationBlocker:
    'map.naver.com CONNECT 403: environment network policy',
  coverage,
};
if (process.argv.includes('--write-evidence')) {
  const directory = new URL(
    '../docs/evidence/district-coverage/',
    import.meta.url,
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL('coverage.json', directory),
    JSON.stringify(report, null, 2) + '\n',
  );
  const cells = (values) =>
    values
      .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
      .join(',');
  const rows = [
    cells([
      'id',
      'region',
      'district',
      'title',
      'place_name',
      'address',
      'map_query',
      'naver_url',
      'source',
      'location_status',
      'latitude',
      'longitude',
      'naver_verified_at',
    ]),
  ];
  for (const activity of records) {
    const reference = activity.reference;
    const location = reference.location;
    rows.push(
      cells([
        activity.id,
        activity.region,
        reference.district,
        activity.title,
        location.placeName,
        reference.address,
        location.query,
        naverMapUrl(activity),
        reference.sourceUrl,
        location.verification,
        location.latitude,
        location.longitude,
        location.naverVerifiedAt,
      ]),
    );
  }
  await writeFile(
    new URL('locations.csv', directory),
    '\uFEFF' + rows.join('\n') + '\n',
  );
}
console.log(
  `✔ ${records.length}개 위치 기록·${coverage.length}개 지역마다 최소 2개·모호한 지도/GPS 차단·네이버 직접 확인 0개(접속 차단)`,
);
