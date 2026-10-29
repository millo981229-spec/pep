import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const gotgot = localFont({
  src: '../../public/fonts/GotgotSans.woff2',
  variable: '--font-gotgot',
  weight: '100 900',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: '곳곳 — 당신의 다음 지역 경험', template: '%s | 곳곳' },
  description:
    '전국의 문화·스포츠·여가를 발견하고, 취향에 맞는 지역활동과 지역 혜택을 만나는 반응형 웹 서비스.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={gotgot.variable}>
      <body>{children}</body>
    </html>
  );
}
