'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  categories,
  activityCategories,
  previewOffers,
  regions,
  type Activity,
  type Category,
  type Offer,
} from '@/lib/catalog';
import { subregions } from '@/lib/locations';
import {
  activityImageAlt,
  activityImageCredit,
  categoryPhotos,
} from '@/lib/category-photos';
import {
  activityArt,
  activityFallbackArt,
  activityPrice,
  activitySchedule,
  catalogSearchParams,
  filterActivities,
} from '@/lib/catalog-filter';
import { ActivityCard } from './activity-card';
import { Barcode } from './barcode';
import { Icon, type IconName } from './icon';
import { Modal } from './modal';
import { RegionMap } from './region-map';

export type View = 'home' | 'explore' | 'map' | 'recommend' | 'rewards' | 'my';
const navigation: {
  view: View;
  href: string;
  label: string;
  icon: IconName;
}[] = [
  {
    view: 'explore',
    href: '/explore',
    label: '활동 둘러보기',
    icon: 'compass',
  },
  { view: 'map', href: '/map', label: '지역 지도', icon: 'map' },
  {
    view: 'recommend',
    href: '/recommend',
    label: 'AI 맞춤 추천',
    icon: 'spark',
  },
  {
    view: 'rewards',
    href: '/rewards',
    label: '마일리지 교환소',
    icon: 'ticket',
  },
];
type User = { id: string; username: string };
type Profile = {
  display_name: string;
  balance: number;
  interests: string[];
  gender: string;
};
type Saved = {
  id: string;
  activity_id: string;
  note: string;
  activities: Activity;
};
type Coupon = {
  id: string;
  cost: number;
  status: string;
  redeem_code: string;
  expires_at: string;
  offers: { title: string; merchant: string };
};
type Ledger = {
  id: string;
  amount: number;
  description: string;
  created_at: string;
};
type Participation = {
  id: string;
  activity_id: string;
  region: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  activities: Activity;
};
type Account = {
  profile: Profile[];
  saved: Saved[];
  coupons: Coupon[];
  ledger: Ledger[];
  participations: Participation[];
};
type Recommendation = { activityId: string; reason: string };

async function api<T>(
  url: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    ...(data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : {}),
    cache: 'no-store',
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || '요청을 처리하지 못했습니다.');
  return result as T;
}
const errorMessage = (error: unknown) =>
  error instanceof Error && error.name !== 'TimeoutError'
    ? error.message
    : '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';

export function PlatformApp({ initialView }: { initialView: View }) {
  const [activeView, setActiveView] = useState<View>(initialView);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [offers, setOffers] = useState(previewOffers);
  const [preview, setPreview] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState('');
  const [region, setRegion] = useState('all');
  const [district, setDistrict] = useState('all');
  const [category, setCategory] = useState<Category>('전체');
  const [query, setQuery] = useState('');
  const [headerQuery, setHeaderQuery] = useState('');
  const [headerSuggestions, setHeaderSuggestions] = useState<Activity[]>([]);
  const [headerSearching, setHeaderSearching] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [exchange, setExchange] = useState<Offer | null>(null);
  const [exchangeError, setExchangeError] = useState('');
  const exchangeRequest = useRef<string | null>(null);
  const [interests, setInterests] = useState<Category[]>(['자연·생태']);
  const [couponOpen, setCouponOpen] = useState<Coupon | null>(null);
  const [couponPreview, setCouponPreview] = useState<Offer | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [aiError, setAiError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [note, setNote] = useState('');
  const [participating, setParticipating] = useState(false);
  const [participationNote, setParticipationNote] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailImageFallbackId, setDetailImageFallbackId] = useState('');
  const [myTab, setMyTab] = useState<
    'saved' | 'visits' | 'coupons' | 'ledger' | 'profile'
  >('saved');
  const [editSaved, setEditSaved] = useState<Saved | null>(null);
  const [accountTime, setAccountTime] = useState(0);
  const catalogVersion = useRef(0);
  const [today, setToday] = useState('');
  const profile = account?.profile[0];
  const detailParticipation = detail
    ? account?.participations.find(
        (participation) => participation.activity_id === detail.id,
      )
    : undefined;
  const selectedRegion = regions.find((r) => r.id === region);
  const visible = filterActivities(activities, {
    region,
    district,
    category,
    query,
  });
  const detailImageFallback = detailImageFallbackId === detail?.id;

  useEffect(() => {
    const hashQuery = window.location.hash.split('?')[1];
    const params = new URLSearchParams(hashQuery || window.location.search);
    const categoryParam = params.get('category');
    const queryParam = params.get('q')?.trim() || '';
    const timer = window.setTimeout(() => {
      setActiveView(initialView);
      setCategory(
        categoryParam && categories.includes(categoryParam as Category)
          ? (categoryParam as Category)
          : '전체',
      );
      setQuery(queryParam);
      setHeaderQuery(queryParam);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialView]);

  useEffect(() => {
    const controller = new AbortController();
    const trimmed = headerQuery.trim();
    const timer = window.setTimeout(async () => {
      if (!trimmed) {
        setHeaderSuggestions([]);
        setHeaderSearching(false);
        return;
      }
      setHeaderSearching(true);
      try {
        const result = await api<{ activities: Activity[] }>(
          `/api/catalog?${new URLSearchParams({ query: trimmed })}`,
          undefined,
          controller.signal,
        );
        setHeaderSuggestions(result.activities.slice(0, 5));
      } catch {
        if (!controller.signal.aborted) setHeaderSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setHeaderSearching(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [headerQuery]);

  function showHeaderResults() {
    const trimmed = headerQuery.trim();
    setHeaderSearchOpen(false);
    setRegion('all');
    setDistrict('all');
    setCategory('전체');
    setQuery(trimmed);
    setActiveView('explore');
    window.setTimeout(
      () => document.getElementById('discover')?.scrollIntoView(),
      0,
    );
  }

  const loadCatalog = useCallback(
    (signal?: AbortSignal) => {
      const version = ++catalogVersion.current;
      setCatalogLoading(true);
      setCatalogError('');
      return api<{
        activities: Activity[];
        offers: Offer[];
        preview: boolean;
        hasMore: boolean;
      }>(
        `/api/catalog?${catalogSearchParams({ region, district, category, query })}`,
        undefined,
        signal,
      )
        .then((data) => {
          if (signal?.aborted || version !== catalogVersion.current) return;
          setActivities(data.activities);
          setOffers(data.offers);
          setPreview(data.preview);
          setPage(0);
          setHasMore(data.hasMore);
        })
        .catch((error) => {
          if (signal?.aborted || version !== catalogVersion.current) return;
          setCatalogError(errorMessage(error));
          setActivities([]);
          setOffers([]);
        })
        .finally(() => {
          if (!signal?.aborted && version === catalogVersion.current)
            setCatalogLoading(false);
        });
    },
    [region, district, category, query],
  );
  async function loadAccount() {
    setAccountError('');
    try {
      setAccount(await api<Account>('/api/account'));
      setAccountTime(Date.now());
    } catch (error) {
      setAccountError(errorMessage(error));
    }
  }
  useEffect(() => {
    api<{ user: User | null; configured: boolean }>('/api/session')
      .then((data) => {
        setUser(data.user);
        setConfigured(data.configured);
        if (data.user) void loadAccount();
      })
      .catch((error) => setAccountError(errorMessage(error)))
      .finally(() => setSessionLoading(false));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    catalogVersion.current += 1;
    const timer = setTimeout(() => void loadCatalog(controller.signal), 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
      catalogVersion.current += 1;
    };
  }, [loadCatalog]);
  useEffect(() => {
    const update = () => {
      setToday(
        new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(
          new Date(),
        ),
      );
      setAccountTime(Date.now());
    };
    const timer = setTimeout(update, 0);
    const interval = setInterval(update, 30_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function mutate(key: string, data: unknown) {
    if (busy) return;
    setBusy(key);
    try {
      const result = await api<{ message: string }>('/api/account', data);
      setToast(result.message);
      await loadAccount();
      return true;
    } catch (error) {
      throw error;
    } finally {
      setBusy('');
    }
  }
  function openAuth() {
    setAuthError('');
    setAuthNotice('');
    setAuthOpen(true);
  }
  async function saveActivity(activity: Activity) {
    if (activity.reference) {
      setToast(
        '지역 소개 정보입니다. 상세 화면에서 위치와 확인 링크를 이용해 주세요.',
      );
      return;
    }
    if (!user) {
      openAuth();
      return;
    }
    if (activity.is_demo) {
      setToast('이 활동은 미리보기입니다. 실제 활동 등록 후 저장할 수 있어요.');
      return;
    }
    const saved = account?.saved.find(
      (item) => item.activity_id === activity.id,
    );
    try {
      await mutate(
        activity.id,
        saved
          ? { action: 'remove', id: saved.id }
          : { action: 'save', activityId: activity.id, note: '' },
      );
    } catch (error) {
      setToast(errorMessage(error));
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy('auth');
    setAuthError('');
    setAuthNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ message: string; user: User }>(
        authMode === 'signup' ? '/api/register' : '/api/login',
        {
          username: String(form.get('username')).trim(),
          password: String(form.get('password')),
        },
      );
      setUser(result.user);
      setConfigured(true);
      await loadAccount();
      setAuthOpen(false);
      setToast(result.message);
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setBusy('');
    }
  }
  async function logout() {
    setBusy('logout');
    try {
      await api('/api/logout', {});
      setUser(null);
      setAccount(null);
      setRecommendations([]);
      setToast('로그아웃했습니다.');
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy('');
    }
  }
  async function recommend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      openAuth();
      return;
    }
    if (busy) return;
    setAiError('');
    setRecommendations([]);
    setBusy('ai');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ recommendations: Recommendation[] }>(
        '/api/recommend',
        {
          region,
          district,
          interests,
          budget: Number(form.get('budget')),
          request: String(form.get('request')),
          useGender: form.get('useGender') === 'on',
        },
      );
      setRecommendations(result.recommendations);
    } catch (error) {
      setAiError(errorMessage(error));
    } finally {
      setBusy('');
    }
  }
  function openDetail(activity: Activity) {
    setDetail(activity);
    setDetailError('');
    setParticipating(false);
    setParticipationNote('');
  }
  function couponStatus(coupon: Coupon) {
    if (coupon.status === 'used') return '사용 완료';
    if (coupon.status === 'cancelled') return '취소됨';
    if (new Date(coupon.expires_at).getTime() < accountTime) return '기간 만료';
    return '사용 가능';
  }
  function participationStatus(participation: Participation) {
    if (participation.status === 'approved') return '적립 완료';
    if (participation.status === 'rejected') return '확인 불가';
    return '확인 중';
  }
  const cards = (items: Activity[]) => (
    <div className="activity-grid">
      {items.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          today={today}
          saved={Boolean(
            account?.saved.some((s) => s.activity_id === activity.id),
          )}
          onOpen={() => openDetail(activity)}
          onSave={() => void saveActivity(activity)}
        />
      ))}
    </div>
  );
  const empty = (
    <div className="empty-state">
      <Icon name="compass" size={36} />
      <h3>
        {query.trim()
          ? `“${query.trim()}” 검색 결과가 아직 없어요`
          : '조건에 맞는 활동이 아직 없어요'}
      </h3>
      <p>
        다른 관심 분야도 살펴보세요.
        <br />
        여행·관광에서는 지역의 대표 명소를 만날 수 있어요.
      </p>
      <button
        className="button secondary"
        onClick={() => {
          if (category === '전체' && !query.trim()) {
            setRegion('all');
            setDistrict('all');
          }
          setCategory('전체');
          setQuery('');
        }}
      >
        {category !== '전체' || query.trim()
          ? '이 지역의 다른 활동 보기'
          : '조건 초기화'}
      </button>
    </div>
  );
  const regionSelect = (
    <select
      aria-label="지역 선택"
      value={region}
      onChange={(event) => {
        setRegion(event.target.value);
        setDistrict('all');
      }}
    >
      <option value="all">전국 모든 지역</option>
      {regions.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
  const districtSelect = (
    <select
      aria-label="시·군·구 선택"
      value={district}
      onChange={(event) => setDistrict(event.target.value)}
      disabled={region === 'all'}
    >
      <option value="all">
        {region === 'all' ? '먼저 시·도를 선택하세요' : '전체 시·군·구'}
      </option>
      {(subregions[region] || []).map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 바로가기
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="곳곳 홈">
            <span className="brand-symbol">
              <Icon name="pin" size={24} />
            </span>
            <span>
              곳곳<span className="brand-dot">.</span>
            </span>
          </Link>
          <form
            className="header-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              showHeaderResults();
            }}
          >
            <input
              type="search"
              value={headerQuery}
              onChange={(event) => {
                setHeaderQuery(event.target.value);
                setHeaderSearchOpen(true);
              }}
              onFocus={() => setHeaderSearchOpen(true)}
              onBlur={() =>
                window.setTimeout(() => setHeaderSearchOpen(false), 150)
              }
              placeholder="어디로 떠나볼까요?"
              aria-label="지역 활동 검색"
              maxLength={100}
            />
            <button
              type="button"
              className="header-search-trigger"
              aria-label="검색"
              onMouseDown={(event) => event.preventDefault()}
              onClick={showHeaderResults}
            >
              <Icon name="search" size={22} />
            </button>
            {headerSearchOpen && headerQuery.trim() && (
              <div className="header-suggestions" aria-live="polite">
                {headerSearching ? (
                  <p className="header-suggestion-state">검색하고 있어요…</p>
                ) : headerSuggestions.length ? (
                  <>
                    {headerSuggestions.map((activity) => (
                      <button
                        type="button"
                        className="header-suggestion-item"
                        key={activity.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setHeaderSearchOpen(false);
                          setRegion('all');
                          setDistrict('all');
                          setCategory('전체');
                          setQuery(headerQuery.trim());
                          setActiveView('explore');
                          openDetail(activity);
                        }}
                      >
                        <span className="suggestion-pin">
                          <Icon name="pin" size={16} />
                        </span>
                        <span>
                          <strong className="suggestion-title">
                            {activity.title}
                          </strong>
                          <small>
                            {activity.city} · {activity.category}
                          </small>
                        </span>
                        <Icon name="chevron" size={15} />
                      </button>
                    ))}
                    <button
                      type="submit"
                      className="header-all-results"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      “{headerQuery.trim()}” 전체 결과 보기
                      <Icon name="arrow" size={15} />
                    </button>
                  </>
                ) : (
                  <p className="header-suggestion-state">
                    일치하는 활동이 아직 없어요.
                  </p>
                )}
              </div>
            )}
          </form>
          <div className="header-account">
            {user ? (
              <>
                <Link href="/my" className="account-link">
                  <Icon name="user" size={18} />
                  <span>마이</span>
                </Link>
                <button
                  className="logout-button"
                  aria-label="로그아웃"
                  onClick={() => void logout()}
                  disabled={Boolean(busy)}
                >
                  <Icon name="logout" size={17} />
                </button>
              </>
            ) : (
              <button
                className="login-button"
                onClick={openAuth}
                disabled={sessionLoading}
              >
                <Icon name="user" size={18} />
                {sessionLoading ? '확인 중' : '로그인'}
              </button>
            )}
          </div>
        </div>
        <div className="header-menu-row">
          <nav className="desktop-nav" aria-label="주요 메뉴">
            <Link href="/explore" className="all-category-link">
              <span aria-hidden="true">☰</span> 전체 카테고리
            </Link>
            <span className="menu-divider" />
            <Link href="/" className={activeView === 'home' ? 'active' : ''}>
              홈
            </Link>
            {navigation.map((item) => (
              <Link
                key={item.view}
                href={item.href}
                className={activeView === item.view ? 'active' : ''}
              >
                {item.label}
                {item.view === 'recommend' && (
                  <span className="ai-label">AI</span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
        {navigation.map((item) => (
          <Link
            key={item.view}
            href={item.href}
            className={activeView === item.view ? 'active' : ''}
          >
            <Icon name={item.icon} size={19} />
            <span>
              {item.view === 'explore'
                ? '탐색'
                : item.view === 'map'
                  ? '지역 지도'
                  : item.view === 'recommend'
                    ? 'AI 추천'
                    : '교환소'}
            </span>
          </Link>
        ))}
        <Link href="/my" className={activeView === 'my' ? 'active' : ''}>
          <Icon name="user" size={19} />
          <span>마이</span>
        </Link>
      </nav>

      <main id="main">
        {activeView === 'home' && (
          <>
            <section className="hero-wrap">
              <div className="hero">
                <div className="hero-art">
                  <Image
                    src="/photos/buyeo.jpg"
                    alt="충남 부여 민곡서원과 한옥 풍경"
                    width={800}
                    height={520}
                    priority
                  />
                  <span className="hero-photo-credit">
                    충남 부여 · 사진 ⓒ 한국관광공사
                  </span>
                </div>
                <div className="hero-copy">
                  <span className="eyebrow">이번 주, 가까운 곳으로</span>
                  <h1>
                    우리 동네에서 시작하는
                    <br />
                    <span>새로운 하루</span>
                  </h1>
                  <p>
                    전국의 축제와 공연, 자연과 미식을 한 번에.
                    <br />내 취향에 맞는 지역 활동을 찾아보세요.
                  </p>
                  <Link href="/explore" className="button primary hero-cta">
                    지금 활동 찾기
                    <Icon name="arrow" size={18} />
                  </Link>
                </div>
              </div>
              <div className="home-notice">
                <strong>공지</strong>
                <span>전국 곳곳의 새로운 지역 활동을 지금 만나보세요.</span>
              </div>
              <section
                className="home-photo-section"
                aria-labelledby="home-photo-title"
              >
                <div className="home-photo-heading">
                  <div>
                    <span className="eyebrow">LOCAL MOMENTS</span>
                    <h2 id="home-photo-title">사진으로 먼저 만나는 지역</h2>
                  </div>
                  <span>사진 ⓒ 한국관광공사</span>
                </div>
                <div className="home-photo-rail">
                  {[
                    {
                      src: '/photos/buyeo.jpg',
                      alt: '충남 부여 민곡서원과 한옥 풍경',
                      region: '충남 부여',
                      caption: '고즈넉한 한옥과 백제의 시간',
                      query: '부여',
                    },
                    {
                      src: '/photos/sangju.jpg',
                      alt: '경북 상주 낙동강 풍경',
                      region: '경북 상주',
                      caption: '낙동강을 따라 만나는 여유',
                      query: '상주',
                    },
                    {
                      src: '/photos/seogwipo.jpg',
                      alt: '제주 서귀포의 자연 풍경',
                      region: '제주 서귀포',
                      caption: '섬의 바람과 정원이 머무는 곳',
                      query: '서귀포',
                    },
                    {
                      src: '/photos/jinju.jpg',
                      alt: '경남 진주의 지역 풍경',
                      region: '경남 진주',
                      caption: '남강과 지역 문화가 이어지는 도시',
                      query: '진주',
                    },
                  ].map((spot) => (
                    <Link
                      className="home-photo-card"
                      href={`/explore?q=${encodeURIComponent(spot.query)}`}
                      key={spot.src}
                    >
                      <Image
                        src={spot.src}
                        alt={spot.alt}
                        width={560}
                        height={360}
                        sizes="(max-width: 700px) 78vw, 25vw"
                      />
                      <span className="home-photo-copy">
                        <strong>{spot.region}</strong>
                        <small>{spot.caption}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
              <form
                className="search-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  document
                    .getElementById('discover')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="search-region">
                  <Icon name="pin" />
                  <span>
                    <small>어디로 떠나볼까요?</small>
                    {regionSelect}
                    {districtSelect}
                  </span>
                </div>
                <div className="search-divider" />
                <label className="search-keyword">
                  <Icon name="search" />
                  <span>
                    <small>어떤 경험을 찾으세요?</small>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="도시, 활동, 관심사를 검색해 보세요"
                      maxLength={100}
                    />
                  </span>
                </label>
                <button className="button primary search-submit" type="submit">
                  <Icon name="search" size={18} />
                  <span>찾아보기</span>
                </button>
              </form>
            </section>
            <section className="content-section quick-section">
              {activityCategories.map((label) => (
                <Link
                  href={`/explore?category=${encodeURIComponent(label)}`}
                  className="quick-item"
                  key={label}
                >
                  <span className="quick-icon">
                    <Image
                      src={categoryPhotos[label].path}
                      alt=""
                      width={128}
                      height={128}
                      sizes="64px"
                    />
                  </span>
                  <strong>{label}</strong>
                </Link>
              ))}
            </section>
          </>
        )}

        {(activeView === 'home' || activeView === 'explore') && (
          <section
            className={`content-section discover-section ${activeView === 'explore' ? 'page-section' : ''}`}
            id="discover"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">EXPLORE LOCAL</span>
                {activeView === 'home' ? (
                  <h2>요즘, 이런 경험 어때요?</h2>
                ) : (
                  <h1>당신의 취향이 닿는 곳</h1>
                )}
                <p>
                  {preview
                    ? '전국의 문화·공연·체험부터 자연·미식·지역 축제까지 찾아보세요.'
                    : '문화부터 스포츠까지, 나의 다음 활동을 찾아보세요.'}
                </p>
              </div>
              {activeView === 'home' && (
                <Link href="/explore" className="text-link">
                  전체 활동 보기
                  <Icon name="arrow" size={17} />
                </Link>
              )}
            </div>
            {activeView === 'explore' && (
              <div className="explore-search">
                {regionSelect}
                {districtSelect}
                <div className="inline-search">
                  <Icon name="search" size={19} />
                  <input
                    aria-label="활동 검색"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="도시 또는 활동 검색"
                    maxLength={100}
                  />
                </div>
              </div>
            )}
            <div className="category-tabs" role="group" aria-label="활동 분야">
              {categories.map((item, index) => (
                <button
                  key={item}
                  className={category === item ? 'selected' : ''}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                >
                  <Icon
                    name={
                      (
                        [
                          'compass',
                          'art',
                          'activity',
                          'leaf',
                          'sun',
                        ] as IconName[]
                      )[index % 5]
                    }
                    size={17}
                  />
                  {item}
                </button>
              ))}
            </div>
            {activities.some((activity) => activity.reference) && (
              <p className="preview-note">
                <Icon name="info" size={15} />
                공개 자료를 참고한 지역 정보입니다. 일정·영업 여부·가격은 상세
                화면의 확인 링크에서 확인해 주세요.
              </p>
            )}
            {query.trim() && !catalogLoading && !catalogError && (
              <p className="search-result-summary" role="status">
                <strong>“{query.trim()}”</strong> 검색 결과 {visible.length}개
              </p>
            )}
            {catalogLoading ? (
              <div className="loading-state" role="status">
                <span className="spinner" />
                활동을 불러오고 있어요.
              </div>
            ) : catalogError ? (
              <div className="error-state" role="alert">
                <p>{catalogError}</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setCatalogLoading(true);
                    setCatalogError('');
                    void loadCatalog();
                  }}
                >
                  다시 불러오기
                </button>
              </div>
            ) : visible.length ? (
              cards(activeView === 'home' ? visible.slice(0, 3) : visible)
            ) : (
              empty
            )}
            {activeView === 'explore' && hasMore && (
              <div className="center">
                <button
                  className="button secondary"
                  disabled={Boolean(busy) || catalogLoading}
                  onClick={async () => {
                    const version = catalogVersion.current;
                    setBusy('more');
                    try {
                      const next = await api<{
                        activities: Activity[];
                        hasMore: boolean;
                      }>(
                        `/api/catalog?${catalogSearchParams({ region, district, category, query }, page + 1)}`,
                      );
                      if (version !== catalogVersion.current) return;
                      setActivities((old) => [...old, ...next.activities]);
                      setPage((old) => old + 1);
                      setHasMore(next.hasMore);
                    } catch (error) {
                      setToast(errorMessage(error));
                    } finally {
                      setBusy('');
                    }
                  }}
                >
                  {busy === 'more' ? '불러오는 중…' : '활동 더 보기'}
                </button>
              </div>
            )}
          </section>
        )}

        {activeView === 'home' && (
          <>
            <section className="local-discovery content-section">
              <div className="local-intro">
                <span className="eyebrow">BEYOND THE FAMILIAR</span>
                <h2>
                  유명하지 않아도,
                  <br />
                  충분히 특별한 곳.
                </h2>
                <p>
                  큰 도시 너머 작은 동네에도
                  <br />
                  나만 알고 싶은 경험이 기다리고 있어요.
                </p>
                <Link href="/map" className="text-link">
                  전국의 이야기 만나기
                  <Icon name="arrow" size={17} />
                </Link>
              </div>
              <Link href="/map" className="region-feature">
                <Image
                  src="/photos/sangju.jpg"
                  alt="경북 상주 낙동강과 들녘 풍경"
                  width={800}
                  height={520}
                />
                <div>
                  <span>경북 상주 · 사진 ⓒ 한국관광공사</span>
                  <strong>작은 도시, 깊은 발견</strong>
                  <span className="region-feature-arrow">
                    <Icon name="arrow" />
                  </span>
                </div>
              </Link>
            </section>
            <section className="content-section reward-banner">
              <span className="banner-icon">
                <Icon name="ticket" size={44} />
              </span>
              <div>
                <span className="eyebrow">GOOD EXPERIENCES, GOOD REWARDS</span>
                <h2>좋은 경험이, 다음 즐거움으로.</h2>
                <p>참여를 확인받고 모은 마일리지로 지역의 혜택을 만나보세요.</p>
              </div>
              <Link href="/rewards" className="button dark">
                교환소 둘러보기
                <Icon name="arrow" size={17} />
              </Link>
            </section>
          </>
        )}

        {activeView === 'map' && (
          <section className="content-section page-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">A LITTLE CLOSER TO LOCAL</span>
                <h1>지도로 만나는 곳곳</h1>
                <p>지역을 선택하고, 그곳만의 이야기와 활동을 발견해 보세요.</p>
              </div>
            </div>
            <div className="map-layout">
              <div className="map-panel">
                <div className="map-panel-top">
                  <span>
                    <Icon name="map" size={17} />
                    대한민국
                  </span>
                  <span>17개 시·도 · 독도 포함</span>
                </div>
                <RegionMap
                  selected={region}
                  onSelect={(id, placeQuery = '') => {
                    setRegion(id);
                    setDistrict('all');
                    setCategory('전체');
                    setQuery(placeQuery);
                  }}
                />
                <div className="map-select-mobile">
                  {regionSelect}
                  {districtSelect}
                </div>
              </div>
              <div className="region-information">
                <span className="eyebrow">LOCAL STORY</span>
                <h2>
                  {selectedRegion
                    ? `${selectedRegion.name}, 조금 더 가까이`
                    : '어디의 이야기가 궁금하세요?'}
                </h2>
                <p>
                  {selectedRegion?.description ||
                    '지도에서 지역을 눌러보세요. 바쁜 도시의 골목부터 느린 마을의 풍경까지, 전국에는 서로 다른 매력이 있어요.'}
                </p>
                <div className="tag-list">
                  {(
                    selectedRegion?.tags || [
                      '전국 탐색',
                      '지역 이야기',
                      '새로운 발견',
                    ]
                  ).map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <div className="region-rule" />
                <h3>
                  {selectedRegion?.name || '전국'}에서 발견한 활동{' '}
                  <span className="count-label">{visible.length}</span>
                </h3>
                {preview && (
                  <p className="muted small">
                    공개 자료 기준 지역 정보이며, 최신 운영 여부를 확인해
                    주세요.
                  </p>
                )}
                {visible.length ? (
                  <div className="map-activities">
                    {visible.map((a) => (
                      <button
                        key={a.id}
                        className="map-activity-row"
                        onClick={() => openDetail(a)}
                      >
                        <Image
                          src={activityArt(a)}
                          alt=""
                          width={76}
                          height={60}
                        />
                        <span>
                          <small>
                            {a.city} · {a.category}
                          </small>
                          <strong>{a.title}</strong>
                        </span>
                        <Icon name="chevron" size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact">
                    <p>
                      이 지역의 활동을 준비하고 있어요.
                      <br />
                      다른 지역의 이야기도 둘러보세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeView === 'recommend' && (
          <section className="content-section page-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MADE FOR YOUR CURIOSITY</span>
                <h1>오늘의 취향, 다음의 경험</h1>
                <p>
                  관심사와 상황을 알려주세요. AI가 실제 활동 중에서 어울리는
                  경험을 찾아드려요.
                </p>
              </div>
              <span className="feature-label">
                <Icon name="spark" size={16} />
                AI CURATION
              </span>
            </div>
            <div className="recommend-layout">
              <form className="preferences-panel" onSubmit={recommend}>
                <h2>어떤 하루를 보내고 싶나요?</h2>
                <div className="field">
                  <span>떠나고 싶은 지역</span>
                  {regionSelect}
                  {districtSelect}
                </div>
                <fieldset>
                  <legend>
                    관심 있는 활동 <span className="muted">최대 8개</span>
                  </legend>
                  <div className="interest-options">
                    {activityCategories.map((c) => (
                      <button
                        type="button"
                        key={c}
                        className={interests.includes(c) ? 'selected' : ''}
                        aria-pressed={interests.includes(c)}
                        onClick={() =>
                          setInterests((old) =>
                            old.includes(c)
                              ? old.filter((v) => v !== c)
                              : old.length < 8
                                ? [...old, c]
                                : old,
                          )
                        }
                      >
                        {c}
                        {interests.includes(c) && (
                          <Icon name="check" size={15} />
                        )}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="field">
                  <span>활동 예산</span>
                  <select name="budget" defaultValue="100000">
                    <option value="0">무료 활동</option>
                    <option value="30000">3만 원 이하</option>
                    <option value="50000">5만 원 이하</option>
                    <option value="100000">10만 원 이하</option>
                    <option value="1000000">넉넉하게 둘러보기</option>
                  </select>
                </label>
                <label className="field">
                  <span>
                    더 알려주고 싶은 이야기 <small>선택</small>
                  </span>
                  <textarea
                    name="request"
                    maxLength={400}
                    rows={3}
                    placeholder="예: 혼자 조용히 쉬고 싶어요. 가벼운 산책을 좋아해요."
                  />
                  <small>
                    400자 이내 · 이름·연락처 등 개인정보는 입력하지 마세요.
                  </small>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" name="useGender" />
                  <span>
                    프로필에 직접 선택한 성별도 추천에 참고하기
                    <small>
                      선택 사항이며 활동 참여 자격을 제한하지 않아요.
                    </small>
                  </span>
                </label>
                <p className="small muted">
                  선택한 취향·요청·저장한 활동 ID가 AI 제공자에게 전달됩니다.
                  성별은 체크한 경우에만 전달됩니다.
                </p>
                <button
                  className="button primary full"
                  disabled={busy === 'ai' || interests.length === 0}
                >
                  <Icon name="spark" size={18} />
                  {busy === 'ai'
                    ? '취향에 맞는 활동을 찾는 중…'
                    : user
                      ? '나에게 맞는 활동 추천받기'
                      : '로그인하고 추천받기'}
                </button>
                <p className="form-footnote">
                  하루 최대 10회 · 실패한 요청도 횟수에 포함됩니다.
                </p>
              </form>
              <div className="recommend-results" aria-live="polite">
                {busy === 'ai' ? (
                  <div className="ai-empty">
                    <span className="ai-orb loading">
                      <Icon name="spark" size={35} />
                    </span>
                    <h2>당신의 다음 경험을 찾고 있어요</h2>
                    <p>
                      최대 18초 정도 걸릴 수 있어요.
                      <br />
                      다른 메뉴는 계속 이용할 수 있습니다.
                    </p>
                  </div>
                ) : aiError ? (
                  <div className="ai-empty">
                    <Icon name="info" size={35} />
                    <h2>추천을 잠시 쉬어갈게요</h2>
                    <p role="alert">{aiError}</p>
                    <Link href="/explore" className="button secondary">
                      직접 활동 둘러보기
                      <Icon name="arrow" size={17} />
                    </Link>
                  </div>
                ) : recommendations.length ? (
                  <>
                    <h2>이런 경험을 추천해요</h2>
                    {recommendations.map((rec, index) => (
                      <div className="recommendation-item" key={rec.activityId}>
                        <span className="recommend-number">0{index + 1}</span>
                        <div>
                          <h3>
                            {activities.find((a) => a.id === rec.activityId)
                              ?.title || '추천 지역활동'}
                          </h3>
                          <p>{rec.reason}</p>
                          <button
                            className="text-link"
                            disabled={busy === rec.activityId}
                            onClick={async () => {
                              const activity = activities.find(
                                (a) => a.id === rec.activityId,
                              );
                              if (activity) openDetail(activity);
                              else {
                                setBusy(rec.activityId);
                                try {
                                  const data = await api<{
                                    activities: Activity[];
                                  }>(
                                    `/api/catalog?activityId=${rec.activityId}`,
                                  );
                                  if (!data.activities[0])
                                    throw new Error(
                                      '이 활동은 현재 공개되지 않습니다. 다른 추천을 확인해 주세요.',
                                    );
                                  setActivities((old) =>
                                    old.some(
                                      (item) => item.id === rec.activityId,
                                    )
                                      ? old
                                      : [...old, data.activities[0]],
                                  );
                                  openDetail(data.activities[0]);
                                } catch (error) {
                                  setToast(errorMessage(error));
                                } finally {
                                  setBusy('');
                                }
                              }
                            }}
                          >
                            활동 확인하기
                            <Icon name="arrow" size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="ai-empty">
                    <span className="ai-orb">
                      <Icon name="spark" size={38} />
                    </span>
                    <span className="eyebrow">YOUR NEXT LITTLE ADVENTURE</span>
                    <h2>
                      좋아하는 것을 알려주면,
                      <br />
                      가보고 싶은 곳이 생겨요.
                    </h2>
                    <p>
                      유명한 순위 대신 나와 맞는 경험을.
                      <br />
                      추천 이유까지 함께 안내해 드릴게요.
                    </p>
                    <div className="ai-promises">
                      <span>
                        <Icon name="check" size={15} />
                        실제 등록된 활동만
                      </span>
                      <span>
                        <Icon name="check" size={15} />
                        취향에 맞는 추천 이유
                      </span>
                    </div>
                    {!configured && (
                      <span className="setup-notice">
                        AI·로그인 연결 준비 중
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeView === 'rewards' && (
          <section className="content-section page-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">EXPERIENCE MORE, ENJOY MORE</span>
                <h1>마일리지 교환소</h1>
                <p>
                  참여로 쌓은 경험을, 지역에서 누리는 즐거움으로 바꿔보세요.
                </p>
              </div>
              <Link href="/my" className="text-link">
                내 쿠폰함
                <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className="balance-banner">
              <span className="balance-icon">
                <Icon name="ticket" size={31} />
              </span>
              <div>
                <span>내가 모은 마일리지</span>
                <strong>
                  {user
                    ? `${(profile?.balance ?? 0).toLocaleString('ko-KR')}`
                    : '로그인하고 확인해 보세요'}
                  {user && <small> P</small>}
                </strong>
              </div>
              {user ? (
                <Link href="/my" className="button light">
                  적립·사용 내역
                  <Icon name="arrow" size={16} />
                </Link>
              ) : (
                <button className="button light" onClick={openAuth}>
                  로그인하기
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </div>
            <div className="how-it-works">
              <span>
                <b>01</b>활동에 참여하고
              </span>
              <Icon name="arrow" size={16} />
              <span>
                <b>02</b>참여 확인 후 적립
              </span>
              <Icon name="arrow" size={16} />
              <span>
                <b>03</b>지역 혜택으로 교환
              </span>
            </div>
            <div className="section-heading small-heading">
              <h2>다음 즐거움을 골라보세요</h2>
              <span className="muted small">
                {offers.length}개의 혜택{preview ? ' 예시' : ''}
              </span>
            </div>
            {preview && (
              <p className="preview-note">
                <Icon name="info" size={15} />
                제휴 전 혜택 예시입니다. 실제 쿠폰 발급·사용은 제공하지
                않습니다.
              </p>
            )}
            <div className="offer-grid">
              {offers.map((offer, index) => (
                <article key={offer.id} className="offer-card">
                  <div className={`offer-illustration offer-${index % 3}`}>
                    <Icon
                      name={
                        index % 3 === 0
                          ? 'sun'
                          : index % 3 === 1
                            ? 'leaf'
                            : 'art'
                      }
                      size={52}
                    />
                    <span>
                      {index % 3 === 0
                        ? 'A LITTLE BREAK'
                        : index % 3 === 1
                          ? 'MAKE SOMETHING'
                          : 'FIND INSPIRATION'}
                    </span>
                    <span className="offer-stamp">
                      곳곳
                      <br />
                      LOCAL
                    </span>
                  </div>
                  <div className="offer-body">
                    <span className="card-location">
                      {offer.region} · {offer.merchant}
                    </span>
                    <h3>{offer.title}</h3>
                    <p>{offer.description}</p>
                    <div className="offer-bottom">
                      <strong>
                        {offer.cost.toLocaleString('ko-KR')}
                        <small> P</small>
                      </strong>
                      <button
                        className="button secondary"
                        disabled={!offer.is_demo && offer.stock === 0}
                        onClick={() => {
                          if (offer.is_demo) {
                            setCouponPreview(offer);
                            return;
                          }
                          if (!user) {
                            openAuth();
                            return;
                          }
                          exchangeRequest.current = crypto.randomUUID();
                          setExchangeError('');
                          setExchange(offer);
                        }}
                      >
                        {offer.is_demo
                          ? '바코드 화면 미리보기'
                          : offer.stock === 0
                            ? '소진된 혜택'
                            : '교환하기'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!offers.length && !catalogLoading && (
              <div className="empty-state">
                <Icon name="ticket" size={35} />
                <h3>지역 혜택을 준비하고 있어요</h3>
                <p>실제 제휴 혜택이 등록되면 이곳에서 만날 수 있어요.</p>
              </div>
            )}
            <div className="notice-box">
              <Icon name="info" size={19} />
              <div>
                <strong>마일리지, 이렇게 이용해요</strong>
                <p>
                  활동을 저장하거나 방문 버튼을 누르는 것만으로 적립되지
                  않습니다. 실제 참여를 운영자가 확인한 뒤 적립됩니다. 교환 전
                  사용처·유효기간·이용 조건을 확인해 주세요.
                </p>
              </div>
            </div>
          </section>
        )}

        {activeView === 'my' && (
          <section className="content-section page-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR LOCAL JOURNEY</span>
                <h1>마이 곳곳</h1>
                <p>저장한 경험과 모아둔 즐거움을 한곳에서.</p>
              </div>
            </div>
            {sessionLoading ? (
              <div className="loading-state">로그인을 확인하고 있어요.</div>
            ) : !user ? (
              <div className="signin-panel">
                <span className="ai-orb">
                  <Icon name="user" size={34} />
                </span>
                <h2>나의 다음 경험을 모아보세요</h2>
                <p>
                  로그인하면 활동을 저장하고,
                  <br />
                  마일리지와 쿠폰을 안전하게 관리할 수 있어요.
                </p>
                <button className="button primary" onClick={openAuth}>
                  로그인하기
                  <Icon name="arrow" size={17} />
                </button>
                {!configured && (
                  <p className="small muted">
                    현재 로그인 서비스를 연결하는 중입니다.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="profile-summary">
                  <span className="profile-avatar">
                    <Icon name="user" size={28} />
                  </span>
                  <div>
                    <h2>{profile?.display_name || '여행자'}님의 곳곳</h2>
                    <p>@{user.username}</p>
                  </div>
                  <strong>
                    {(profile?.balance || 0).toLocaleString('ko-KR')}
                    <small> P</small>
                  </strong>
                </div>
                <div
                  className="category-tabs"
                  role="group"
                  aria-label="내 활동 메뉴"
                >
                  {(
                    ['saved', 'visits', 'coupons', 'ledger', 'profile'] as const
                  ).map((tab, index) => (
                    <button
                      key={tab}
                      onClick={() => setMyTab(tab)}
                      className={myTab === tab ? 'selected' : ''}
                      aria-pressed={myTab === tab}
                    >
                      {
                        [
                          '저장한 활동',
                          '방문 기록',
                          '내 쿠폰함',
                          '마일리지 내역',
                          '추천 프로필',
                        ][index]
                      }
                    </button>
                  ))}
                </div>
                {accountError ? (
                  <div className="error-state" role="alert">
                    <p>{accountError}</p>
                    <button
                      className="button secondary"
                      onClick={() => void loadAccount()}
                    >
                      다시 불러오기
                    </button>
                  </div>
                ) : !account ? (
                  <div className="loading-state">내 자료를 불러오는 중…</div>
                ) : (
                  <>
                    {myTab === 'saved' &&
                      (account.saved.length ? (
                        <div className="saved-list">
                          {account.saved.map((saved) => (
                            <article key={saved.id} className="saved-row">
                              <div>
                                <button
                                  className="card-title"
                                  onClick={() => openDetail(saved.activities)}
                                >
                                  {saved.activities.title}
                                </button>
                                <p>
                                  {saved.note ||
                                    '나만의 여행 메모를 남겨보세요.'}
                                </p>
                              </div>
                              <button
                                className="button secondary"
                                onClick={() => {
                                  setEditSaved(saved);
                                  setNote(saved.note);
                                }}
                              >
                                메모 수정
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`${saved.activities.title} 저장 삭제`}
                                disabled={Boolean(busy)}
                                onClick={async () => {
                                  try {
                                    await mutate(saved.id, {
                                      action: 'remove',
                                      id: saved.id,
                                    });
                                  } catch (error) {
                                    setToast(errorMessage(error));
                                  }
                                }}
                              >
                                <Icon name="close" />
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <Icon name="heart" size={35} />
                          <h3>다음에 가보고 싶은 곳을 저장해요</h3>
                          <p>
                            활동 카드의 하트를 누르면 여기에 모아둘 수 있어요.
                          </p>
                          <Link href="/explore" className="button secondary">
                            활동 둘러보기
                          </Link>
                        </div>
                      ))}
                    {myTab === 'visits' &&
                      (account.participations.length ? (
                        <div className="saved-list">
                          {account.participations.map((participation) => {
                            const reward = participation.activities.reward ?? 0;
                            return (
                              <article
                                key={participation.id}
                                className="saved-row visit-row"
                              >
                                <button
                                  className="card-title"
                                  onClick={() =>
                                    openDetail(participation.activities)
                                  }
                                >
                                  {participation.activities.title}
                                </button>
                                <div>
                                  <p>
                                    {participation.activities.city} ·{' '}
                                    {new Date(
                                      participation.created_at,
                                    ).toLocaleDateString('ko-KR', {
                                      timeZone: 'Asia/Seoul',
                                    })}
                                  </p>
                                  <small>
                                    {participationStatus(participation)}
                                    {reward > 0
                                      ? ` · ${reward.toLocaleString('ko-KR')} P`
                                      : ''}
                                  </small>
                                </div>
                                <span
                                  className={`status-pill participation-${participation.status}`}
                                >
                                  {participationStatus(participation)}
                                </span>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <Icon name="map" size={35} />
                          <h3>아직 방문한 곳이 없어요</h3>
                          <p>
                            활동에 참여한 뒤 방문 인증을 요청하면 이곳에
                            기록돼요.
                          </p>
                          <Link href="/explore" className="button secondary">
                            활동 둘러보기
                          </Link>
                        </div>
                      ))}
                    {myTab === 'coupons' &&
                      (account.coupons.length ? (
                        <div className="saved-list">
                          {account.coupons.map((coupon) => (
                            <button
                              type="button"
                              key={coupon.id}
                              className="saved-row coupon-row"
                              disabled={couponStatus(coupon) !== '사용 가능'}
                              onClick={() => setCouponOpen(coupon)}
                              aria-label={`${coupon.offers.title} 쿠폰 바코드 보기`}
                            >
                              <Icon name="ticket" size={25} />
                              <div>
                                <h3>{coupon.offers.title}</h3>
                                <p>
                                  {coupon.offers.merchant} ·{' '}
                                  {new Date(
                                    coupon.expires_at,
                                  ).toLocaleDateString('ko-KR', {
                                    timeZone: 'Asia/Seoul',
                                  })}
                                  까지
                                </p>
                                <small>
                                  쿠폰 코드 끝자리{' '}
                                  {coupon.redeem_code.slice(-8)}
                                </small>
                              </div>
                              <span className="status-pill">
                                {couponStatus(coupon)}
                              </span>
                              {couponStatus(coupon) === '사용 가능' && (
                                <Icon name="chevron" size={17} />
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <Icon name="ticket" size={35} />
                          <h3>아직 발급받은 쿠폰이 없어요</h3>
                          <p>마일리지를 모아 지역 혜택으로 바꿔보세요.</p>
                          <Link href="/rewards" className="button secondary">
                            교환소 둘러보기
                          </Link>
                        </div>
                      ))}
                    {myTab === 'ledger' &&
                      (account.ledger.length ? (
                        <div className="saved-list">
                          {account.ledger.map((entry) => (
                            <div key={entry.id} className="saved-row">
                              <div>
                                <strong>{entry.description}</strong>
                                <p>
                                  {new Date(entry.created_at).toLocaleString(
                                    'ko-KR',
                                    { timeZone: 'Asia/Seoul' },
                                  )}
                                </p>
                              </div>
                              <strong
                                className={entry.amount > 0 ? 'positive' : ''}
                              >
                                {entry.amount > 0 ? '+' : ''}
                                {entry.amount.toLocaleString('ko-KR')} P
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <h3>첫 경험을 기다리고 있어요</h3>
                          <p>참여가 확인되면 적립 내역을 확인할 수 있어요.</p>
                        </div>
                      ))}
                    {myTab === 'profile' && (
                      <form
                        className="profile-form preferences-panel"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          try {
                            await mutate('profile', {
                              action: 'profile',
                              displayName: String(form.get('displayName')),
                              interests: form.getAll('interests'),
                              gender: String(form.get('gender')),
                            });
                          } catch (error) {
                            setToast(errorMessage(error));
                          }
                        }}
                      >
                        <h2>내 추천 프로필</h2>
                        <label className="field">
                          <span>표시 이름</span>
                          <input
                            name="displayName"
                            defaultValue={profile?.display_name}
                            required
                            maxLength={30}
                          />
                        </label>
                        <fieldset>
                          <legend>관심 분야</legend>
                          {activityCategories.map((c) => (
                            <label key={c} className="checkbox-field">
                              <input
                                type="checkbox"
                                name="interests"
                                value={c}
                                defaultChecked={profile?.interests.includes(c)}
                              />
                              {c}
                            </label>
                          ))}
                        </fieldset>
                        <label className="field">
                          <span>
                            성별 <small>선택 사항</small>
                          </span>
                          <select
                            name="gender"
                            defaultValue={profile?.gender || 'unspecified'}
                          >
                            <option value="unspecified">선택 안 함</option>
                            <option value="woman">여성</option>
                            <option value="man">남성</option>
                            <option value="other">그 외</option>
                          </select>
                          <small>
                            언제든 변경·삭제할 수 있어요. AI 추천에서 별도로
                            동의한 경우에만 참고합니다.
                          </small>
                        </label>
                        <button
                          className="button primary"
                          disabled={Boolean(busy)}
                        >
                          {busy === 'profile' ? '저장 중…' : '프로필 저장'}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <Link href="/" className="brand footer-brand">
              곳곳<span className="brand-dot">.</span>
            </Link>
            <p>어디에나 있는, 나만의 새로운 경험.</p>
            <small>전국의 문화·스포츠·여가를 연결하는 지역활동 플랫폼</small>
          </div>
          <div className="footer-right">
            <span>일상과 여행 사이, 곳곳</span>
            <small>© 2026 GOTGOT. 현재 개발 중인 서비스입니다.</small>
            <small>예시 콘텐츠·혜택은 실제 예약·교환 대상이 아닙니다.</small>
          </div>
        </div>
      </footer>
      <div className="toast" role="status" aria-live="polite">
        {toast && (
          <span>
            <Icon name="info" size={18} />
            {toast}
            <button aria-label="알림 닫기" onClick={() => setToast('')}>
              <Icon name="close" size={16} />
            </button>
          </span>
        )}
      </div>

      {authOpen && (
        <Modal
          title={
            authMode === 'login'
              ? '곳곳에 다시 오신 걸 환영해요'
              : '나의 곳곳을 시작해 볼까요?'
          }
          onClose={() => {
            if (busy !== 'auth') setAuthOpen(false);
          }}
        >
          <p className="muted">경험을 저장하고, 지역의 즐거움을 이어가세요.</p>
          {!configured && (
            <div className="notice-box">
              <Icon name="info" />
              <p>
                단일 HTML 미리보기에서는 로그인이 비활성화됩니다. 실제 로그인은
                Express 서버로 실행한 웹에서 이용할 수 있어요.
              </p>
            </div>
          )}
          <form onSubmit={authenticate}>
            <label className="field">
              <span>아이디</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                required
                minLength={3}
                maxLength={24}
                placeholder="문자 또는 숫자 3~24자"
              />
            </label>
            <label className="field">
              <span>비밀번호</span>
              <input
                type="password"
                name="password"
                autoComplete={
                  authMode === 'login' ? 'current-password' : 'new-password'
                }
                required
                minLength={12}
                maxLength={128}
              />
              {authMode === 'signup' && (
                <small>
                  12자 이상 입력해 주세요. 비밀번호 원문은 서버에 저장되지
                  않습니다.
                </small>
              )}
            </label>
            {authError && (
              <p className="field-error" role="alert">
                {authError}
              </p>
            )}
            {authNotice && (
              <p className="success-message" role="status">
                {authNotice}
              </p>
            )}
            <button
              className="button primary full"
              disabled={!configured || busy === 'auth'}
            >
              {busy === 'auth'
                ? '처리 중…'
                : authMode === 'login'
                  ? '로그인'
                  : '회원가입'}
            </button>
            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
                setAuthNotice('');
              }}
            >
              {authMode === 'login'
                ? '처음이신가요? 회원가입'
                : '이미 계정이 있나요? 로그인'}
            </button>
            <p className="small muted">
              현재 비밀번호 재설정 화면은 준비 중입니다. 공개 운영 전에 계정
              복구 기능을 연결할 예정입니다.
            </p>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title={detail.title}
          onClose={() => {
            setDetail(null);
            setParticipating(false);
          }}
        >
          <span className="detail-category">
            {detail.city} · {detail.category}
          </span>
          <Image
            className="detail-image"
            src={activityArt(detail)}
            alt={activityImageAlt(detail, detailImageFallback)}
            width={800}
            height={520}
            unoptimized={detail.photo?.path.startsWith('https://')}
            referrerPolicy="no-referrer"
            data-fallback-src={activityFallbackArt(detail)}
            onError={(event) => {
              const fallback = event.currentTarget.dataset.fallbackSrc;
              if (fallback && !event.currentTarget.src.endsWith(fallback)) {
                setDetailImageFallbackId(detail.id);
                event.currentTarget.src = fallback;
              }
            }}
          />
          <p className="detail-photo-credit">
            {activityImageCredit(detail, detailImageFallback)}
            {detail.photo && !detailImageFallback
              ? ` · ${detail.photo.sourceLabel}`
              : ''}
          </p>
          <div className="detail-facts">
            <span>
              <Icon name="clock" size={17} />
              {detail.duration}
            </span>
            <strong>{activityPrice(detail)}</strong>
            {!detail.reference &&
              !detail.is_demo &&
              (detail.reward ?? 0) > 0 && (
                <strong className="reward-points">
                  참여 인증 +{(detail.reward ?? 0).toLocaleString('ko-KR')} P
                </strong>
              )}
          </div>
          <p className="detail-description">{detail.description}</p>
          <div className="tag-list">
            {detail.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
          {detail.reference ? (
            <div className="reference-info">
              <dl>
                <div>
                  <dt>
                    {detail.reference.kind === 'restaurant'
                      ? '영업 안내'
                      : detail.reference.kind === 'landmark' ||
                          detail.reference.kind === 'place'
                        ? '이용 안내'
                        : '일정 안내'}
                  </dt>
                  <dd>{activitySchedule(detail, today)}</dd>
                </div>
                <div>
                  <dt>주소·장소</dt>
                  <dd>{detail.reference.address}</dd>
                </div>
                <div>
                  <dt>자료 상태</dt>
                  <dd>
                    {detail.reference.verification === 'snapshot'
                      ? `공개 자료 대조 · ${detail.reference.checkedAt}`
                      : detail.reference.kind === 'landmark' ||
                          detail.reference.kind === 'place'
                        ? '최신 이용 정보 확인 필요 · 공식 안내 링크 제공'
                        : '최신 일정 미확인 · 안내 링크 제공'}
                  </dd>
                </div>
              </dl>
              <p className="small muted">{detail.reference.notice}</p>
              <div className="reference-links">
                <a
                  className="button primary"
                  href={`https://map.naver.com/p/search/${encodeURIComponent(detail.reference.address.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  지도에서 위치 찾기 <Icon name="pin" size={17} />
                </a>
                <a
                  className="button secondary"
                  href={detail.reference.website || detail.reference.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {detail.reference.kind === 'sports'
                    ? '경기·대회 일정 확인'
                    : detail.reference.kind === 'place'
                      ? '공식 이용·참여 안내'
                      : '방문 정보 확인'}{' '}
                  <Icon name="arrow" size={17} />
                </a>
              </div>
              <a
                className="reference-source"
                href={detail.reference.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                참고 자료: {detail.reference.sourceLabel}
              </a>
              <p className="small muted">
                지역 소개 정보로, 현재 곳곳의 예약·참여 인증·마일리지 적립
                대상은 아닙니다. 이미지는 장소 사진이 아닌 일러스트입니다.
              </p>
            </div>
          ) : detail.is_demo ? (
            <div className="notice-box">
              <Icon name="info" size={19} />
              <p>
                실제 행사가 아닌 콘텐츠 예시입니다. 일정·가격은 예시이며
                예약·참여 인증·마일리지 적립을 제공하지 않습니다.
              </p>
            </div>
          ) : (
            <>
              <p>일정: {detail.date}</p>
              <button
                className="button primary full"
                disabled={Boolean(busy)}
                onClick={() => void saveActivity(detail)}
              >
                <Icon name="heart" size={17} />
                {account?.saved.some((s) => s.activity_id === detail.id)
                  ? '저장 취소'
                  : '나의 활동으로 저장'}
              </button>
              {detailParticipation ? (
                <div className="participation-status-box">
                  <strong>
                    방문 인증 {participationStatus(detailParticipation)}
                  </strong>
                  <p>
                    {detailParticipation.status === 'approved'
                      ? `참여가 확인되어 ${(detail.reward ?? 0).toLocaleString('ko-KR')} P가 적립됐어요.`
                      : detailParticipation.status === 'rejected'
                        ? '참여를 확인하지 못했어요. 운영 안내를 확인해 주세요.'
                        : '운영자가 참여 내용을 확인하고 있어요. 확인이 끝나면 포인트가 적립됩니다.'}
                  </p>
                  <Link href="/my" className="text-link">
                    방문 기록 보기 <Icon name="arrow" size={15} />
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    className="button secondary full"
                    onClick={() => {
                      if (!user) {
                        setDetail(null);
                        openAuth();
                      } else setParticipating(true);
                    }}
                  >
                    방문 인증하고 포인트 받기
                  </button>
                  {participating && (
                    <form
                      onSubmit={async (event) => {
                        event.preventDefault();
                        setDetailError('');
                        try {
                          if (
                            await mutate('participate', {
                              action: 'participate',
                              activityId: detail.id,
                              region: detail.region,
                              note: participationNote,
                            })
                          ) {
                            setParticipating(false);
                            setParticipationNote('');
                          }
                        } catch (error) {
                          setDetailError(errorMessage(error));
                        }
                      }}
                    >
                      <label className="field">
                        <span>방문 내용을 알려주세요</span>
                        <textarea
                          value={participationNote}
                          onChange={(event) =>
                            setParticipationNote(event.target.value)
                          }
                          minLength={10}
                          maxLength={500}
                          required
                          placeholder="방문한 일정과 활동 내용을 10자 이상 적어주세요. 개인정보는 입력하지 마세요."
                        />
                      </label>
                      <p className="small muted">
                        운영자가 실제 방문을 확인한 후{' '}
                        {(detail.reward ?? 0).toLocaleString('ko-KR')} P를
                        적립합니다.
                      </p>
                      {detailError && (
                        <p className="field-error" role="alert">
                          {detailError}
                        </p>
                      )}
                      <button
                        className="button primary"
                        disabled={Boolean(busy)}
                      >
                        {busy === 'participate'
                          ? '인증 요청 중…'
                          : '방문 인증 요청 보내기'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          )}
        </Modal>
      )}
      {exchange && (
        <Modal
          title="이 혜택으로 교환할까요?"
          onClose={() => {
            if (busy !== 'exchange') setExchange(null);
          }}
        >
          <div className="exchange-summary">
            <Icon name="ticket" size={35} />
            <h3>{exchange.title}</h3>
            <p>{exchange.description}</p>
            <strong>{exchange.cost.toLocaleString('ko-KR')} P</strong>
          </div>
          <p className="small muted">
            교환하면 마일리지가 차감되고 쿠폰함에 발급됩니다. 실제 사용 조건과
            취소 정책을 확인한 뒤 진행해 주세요.
          </p>
          {exchangeError && (
            <p className="field-error" role="alert">
              {exchangeError}
            </p>
          )}
          <div className="button-row">
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={() => setExchange(null)}
            >
              돌아가기
            </button>
            <button
              className="button primary"
              disabled={
                Boolean(busy) || (profile?.balance || 0) < exchange.cost
              }
              onClick={async () => {
                setExchangeError('');
                try {
                  if (
                    await mutate('exchange', {
                      action: 'exchange',
                      offerId: exchange.id,
                      requestId: exchangeRequest.current,
                    })
                  )
                    setExchange(null);
                } catch (error) {
                  setExchangeError(errorMessage(error));
                }
              }}
            >
              {busy === 'exchange'
                ? '교환 중…'
                : (profile?.balance || 0) < exchange.cost
                  ? '마일리지가 부족해요'
                  : '교환 확정'}
            </button>
          </div>
        </Modal>
      )}
      {couponOpen && (
        <Modal title="지역 혜택 쿠폰" onClose={() => setCouponOpen(null)}>
          <div className="coupon-ticket">
            <span className="eyebrow">GOTGOT LOCAL BENEFIT</span>
            <h3>{couponOpen.offers.title}</h3>
            <p>{couponOpen.offers.merchant}</p>
            {couponStatus(couponOpen) === '사용 가능' ? (
              <Barcode value={couponOpen.redeem_code} />
            ) : (
              <p role="status">
                {couponStatus(couponOpen)} · 사용할 수 없는 쿠폰입니다.
              </p>
            )}
            <strong>
              {new Date(couponOpen.expires_at).toLocaleDateString('ko-KR', {
                timeZone: 'Asia/Seoul',
              })}
              까지
            </strong>
          </div>
          <div className="notice-box coupon-notice">
            <Icon name="info" size={19} />
            <p>
              사용처 직원에게 이 화면을 보여주세요. 직원이 바코드를 확인한 뒤
              사용 처리합니다. 사용 완료된 쿠폰은 다시 열 수 없습니다.
            </p>
          </div>
          <button
            className="button secondary full"
            onClick={() => setCouponOpen(null)}
          >
            쿠폰함으로 돌아가기
          </button>
        </Modal>
      )}
      {couponPreview && (
        <Modal
          title="쿠폰 바코드 미리보기"
          onClose={() => setCouponPreview(null)}
        >
          <div className="coupon-ticket demo-coupon">
            <span className="eyebrow">DEMO · NOT VALID</span>
            <h3>{couponPreview.title}</h3>
            <p>{couponPreview.merchant}</p>
            <Barcode value="DEMO-NOT-VALID" />
            <strong>실제 사용 불가</strong>
          </div>
          <div className="notice-box coupon-notice">
            <Icon name="info" size={19} />
            <p>
              바코드 화면의 디자인만 확인하는 미리보기입니다. 포인트가 차감되지
              않으며 실제 매장에서 사용할 수 없습니다.
            </p>
          </div>
          <button
            className="button secondary full"
            onClick={() => setCouponPreview(null)}
          >
            교환소로 돌아가기
          </button>
        </Modal>
      )}
      {editSaved && (
        <Modal
          title="나만의 여행 메모"
          onClose={() => {
            if (!busy) setEditSaved(null);
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                if (
                  await mutate('note', {
                    action: 'note',
                    id: editSaved.id,
                    note,
                  })
                )
                  setEditSaved(null);
              } catch (error) {
                setToast(errorMessage(error));
              }
            }}
          >
            <label className="field">
              <span>{editSaved.activities.title}</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={300}
                rows={5}
              />
              <small>{note.length}/300</small>
            </label>
            <button className="button primary full" disabled={Boolean(busy)}>
              {busy === 'note' ? '저장 중…' : '메모 저장'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
