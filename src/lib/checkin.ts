import { places } from './checkin-policy';

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
  venueKey: string;
  accessPolicy: 'walk-in' | 'location-visit';
  accessNotice: string;
  startDate?: string;
  endDate?: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const checkInPlaces = places as CheckInPlace[];

const placeById = new Map(
  checkInPlaces.map((place) => [place.activityId, place]),
);

export function checkInPlace(activityId: string) {
  return placeById.get(activityId);
}

export function sameCheckInVenue(firstId: string, secondId: string) {
  if (firstId === secondId) return true;
  const first = checkInPlace(firstId);
  const second = checkInPlace(secondId);
  return Boolean(first && second && first.venueKey === second.venueKey);
}

export function placeAcceptsCheckIn(place: CheckInPlace, today: string) {
  return Boolean(
    ['walk-in', 'location-visit'].includes(place.accessPolicy) &&
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
