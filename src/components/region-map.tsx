'use client';
import { regions } from '@/lib/catalog';

export function RegionMap({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string, query?: string) => void;
}) {
  return (
    <div className="korea-map">
      <svg
        viewBox="0 0 360 470"
        role="group"
        aria-label="전국 17개 시도 선택 지도"
      >
        <defs>
          <linearGradient id="land" x2="0.8" y2="1">
            <stop stopColor="#dceaff" />
            <stop offset="1" stopColor="#a8c8f7" />
          </linearGradient>
        </defs>
        <path
          className="map-land"
          d="M173 39 210 43 221 65 242 97 257 126 267 157 285 186 293 218 308 249 304 283 285 300 291 326 265 342 244 345 225 362 201 351 182 365 163 354 153 373 129 361 106 377 80 360 57 369 43 349 58 324 58 303 76 280 68 258 74 233 61 215 66 188 54 172 66 151 73 130 86 119 86 100 102 87 108 65 130 70 145 50Z"
        />
        <path
          className="map-divider"
          d="m99 88 46 14 39-13 35-29 M86 124l68 33 89-56 M67 173l68 6 48-23 77-2 M69 226l65 5 42-45 100 26 M76 277l68-12 58 16 83-35 M60 323l77-8 38 39 M144 264l-7 51 101 15 M201 281l19-61"
        />
        <ellipse
          className="map-land"
          cx="75"
          cy="422"
          rx="41"
          ry="15"
          transform="rotate(-14 75 422)"
        />
        <circle fill="#c6ddcf" cx="315" cy="105" r="5" />
        <text x="300" y="127" className="island-label">
          울릉도
        </text>
        <g
          role="button"
          tabIndex={0}
          aria-label="경상북도 울릉군 독도 지역 보기"
          aria-pressed={selected === 'gyeongbuk'}
          className={`dokdo-marker ${selected === 'gyeongbuk' ? 'selected' : ''}`}
          onClick={() => onSelect('gyeongbuk', '독도')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect('gyeongbuk', '독도');
            }
          }}
        >
          <title>대한민국 경상북도 울릉군 독도</title>
          <rect
            className="dokdo-hit-area"
            x="326"
            y="66"
            width="32"
            height="38"
            rx="7"
          />
          <circle cx="342" cy="91" r="3.5" />
          <circle cx="349" cy="88" r="2.4" />
          <text x="352" y="76" textAnchor="end" className="island-label">
            독도
          </text>
        </g>
        {regions.map((region) => (
          <g
            key={region.id}
            role="button"
            tabIndex={0}
            aria-label={`${region.name} 지역 보기`}
            aria-pressed={selected === region.id}
            onClick={() => onSelect(region.id, '')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(region.id, '');
              }
            }}
            className={`map-marker ${selected === region.id ? 'selected' : ''}`}
          >
            <rect
              x={region.x - 21}
              y={region.y - 15}
              width="42"
              height="30"
              rx="12"
            />
            <text x={region.x} y={region.y + 4} textAnchor="middle">
              {region.short}
            </text>
          </g>
        ))}
        <text x="12" y="465" className="map-caption">
          지역 선택용 개략도 · 실제 경계·축척과 다릅니다
        </text>
      </svg>
    </div>
  );
}
