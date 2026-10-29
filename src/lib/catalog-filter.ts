import type { Activity, Category } from './catalog';
import { categoryPhoto } from './category-photos';

export const catalogPageSize = 24;
export function activityArt(activity: Activity) {
  if (
    activity.photo?.path.startsWith('/photos/') ||
    activity.photo?.path.startsWith(
      'https://tong.visitkorea.or.kr/cms/resource/',
    )
  )
    return activity.photo.path;
  return activityFallbackArt(activity);
}
export function activityFallbackArt(activity: Activity) {
  return categoryPhoto(activity).path;
}
export type CatalogFilters = {
  region: string;
  district: string;
  category: Category;
  query: string;
};
export function filterActivities(items: Activity[], filters: CatalogFilters) {
  const query = filters.query.trim().toLocaleLowerCase('ko-KR');
  return items.filter(
    (activity) =>
      (filters.region === 'all' || activity.region === filters.region) &&
      (filters.district === 'all' ||
        (activity.reference
          ? activity.reference.district === filters.district
          : activity.city.split(/\s+/).includes(filters.district))) &&
      (filters.category === '전체' || activity.category === filters.category) &&
      (!query ||
        `${activity.title} ${activity.city} ${activity.category} ${activity.description} ${activity.tags.join(' ')} ${activity.reference?.address || ''} ${activity.reference?.district || ''}`
          .toLocaleLowerCase('ko-KR')
          .includes(query)),
  );
}
export function catalogSearchParams(filters: CatalogFilters, page = 0) {
  return new URLSearchParams({
    region: filters.region,
    district: filters.district,
    category: filters.category,
    query: filters.query,
    page: String(page),
  });
}
export function activityPrice(activity: Activity) {
  return activity.price === null
    ? '가격 확인 필요'
    : activity.price === 0
      ? '무료'
      : `${activity.price.toLocaleString('ko-KR')}원`;
}
export function activitySchedule(activity: Activity, today: string) {
  const reference = activity.reference;
  if (!reference?.startDate || !reference.endDate) return activity.date;
  const period = `${reference.startDate} ~ ${reference.endDate}`;
  if (reference.endDate < today) return `종료된 일정 · ${period}`;
  if (reference.startDate > today) return `공개 일정 · ${period}`;
  return `공개 일정 · ${period} (운영 확인 필요)`;
}
