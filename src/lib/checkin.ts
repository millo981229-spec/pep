import rawPlaces from './checkin-places.json';

export type CheckInPlace = {
  activityId: string;
  title: string;
  region: string;
  city: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  reward: number;
  accessPolicy: 'walk-in';
  accessNotice: string;
  startDate?: string;
  endDate?: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const checkInPlaces: CheckInPlace[] = rawPlaces
  .filter((place) => place.accessPolicy === 'walk-in')
  .map((place) => ({ ...place, accessPolicy: 'walk-in' as const }));

export function checkInPlace(activityId: string) {
  return checkInPlaces.find((place) => place.activityId === activityId);
}

export function placeAcceptsCheckIn(place: CheckInPlace, today: string) {
  return Boolean(
    place.accessPolicy === 'walk-in' &&
    today &&
    (!place.startDate || today >= place.startDate) &&
    (!place.endDate || today <= place.endDate),
  );
}

export function gpsDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (value: number) => (value * Math.PI) / 180;
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
    2 * 6_371_000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}
