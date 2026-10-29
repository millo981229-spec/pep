import type { CSSProperties } from 'react';

const paths = {
  search: 'm21 21-5-5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  spark:
    'm12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2 M21 2v4 M19 4h4',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6 M9 3v15 M15 6v15',
  ticket:
    'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5 M15 5v3 M15 11v2 M15 16v3',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  compass: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 m-6-4-3 5-5 3 3-5 5-3',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  close: 'm6 6 12 12 M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  leaf: 'M20 3C8 1 2 7 5 15s15 5 15-12ZM4 21 16 9',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 1v2 M12 21v2 M1 12h2 M21 12h2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2',
  art: 'M5 3h14v18H5V3 M8 8h8 M8 12h5 M8 16h8',
  activity: 'M2 12h5l3-9 4 18 3-9h5',
  chevron: 'm9 5 7 7-7 7',
  filter: 'M4 7h16 M7 12h10 M10 17h4',
  logout: 'M9 5H4v14h5 M9 12h13 m-5-5 5 5-5 5',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 11v6 M12 7h.01',
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
