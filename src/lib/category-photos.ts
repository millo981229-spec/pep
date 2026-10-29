import type { Activity, Category } from './catalog';

type CategoryPhoto = {
  path: string;
  alt: string;
};

export const categoryPhotos = {
  '문화·예술': {
    path: '/photos/categories/culture-art.webp',
    alt: '현대 미술 공간을 관람하는 문화예술 활동 대표 이미지',
  },
  '공연·음악': {
    path: '/photos/categories/performance-music.webp',
    alt: '도심 야외 공연을 즐기는 공연음악 활동 대표 이미지',
  },
  '전시·박물관': {
    path: '/photos/categories/exhibition-museum.webp',
    alt: '몰입형 전시를 관람하는 전시박물관 활동 대표 이미지',
  },
  '스포츠·레저': {
    path: '/photos/categories/sports-leisure.webp',
    alt: '강변 자전거길을 달리는 스포츠레저 활동 대표 이미지',
  },
  '자연·생태': {
    path: '/photos/categories/nature-ecology.webp',
    alt: '습지 탐방로를 걷는 자연생태 활동 대표 이미지',
  },
  '여행·관광': {
    path: '/photos/categories/travel-tourism.webp',
    alt: '한국 해안 마을을 여행하는 여행관광 활동 대표 이미지',
  },
  '축제·행사': {
    path: '/photos/categories/festival-event.webp',
    alt: '강변 등불 축제를 즐기는 축제행사 활동 대표 이미지',
  },
  '맛집·미식': {
    path: '/photos/categories/food-gourmet.webp',
    alt: '지역 한식을 함께 즐기는 맛집미식 활동 대표 이미지',
  },
  '공예·원데이': {
    path: '/photos/categories/craft-one-day.webp',
    alt: '도자기를 빚는 공예 원데이 활동 대표 이미지',
  },
  '역사·전통': {
    path: '/photos/categories/history-tradition.webp',
    alt: '전통 궁궐을 둘러보는 역사전통 활동 대표 이미지',
  },
  '가족·키즈': {
    path: '/photos/categories/family-kids.webp',
    alt: '가족이 과학 체험 공간을 둘러보는 가족키즈 활동 대표 이미지',
  },
  '교육·배움': {
    path: '/photos/categories/education-learning.webp',
    alt: '천문 모형을 활용해 배우는 교육 활동 대표 이미지',
  },
  '봉사·커뮤니티': {
    path: '/photos/categories/volunteer-community.webp',
    alt: '이웃과 정원을 가꾸는 봉사커뮤니티 활동 대표 이미지',
  },
  '웰니스·휴식': {
    path: '/photos/categories/wellness-rest.webp',
    alt: '숲속에서 스트레칭하는 웰니스휴식 활동 대표 이미지',
  },
} satisfies Record<Exclude<Category, '전체'>, CategoryPhoto>;

const defaultPhoto: CategoryPhoto = categoryPhotos['여행·관광'];

export function categoryPhoto(activity: Activity): CategoryPhoto {
  if (activity.category === '전체') return defaultPhoto;
  return categoryPhotos[activity.category];
}

export function activityImageAlt(
  activity: Activity,
  usingFallback = false,
): string {
  if (activity.photo && !usingFallback) return activity.photo.alt;
  return categoryPhoto(activity).alt;
}

export function activityImageCredit(
  activity: Activity,
  usingFallback = false,
): string {
  if (activity.photo && !usingFallback) {
    return `${activity.photo.scope === 'region' ? '지역 대표 사진 · ' : ''}${activity.photo.credit}`;
  }
  return '카테고리 대표 이미지 · AI 생성';
}
