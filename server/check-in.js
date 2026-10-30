'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const { places } = require('../src/lib/checkin-policy');
const { AuthError } = require('./auth-store');

const EARTH_RADIUS_METERS = 6_371_000;

function radians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(from, to) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const startLatitude = radians(from.latitude);
  const endLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function kstDate(now) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(new Date(now));
}

function finiteNumber(value, minimum, maximum, message) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  )
    throw new AuthError(400, message);
  return value;
}

function validateGpsCheckIn(input, { now = Date.now } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthError(400, 'GPS 인증 정보를 확인해 주세요.');
  const activityId =
    typeof input.activityId === 'string' ? input.activityId.trim() : '';
  if (!activityId || activityId.length > 100)
    throw new AuthError(400, '인증할 활동을 확인해 주세요.');
  const place = places.find((candidate) => candidate.activityId === activityId);
  if (!place || !['walk-in', 'location-visit'].includes(place.accessPolicy))
    throw new AuthError(404, 'GPS 방문 인증 대상 장소가 아닙니다.');
  const currentTime = now();
  const today = kstDate(currentTime);
  if (
    (place.startDate && today < place.startDate) ||
    (place.endDate && today > place.endDate)
  )
    throw new AuthError(409, '현재 GPS 인증 기간이 아닌 활동입니다.');

  const latitude = finiteNumber(
    input.latitude,
    -90,
    90,
    '현재 위치의 위도를 확인해 주세요.',
  );
  const longitude = finiteNumber(
    input.longitude,
    -180,
    180,
    '현재 위치의 경도를 확인해 주세요.',
  );
  const accuracyMeters = finiteNumber(
    input.accuracy,
    0,
    10_000,
    'GPS 정확도 정보를 확인해 주세요.',
  );
  const capturedAt = finiteNumber(
    input.capturedAt,
    0,
    Number.MAX_SAFE_INTEGER,
    'GPS 측정 시간을 확인해 주세요.',
  );
  if (Math.abs(currentTime - capturedAt) > 5 * 60 * 1000)
    throw new AuthError(400, '현재 위치를 다시 측정해 주세요.');
  if (accuracyMeters > place.maxAccuracyMeters)
    throw new AuthError(
      422,
      `GPS 정확도가 낮습니다. 야외에서 위치를 다시 확인해 주세요. (현재 약 ${Math.round(accuracyMeters)}m)`,
    );

  const measuredDistance = distanceMeters(
    { latitude, longitude },
    { latitude: place.latitude, longitude: place.longitude },
  );
  if (measuredDistance > place.radiusMeters)
    throw new AuthError(
      422,
      `인증 장소에서 약 ${Math.round(measuredDistance).toLocaleString('ko-KR')}m 떨어져 있습니다. ${place.radiusMeters}m 안에서 다시 시도해 주세요.`,
    );

  return {
    place,
    distanceMeters: Math.round(measuredDistance),
    accuracyMeters: Math.round(accuracyMeters),
  };
}

module.exports = { distanceMeters, kstDate, places, validateGpsCheckIn };
