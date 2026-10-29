import type { Metadata } from 'next';
import { PlatformApp } from '@/components/platform-app';
export const metadata: Metadata = { title: 'AI 맞춤 추천' };
export default function Page() {
  return <PlatformApp initialView="recommend" />;
}
