'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const activities = require('./regional-catalog.json');
const walkingPlaces = require('./checkin-places.json');

// The browser and server use the same canonical amounts and venue coordinates.
const categoryRewards = {
  '맛집·미식': 100,
  '축제·행사': 300,
  '자연·생태': 200,
  '역사·전통': 150,
  '여행·관광': 150,
  '가족·키즈': 150,
};

function coordinateKey(latitude, longitude) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

const walkingIds = new Set(walkingPlaces.map((place) => place.activityId));
const additionalPlaces = activities.flatMap((activity) => {
  const reference = activity.reference;
  const location = reference?.location;
  const reward = categoryRewards[activity.category];
  if (
    walkingIds.has(activity.id) ||
    activity.is_demo ||
    !reward ||
    !reference ||
    !['restaurant', 'festival', 'landmark'].includes(reference.kind) ||
    ['contact-required', 'reservation-required', 'unknown'].includes(
      reference.participationType,
    ) ||
    location?.verification !== 'source-coordinates' ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    location.latitude < 33 ||
    location.latitude > 39 ||
    location.longitude < 124 ||
    location.longitude > 132
  )
    return [];

  const festival = reference.kind === 'festival';
  if (
    festival &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(reference.startDate || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reference.endDate || '') ||
      reference.startDate > reference.endDate)
  )
    return [];

  return [
    {
      activityId: activity.id,
      title: activity.title,
      region: activity.region,
      city: activity.city,
      address: reference.address,
      category: activity.category,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters: reference.kind === 'restaurant' ? 100 : 250,
      maxAccuracyMeters: reference.kind === 'restaurant' ? 50 : 100,
      reward,
      accessPolicy: 'location-visit',
      accessNotice: festival
        ? '등록된 행사 기간 중 행사장 주변 방문을 인증합니다. 행사 운영·개방 여부는 방문 전에 확인해 주세요. GPS는 입장이나 프로그램 참여를 증명하지 않습니다.'
        : '안내된 장소 주변 방문을 인증합니다. 현재 영업·개방 여부는 방문 전에 확인해 주세요. GPS는 결제나 시설 이용을 증명하지 않습니다.',
      ...(festival
        ? { startDate: reference.startDate, endDate: reference.endDate }
        : {}),
      sourceLabel: reference.sourceLabel,
      sourceUrl: reference.sourceUrl,
    },
  ];
});

const venueByCoordinate = new Map();
const places = [...walkingPlaces, ...additionalPlaces].map((place) => {
  const coordinates = coordinateKey(place.latitude, place.longitude);
  const venueKey = venueByCoordinate.get(coordinates) || place.activityId;
  venueByCoordinate.set(coordinates, venueKey);
  return { ...place, venueKey };
});

module.exports = { categoryRewards, places };
