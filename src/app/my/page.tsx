import type { Metadata } from 'next';
import { PlatformApp } from '@/components/platform-app';
export const metadata: Metadata = { title: '마이 곳곳' };
export default function Page() {
  return <PlatformApp initialView="my" />;
}
