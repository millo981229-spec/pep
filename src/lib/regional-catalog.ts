import type { Activity } from './catalog';
import festivalPhotos from './festival-photo-manifest.json';
import records from './regional-catalog.json';

// Public reference information, separate from partner offers and reward-eligible bookings.
// Provenance and limitations: docs/REGIONAL_CATALOG.md and each record's reference fields.
const photoManifest = festivalPhotos as Record<
  string,
  NonNullable<Activity['photo']>
>;
export const regionalActivities: Activity[] = (records as Activity[]).map(
  (activity) => {
    const photo = photoManifest[activity.id];
    if (!photo) return activity;
    return {
      ...activity,
      photo: {
        ...photo,
        fallbackPath: activity.photo?.path,
      },
    };
  },
);
