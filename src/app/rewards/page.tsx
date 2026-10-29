import type { Metadata } from 'next';
import { PlatformApp } from '@/components/platform-app';
export const metadata: Metadata = { title: '마일리지 교환소' };
export default function Page() {
  return <PlatformApp initialView="rewards" />;
}
