import type { Metadata } from 'next';
import { PlatformApp } from '@/components/platform-app';
export const metadata: Metadata = { title: '곳곳드림' };
export default function Page() {
  return <PlatformApp initialView="rewards" />;
}
