export const activityCategories = [
  '문화·예술',
  '공연·음악',
  '전시·박물관',
  '스포츠·레저',
  '자연·생태',
  '여행·관광',
  '축제·행사',
  '맛집·미식',
  '공예·원데이',
  '역사·전통',
  '가족·키즈',
  '교육·배움',
  '봉사·커뮤니티',
  '웰니스·휴식',
] as const;
export const categories = ['전체', ...activityCategories] as const;
export type Category = (typeof categories)[number];
export const catalogArtNames = [
  'garden',
  'village',
  'ocean',
  'night',
  'island',
  'gallery',
  'festival-lantern',
  'festival-market',
  'sports-stadium',
  'sports-court',
  'food-table',
  'food-cafe',
  'landmark-mountain',
  'landmark-heritage',
] as const;
export type Region = {
  id: string;
  name: string;
  short: string;
  description: string;
  tags: string[];
  x: number;
  y: number;
};
export const regions: Region[] = [
  {
    id: 'seoul',
    name: '서울',
    short: '서울',
    description:
      '궁궐과 골목, 독립 서점과 작은 공연장이 공존하는 도시. 익숙한 길에서도 새로운 문화를 만날 수 있어요.',
    tags: ['전시', '궁궐', '도시 산책'],
    x: 111,
    y: 96,
  },
  {
    id: 'incheon',
    name: '인천',
    short: '인천',
    description:
      '항구의 역사와 섬의 풍경이 이어지는 곳. 개항장 골목부터 서해의 노을까지 천천히 둘러보세요.',
    tags: ['섬 여행', '개항장', '노을'],
    x: 72,
    y: 105,
  },
  {
    id: 'gyeonggi',
    name: '경기',
    short: '경기',
    description:
      '도심 가까이에서 만나는 숲과 성곽, 강변의 여유. 하루 동안 가볍게 떠나기 좋은 경험이 풍성해요.',
    tags: ['성곽', '수목원', '당일 여행'],
    x: 136,
    y: 134,
  },
  {
    id: 'gangwon',
    name: '강원',
    short: '강원',
    description:
      '태백산맥의 숲과 동해의 바다가 만나는 곳. 산길을 걷고, 바닷가에서 잠시 일상을 내려놓아 보세요.',
    tags: ['바다', '트레킹', '숲'],
    x: 203,
    y: 98,
  },
  {
    id: 'chungbuk',
    name: '충북',
    short: '충북',
    description:
      '호수와 산, 내륙의 고즈넉한 마을이 어우러진 지역. 물길을 따라 걷는 여행과 작은 도시의 문화를 발견해 보세요.',
    tags: ['호수', '산책', '내륙 여행'],
    x: 170,
    y: 180,
  },
  {
    id: 'chungnam',
    name: '충남',
    short: '충남',
    description:
      '백제의 역사와 서해의 갯벌을 품은 지역. 오래된 유적과 시장, 해안 산책을 함께 즐길 수 있어요.',
    tags: ['백제 문화', '갯벌', '시장'],
    x: 81,
    y: 192,
  },
  {
    id: 'sejong',
    name: '세종',
    short: '세종',
    description:
      '공원과 수목원, 산책하기 좋은 길이 도시를 잇는 곳. 계절에 따라 달라지는 정원의 표정을 만나보세요.',
    tags: ['수목원', '공원', '자전거'],
    x: 128,
    y: 195,
  },
  {
    id: 'daejeon',
    name: '대전',
    short: '대전',
    description:
      '과학과 예술, 오래된 동네의 이야기가 함께하는 도시. 전시를 보고 도심 속 숲길을 걸어보세요.',
    tags: ['과학', '전시', '도심 숲'],
    x: 137,
    y: 228,
  },
  {
    id: 'gyeongbuk',
    name: '경북',
    short: '경북',
    description:
      '한옥 마을과 유적, 동해의 작은 항구가 이어지는 지역. 도시마다 다른 역사와 생활 문화를 느껴보세요.',
    tags: ['한옥', '역사', '동해'],
    x: 242,
    y: 200,
  },
  {
    id: 'daegu',
    name: '대구',
    short: '대구',
    description:
      '근대 골목과 시장, 공연과 전시가 살아 있는 도시. 골목을 걸으며 지역의 새로운 취향을 찾아보세요.',
    tags: ['골목 여행', '공연', '시장'],
    x: 225,
    y: 263,
  },
  {
    id: 'jeonbuk',
    name: '전북',
    short: '전북',
    description:
      '전통의 멋과 음식, 산과 들의 풍경이 가까운 지역. 한옥 골목을 지나 작은 마을의 일상을 만나보세요.',
    tags: ['한옥', '공예', '미식'],
    x: 109,
    y: 274,
  },
  {
    id: 'gwangju',
    name: '광주',
    short: '광주',
    description:
      '예술과 민주주의의 기억이 흐르는 도시. 전시와 독립 공간, 동네의 맛을 연결해 여행해 보세요.',
    tags: ['예술', '독립 공간', '미식'],
    x: 81,
    y: 324,
  },
  {
    id: 'jeonnam',
    name: '전남',
    short: '전남',
    description:
      '섬과 바다, 넓은 들녘의 느린 호흡을 만나는 곳. 정원과 차밭, 남도의 이야기를 천천히 즐겨보세요.',
    tags: ['정원', '섬', '차밭'],
    x: 127,
    y: 349,
  },
  {
    id: 'gyeongnam',
    name: '경남',
    short: '경남',
    description:
      '남해의 섬과 지리산, 항구 도시의 활기가 만나는 지역. 바닷길과 산길에서 나만의 휴식을 찾아보세요.',
    tags: ['남해', '트레킹', '항구'],
    x: 193,
    y: 313,
  },
  {
    id: 'ulsan',
    name: '울산',
    short: '울산',
    description:
      '산업 도시의 에너지와 대숲, 해안의 풍경이 함께하는 곳. 강변 산책과 바다 여행을 연결해 보세요.',
    tags: ['대숲', '해안', '강변'],
    x: 283,
    y: 280,
  },
  {
    id: 'busan',
    name: '부산',
    short: '부산',
    description:
      '바다와 산복도로, 시장과 영화가 어우러지는 항구 도시. 해변 너머 동네의 이야기도 만나보세요.',
    tags: ['해변', '영화', '골목'],
    x: 265,
    y: 323,
  },
  {
    id: 'jeju',
    name: '제주',
    short: '제주',
    description:
      '오름과 돌담, 바람과 바다를 따라 걷는 섬. 자연을 존중하며 마을의 속도로 여행해 보세요.',
    tags: ['오름', '올레', '마을 여행'],
    x: 71,
    y: 422,
  },
];
export type Activity = {
  id: string;
  title: string;
  region: string;
  city: string;
  category: Category;
  description: string;
  duration: string;
  price: number | null;
  reward?: number;
  image: string;
  date: string;
  is_demo: boolean;
  tags: string[];
  photo?: {
    path: string;
    alt: string;
    credit: string;
    sourceLabel: string;
    sourceUrl?: string;
    fallbackPath?: string;
    scope: 'place' | 'region';
  };
  reference?: {
    kind: 'festival' | 'sports' | 'restaurant' | 'landmark' | 'place';
    address: string;
    district: string;
    sourceUrl: string;
    sourceLabel: string;
    checkedAt: string;
    sourceDate: string;
    verification: 'snapshot' | 'link-only';
    notice: string;
    participationType?:
      'walk-in' | 'contact-required' | 'reservation-required' | 'unknown';
    website?: string;
    startDate?: string;
    endDate?: string;
    location?: {
      placeName: string;
      query: string;
      verification:
        'source-coordinates' | 'locality-query' | 'conflict' | 'unknown';
      latitude?: number;
      longitude?: number;
      naverVerifiedAt: string | null;
      issues?: string[];
    };
  };
};
// Fictional preview catalog. Never represent these as verified events or issue rewards for them.
export const previewActivities: Activity[] = [
  {
    id: 'preview-1',
    title: '초록을 따라 걷는 순천 정원 산책',
    region: 'jeonnam',
    city: '전남 순천시',
    category: '자연·생태',
    description:
      '정원의 계절을 가까이 만나고, 느린 걸음으로 나만의 쉼을 찾아보는 산책 콘텐츠 예시입니다. 실제 모집 중인 행사가 아닙니다.',
    duration: '약 2시간',
    price: 0,
    image: 'garden',
    date: '일정 미정',
    is_demo: true,
    tags: ['가벼운 산책', '자연', '혼자서도 좋아요'],
  },
  {
    id: 'preview-2',
    title: '골목 끝에서 만나는 전주 공예',
    region: 'jeonbuk',
    city: '전북 전주시',
    category: '공예·원데이',
    description:
      '지역 공방에서 손으로 만드는 즐거움을 경험하는 활동 예시입니다. 실제 공방 예약이나 결제는 제공하지 않습니다.',
    duration: '약 90분',
    price: 25000,
    image: 'village',
    date: '일정 미정',
    is_demo: true,
    tags: ['공예', '실내', '새로운 취미'],
  },
  {
    id: 'preview-3',
    title: '파도와 함께 시작하는 양양의 아침',
    region: 'gangwon',
    city: '강원 양양군',
    category: '스포츠·레저',
    description:
      '바다에서 새로운 움직임을 배우는 서핑 활동 예시입니다. 운영자·날짜·안전 조건 확인 후 실제 콘텐츠를 등록할 예정입니다.',
    duration: '약 2시간',
    price: 60000,
    image: 'ocean',
    date: '일정 미정',
    is_demo: true,
    tags: ['서핑', '야외', '입문'],
  },
  {
    id: 'preview-4',
    title: '경주의 밤, 오래된 이야기 속으로',
    region: 'gyeongbuk',
    city: '경북 경주시',
    category: '역사·전통',
    description:
      '유적 주변을 걸으며 지역의 역사를 알아보는 문화 산책 예시입니다. 실제 해설 프로그램이 아닙니다.',
    duration: '약 90분',
    price: 10000,
    image: 'night',
    date: '일정 미정',
    is_demo: true,
    tags: ['역사', '야간 산책', '문화'],
  },
  {
    id: 'preview-5',
    title: '제주 돌담길에서 만나는 마을의 하루',
    region: 'jeju',
    city: '제주 제주시',
    category: '여행·관광',
    description:
      '바람과 돌담을 따라 마을의 풍경을 발견하는 여행 콘텐츠 예시입니다. 실제 운영 일정은 없습니다.',
    duration: '약 3시간',
    price: 0,
    image: 'island',
    date: '일정 미정',
    is_demo: true,
    tags: ['마을 여행', '걷기', '자연'],
  },
  {
    id: 'preview-6',
    title: '부산의 작은 전시에서 취향 발견',
    region: 'busan',
    city: '부산 부산진구',
    category: '전시·박물관',
    description:
      '동네 전시 공간을 찾아 새로운 작품을 만나는 문화활동 예시입니다. 특정 전시의 개최를 안내하는 정보가 아닙니다.',
    duration: '약 1시간',
    price: 8000,
    image: 'gallery',
    date: '일정 미정',
    is_demo: true,
    tags: ['전시', '실내', '예술'],
  },
];
export const offerCategories = [
  '식음료',
  '문화·체험',
  '스포츠·레저',
  '여행·관광',
  '지역상품',
  '지역상생',
] as const;
export type OfferCategory = (typeof offerCategories)[number];
export type Offer = {
  id: string;
  title: string;
  merchant: string;
  region: string;
  category: OfferCategory;
  cost: number;
  stock: number;
  description: string;
  terms: string;
  is_demo: boolean;
};
export const previewOffers: Offer[] = [
  {
    id: 'preview-cafe',
    title: '동네 카페 음료 한 잔',
    merchant: '곳곳 카페 제휴 데모',
    region: '전국',
    category: '식음료',
    cost: 1200,
    stock: 0,
    description: '지역을 걷고 난 뒤 가까운 동네 카페에서 쉬어가는 혜택입니다.',
    terms: '지정 제조 음료 1잔 · 옵션 추가금 별도',
    is_demo: true,
  },
  {
    id: 'preview-tea',
    title: '전주 골목 전통차 혜택',
    merchant: '곳곳 전통찻집 제휴 데모',
    region: '전북',
    category: '식음료',
    cost: 1600,
    stock: 0,
    description: '전주 골목을 천천히 둘러본 뒤 따뜻한 차를 즐기는 혜택입니다.',
    terms: '1인 1잔 · 일부 메뉴 제외',
    is_demo: true,
  },
  {
    id: 'preview-market-snack',
    title: '부산 시장 간식 교환권',
    merchant: '곳곳 전통시장 제휴 데모',
    region: '부산',
    category: '식음료',
    cost: 2000,
    stock: 0,
    description: '시장 골목을 여행하며 지역의 맛을 가볍게 경험하는 혜택입니다.',
    terms: '지정 매장 · 당일 1회 사용',
    is_demo: true,
  },
  {
    id: 'preview-gallery',
    title: '작은 전시 입장 혜택',
    merchant: '곳곳 문화공간 제휴 데모',
    region: '전국',
    category: '문화·체험',
    cost: 2200,
    stock: 0,
    description: '동네 문화공간과 작은 전시를 더 가까이 만나는 혜택입니다.',
    terms: '지정 전시 · 1인 입장',
    is_demo: true,
  },
  {
    id: 'preview-performance',
    title: '독립공연 관람 할인',
    merchant: '곳곳 공연장 제휴 데모',
    region: '서울',
    category: '문화·체험',
    cost: 4500,
    stock: 0,
    description: '지역 공연장에서 새로운 음악과 무대를 발견하는 혜택입니다.',
    terms: '지정 회차 1매 · 사전 예약 필요',
    is_demo: true,
  },
  {
    id: 'preview-class',
    title: '생활문화 원데이클래스 할인',
    merchant: '곳곳 생활문화센터 제휴 데모',
    region: '대구',
    category: '문화·체험',
    cost: 3500,
    stock: 0,
    description: '여행지에서 손으로 만들고 배우는 시간을 위한 혜택입니다.',
    terms: '지정 클래스 · 재료비 일부 별도',
    is_demo: true,
  },
  {
    id: 'preview-trekking',
    title: '트레킹 장비 대여 할인',
    merchant: '곳곳 아웃도어숍 제휴 데모',
    region: '강원',
    category: '스포츠·레저',
    cost: 3000,
    stock: 0,
    description: '안전하고 가볍게 지역의 산길을 걷기 위한 대여 혜택입니다.',
    terms: '스틱 또는 아이젠 1종 · 당일 반납',
    is_demo: true,
  },
  {
    id: 'preview-bike',
    title: '자전거 반일 대여 혜택',
    merchant: '곳곳 자전거대여소 제휴 데모',
    region: '제주',
    category: '스포츠·레저',
    cost: 5000,
    stock: 0,
    description: '제주의 마을과 해안길을 나만의 속도로 둘러보는 혜택입니다.',
    terms: '일반 자전거 · 최대 4시간',
    is_demo: true,
  },
  {
    id: 'preview-luggage',
    title: '여행 짐 보관 4시간',
    merchant: '곳곳 여행안내소 제휴 데모',
    region: '전남',
    category: '여행·관광',
    cost: 1800,
    stock: 0,
    description: '무거운 짐을 잠시 맡기고 지역을 가볍게 걷는 혜택입니다.',
    terms: '소형 짐 1개 · 운영시간 내 최대 4시간',
    is_demo: true,
  },
  {
    id: 'preview-guide',
    title: '경주 문화해설 동행 할인',
    merchant: '곳곳 해설 프로그램 제휴 데모',
    region: '경북',
    category: '여행·관광',
    cost: 3000,
    stock: 0,
    description: '유적과 도시의 이야기를 해설과 함께 깊이 만나는 혜택입니다.',
    terms: '지정 정규 해설 · 1인 이용',
    is_demo: true,
  },
  {
    id: 'preview-localfood',
    title: '로컬푸드 장보기 5천원권',
    merchant: '곳곳 로컬푸드매장 제휴 데모',
    region: '충남',
    category: '지역상품',
    cost: 4000,
    stock: 0,
    description: '지역 생산자의 먹거리를 일상 속에서 만나는 장보기 혜택입니다.',
    terms: '지정 매장 · 1만원 이상 구매 시',
    is_demo: true,
  },
  {
    id: 'preview-farmbox',
    title: '지역 농산물 꾸러미 할인',
    merchant: '곳곳 농가마켓 제휴 데모',
    region: '경북',
    category: '지역상품',
    cost: 6000,
    stock: 0,
    description: '지역 농가의 제철 먹거리를 꾸러미로 만나는 혜택입니다.',
    terms: '지정 꾸러미 1개 · 배송비 별도',
    is_demo: true,
  },
  {
    id: 'preview-bookshop',
    title: '지역책방 도서 할인',
    merchant: '곳곳 동네책방 제휴 데모',
    region: '전남',
    category: '지역상생',
    cost: 2500,
    stock: 0,
    description:
      '여행지의 책방에서 지역의 이야기와 새로운 취향을 찾는 혜택입니다.',
    terms: '지정 책방 · 1만원 이상 도서 구매 시',
    is_demo: true,
  },
  {
    id: 'preview-zerowaste',
    title: '다회용 여행 키트 할인',
    merchant: '곳곳 제로웨이스트숍 제휴 데모',
    region: '전국',
    category: '지역상생',
    cost: 4500,
    stock: 0,
    description: '여행 중 일회용품 사용을 줄이는 다회용품 혜택입니다.',
    terms: '지정 여행 키트 1개',
    is_demo: true,
  },
  {
    id: 'preview-donation',
    title: '마일리지 지역기부 전환',
    merchant: '곳곳 지역상생 캠페인 데모',
    region: '전국',
    category: '지역상생',
    cost: 1000,
    stock: 0,
    description:
      '모은 마일리지를 지역의 작은 변화를 위한 기부로 잇는 혜택입니다.',
    terms: '1계정 월 5회 · 전환 후 취소 불가',
    is_demo: true,
  },
];
