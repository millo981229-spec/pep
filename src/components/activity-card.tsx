import Image from 'next/image';
import { useState } from 'react';
import type { Activity } from '@/lib/catalog';
import { activityImageAlt, activityImageCredit } from '@/lib/category-photos';
import { checkInPlace, placeAcceptsCheckIn } from '@/lib/checkin';
import {
  activityArt,
  activityFallbackArt,
  activityPrice,
  activitySchedule,
} from '@/lib/catalog-filter';
import { Icon } from './icon';

export function ActivityCard({
  activity,
  saved,
  onOpen,
  onSave,
  today,
}: {
  activity: Activity;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  today: string;
}) {
  const [usingFallback, setUsingFallback] = useState(false);
  const credit = activityImageCredit(activity, usingFallback);
  const place = checkInPlace(activity.id);
  const canCheckIn = place && placeAcceptsCheckIn(place, today);
  return (
    <article className="activity-card">
      <div className="card-visual">
        <button
          className="card-image-button"
          onClick={onOpen}
          aria-label={`${activity.title} 상세 보기`}
        >
          <Image
            src={activityArt(activity)}
            alt={activityImageAlt(activity, usingFallback)}
            width={600}
            height={400}
            sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
            unoptimized={activity.photo?.path.startsWith('https://')}
            referrerPolicy="no-referrer"
            data-fallback-src={activityFallbackArt(activity)}
            onError={(event) => {
              const fallback = event.currentTarget.dataset.fallbackSrc;
              if (fallback && !event.currentTarget.src.endsWith(fallback)) {
                setUsingFallback(true);
                event.currentTarget.src = fallback;
              }
            }}
          />
        </button>
        <span className="image-badge">{activity.category}</span>
        {credit && <span className="photo-credit">{credit}</span>}
        {!activity.reference && (
          <button
            className={`save-button ${saved ? 'saved' : ''}`}
            onClick={onSave}
            aria-label={`${activity.title} ${saved ? '저장됨' : '저장'}`}
            aria-pressed={saved}
          >
            <Icon name="heart" size={19} />
          </button>
        )}
      </div>
      <div className="card-content">
        <div className="card-location">
          <span>
            <Icon name="pin" size={13} />
            {activity.city}
          </span>
          {activity.is_demo && <span className="preview-tag">예시</span>}
          {activity.reference && (
            <span className="preview-tag">
              {activity.reference.participationType === 'contact-required'
                ? '보호센터 안내'
                : activity.reference.kind === 'landmark'
                  ? '지역 명소'
                  : activity.reference.kind === 'place'
                    ? '활동 안내'
                    : '지역 정보'}
            </span>
          )}
        </div>
        <button className="card-title" onClick={onOpen}>
          {activity.title}
        </button>
        <p className="card-meta">
          <Icon name="clock" size={14} />
          {activity.reference
            ? activitySchedule(activity, today)
            : `${activity.duration} · ${activity.date}`}
        </p>
        <div className="card-bottom">
          <strong>{activityPrice(activity)}</strong>
          <span>
            {activity.is_demo ? '콘텐츠 미리보기' : '자세히 알아보기'}
            <Icon name="arrow" size={14} />
          </span>
        </div>
        {canCheckIn && (
          <button className="text-link" onClick={onOpen}>
            <Icon name="pin" size={14} />
            GPS 인증 +{place.reward.toLocaleString('ko-KR')} P
          </button>
        )}
      </div>
    </article>
  );
}
