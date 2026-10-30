import type { Activity } from './catalog';

// Never guess a Naver place ID. Search the physical venue in its locality,
// rather than an event title, fixture, or an unverified address description.
export function naverMapUrl(activity: Activity): string | null {
  const location = activity.reference?.location;
  if (location && ['conflict', 'unknown'].includes(location.verification))
    return null;
  const query = (location?.query || activity.reference?.address || '').trim();
  if (!query) return null;
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function locationStatus(activity: Activity) {
  const location = activity.reference?.location;
  if (location?.verification === 'conflict')
    return '자료의 주소와 행사장이 달라 위치 확인 중입니다.';
  if (location?.verification === 'unknown')
    return '확정된 장소가 없어 공식 방문 안내를 확인해 주세요.';
  if (location?.naverVerifiedAt)
    return `네이버 지도 대조 · ${location.naverVerifiedAt}`;
  if (location?.verification === 'source-coordinates')
    return '공개 자료의 주소·좌표 대조 · 네이버 지도 재확인 필요';
  return '지역·장소명 검색 제공 · 정확한 위치 재확인 필요';
}
