import type { Metadata } from 'next';
import { PlatformApp } from '@/components/platform-app';
export const metadata: Metadata = { title: '지역 지도' };
export default function Page() {
  return <PlatformApp initialView="map" />;
}
