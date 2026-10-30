'use client';

import Image from 'next/image';
import type { OfferCategory } from '@/lib/catalog';
import { Barcode } from './barcode';
import { Icon } from './icon';

export type CouponPassState = 'ready' | 'confirm' | 'used';

const categoryImages: Record<OfferCategory, string> = {
  식음료: '/photos/categories/food-gourmet.webp',
  '문화·체험': '/photos/categories/culture-art.webp',
  '스포츠·레저': '/photos/categories/sports-leisure.webp',
  '교통·이동': '/photos/categories/travel-tourism.webp',
  '여행·관광': '/photos/categories/travel-tourism.webp',
  지역상품: '/photos/categories/craft-one-day.webp',
  지역상생: '/photos/categories/volunteer-community.webp',
};

export function CouponPass({
  title,
  merchant,
  category,
  terms,
  barcode,
  expiresLabel,
  state,
  preview,
  busy,
  onRequestConfirm,
  onCancelConfirm,
  onConfirm,
}: {
  title: string;
  merchant: string;
  category: OfferCategory;
  terms: string;
  barcode: string;
  expiresLabel: string;
  state: CouponPassState;
  preview?: boolean;
  busy?: boolean;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="coupon-pass-wrap">
      <section className={`coupon-pass ${state === 'used' ? 'is-used' : ''}`}>
        <div className="coupon-pass-photo">
          <Image
            src={categoryImages[category]}
            alt={`${title} 혜택 이미지`}
            fill
            sizes="(max-width: 560px) 100vw, 500px"
          />
          <span>{category}</span>
        </div>
        <div className="coupon-pass-barcode">
          <Barcode value={barcode} />
        </div>
        <div className="coupon-cut-line" aria-hidden="true" />
        <div className="coupon-pass-info">
          <span>{merchant}</span>
          <strong>{title}</strong>
          <p>{expiresLabel}</p>
          <button
            type="button"
            className="coupon-staff-button"
            disabled={state === 'used' || busy}
            onClick={onRequestConfirm}
          >
            {state === 'used'
              ? '쿠폰 사용완료'
              : busy
                ? '처리 중…'
                : '직원 확인'}
          </button>
          <p className="coupon-pass-terms">{terms}</p>
          {preview && (
            <small>
              화면 시연용 쿠폰입니다. 포인트가 차감되지 않으며 실제 매장에서
              사용할 수 없습니다.
            </small>
          )}
          {state === 'used' && (
            <div className="coupon-used-message" role="status">
              <Icon name="check" size={20} />
              직원 확인이 완료되었습니다.
            </div>
          )}
        </div>
      </section>

      {state === 'confirm' && (
        <div className="coupon-confirm-layer">
          <section
            className="coupon-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="coupon-confirm-title"
          >
            <h3 id="coupon-confirm-title">직원 확인 처리를 하시겠습니까?</h3>
            <p>
              확인 후에는 쿠폰이 사용 완료되어 다시 사용할 수 없습니다. 매장
              직원이 확인한 경우에만 진행해 주세요.
            </p>
            <div>
              <button type="button" onClick={onCancelConfirm}>
                취소
              </button>
              <button type="button" onClick={onConfirm} disabled={busy}>
                {busy ? '처리 중…' : '확인'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
