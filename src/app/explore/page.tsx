import type { Metadata } from 'next';
import { PlatformApp } from '@/components/platform-app';
export const metadata: Metadata = { title: '활동 둘러보기' };
export default function Page() {
  return <PlatformApp initialView="explore" />;
}
