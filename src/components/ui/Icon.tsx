/**
 * 게임 UI 아이콘 (24×24, currentColor)
 * - fill 아이콘은 짙은 반투명 조각으로 입체감을 줌
 * - 이모지 대신 사용해서 HUD를 일관된 톤으로 유지
 */
import type { SVGProps } from "react";

const SHADE = { fill: "#000", fillOpacity: 0.28 } as const;
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONS = {
  coin: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={1.4} />
      <path d="M12 8.2l2.3 3.8L12 15.8 9.7 12z" {...SHADE} />
    </>
  ),
  heart: (
    <>
      <path
        fill="currentColor"
        d="M12 20.6s-7.6-4.5-9.4-9.3C1.3 7.9 3.4 4.3 7.1 4.3c2.1 0 3.6 1.1 4.9 2.8 1.3-1.7 2.8-2.8 4.9-2.8 3.7 0 5.8 3.6 4.5 7-1.8 4.8-9.4 9.3-9.4 9.3z"
      />
      <path d="M6.3 7.4c-1 .5-1.6 1.5-1.6 2.6" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  crown: (
    <>
      {/* 받침까지 한 덩어리 (따로 떨어진 받침은 그림자·외곽선이 두 줄로 겹쳐 보임) */}
      <path
        fill="currentColor"
        d="M3 7.5l4.6 4.1L12 4.8l4.4 6.8L21 7.5l-1.6 9.4v3.3a.8.8 0 0 1-.8.8H5.4a.8.8 0 0 1-.8-.8v-3.3z"
      />
      <rect x="4.6" y="16.9" width="14.8" height="1.2" {...SHADE} />
      <circle cx="12" cy="12.8" r="1.5" {...SHADE} />
    </>
  ),
  skull: (
    <>
      <path
        fill="currentColor"
        d="M12 3C7.3 3 4 6.3 4 10.4c0 2.5 1.2 4.4 3 5.5V19a1 1 0 001 1h1.5v-2.2h1.5V20h2v-2.2h1.5V20H16a1 1 0 001-1v-3.1c1.8-1.1 3-3 3-5.5C20 6.3 16.7 3 12 3z"
      />
      <circle cx="9" cy="11" r="1.9" fill="#000" fillOpacity={0.6} />
      <circle cx="15" cy="11" r="1.9" fill="#000" fillOpacity={0.6} />
    </>
  ),
  flag: <path {...STROKE} d="M5.5 21V3.5M5.5 4.2h11.2l-2.2 4.2 2.2 4.3H5.5" />,
  swords: (
    <g {...STROKE}>
      <path d="M3.5 3.5l10.5 10.5M12 16.5l4.5-4.5M15 15l4 4" />
      <path d="M20.5 3.5L10 14M12 16.5L7.5 12M9 15l-4 4" />
    </g>
  ),
  sword: (
    <>
      <path fill="currentColor" d="M20.2 3.8l-.7 4L10.3 17 7 13.7l9.2-9.2z" />
      <path {...STROKE} d="M5.3 12.3l6.4 6.4M7.7 16.3L4 20" />
    </>
  ),
  orb: (
    <>
      <path fill="currentColor" d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z" />
      <path fill="currentColor" d="M18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  bolt: <path fill="currentColor" d="M13.5 2L5 13.5h6L9.5 22 19 9.8h-6.2z" />,
  range: (
    <>
      <circle cx="12" cy="12" r="8.5" {...STROKE} />
      <circle cx="12" cy="12" r="4.5" {...STROKE} strokeOpacity={0.6} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  drop: (
    <>
      <path fill="currentColor" d="M12 2.8s-6.3 7-6.3 11.2a6.3 6.3 0 0012.6 0C18.3 9.8 12 2.8 12 2.8z" />
      <path d="M9 14.2a3 3 0 002.4 2.9" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path fill="currentColor" d="M12 2.8l7.5 2.8v5.9c0 4.8-3.2 8.6-7.5 9.9-4.3-1.3-7.5-5.1-7.5-9.9V5.6z" />
      <path d="M12 5.4v13.4" stroke="#000" strokeOpacity={0.25} strokeWidth={1.4} />
    </>
  ),
  speed: <path {...STROKE} d="M5 6.5l5.5 5.5L5 17.5M12.5 6.5L18 12l-5.5 5.5" />,
  star: <path fill="currentColor" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  hourglass: <path {...STROKE} d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5s8 3.5 8 8.5" />,
  play: <path fill="currentColor" d="M8 5.2v13.6a.8.8 0 001.2.7l10.6-6.8a.8.8 0 000-1.4L9.2 4.5A.8.8 0 008 5.2z" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </>
  ),
  fast: <path fill="currentColor" d="M3.5 6.2v11.6l8.2-5.8zM12 6.2v11.6l8.5-5.8z" />,
  volumeOff: (
    <>
      <path fill="currentColor" d="M3.5 9.3h3.6L11.8 5v14l-4.7-4.3H3.5z" />
      <path {...STROKE} d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  volumeLow: (
    <>
      <path fill="currentColor" d="M3.5 9.3h3.6L11.8 5v14l-4.7-4.3H3.5z" />
      <path {...STROKE} d="M15.3 9.3a3.8 3.8 0 010 5.4" />
    </>
  ),
  volumeHigh: (
    <>
      <path fill="currentColor" d="M3.5 9.3h3.6L11.8 5v14l-4.7-4.3H3.5z" />
      <path {...STROKE} d="M15.3 9.3a3.8 3.8 0 010 5.4M17.9 6.6a7.6 7.6 0 010 10.8" />
    </>
  ),
  log: (
    <g {...STROKE}>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <circle cx="4.8" cy="7" r=".6" fill="currentColor" />
      <circle cx="4.8" cy="12" r=".6" fill="currentColor" />
      <circle cx="4.8" cy="17" r=".6" fill="currentColor" />
    </g>
  ),
  menu: <path {...STROKE} d="M4 7h16M4 12h16M4 17h16" />,
  gear: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
      <circle cx="12" cy="12" r="6.6" strokeOpacity={0.55} />
    </g>
  ),
  close: <path {...STROKE} d="M6 6l12 12M18 6L6 18" />,
  chevronLeft: <path {...STROKE} d="M15 5l-7 7 7 7" />,
  chevronRight: <path {...STROKE} d="M9 5l7 7-7 7" />,
  chevronDown: <path {...STROKE} d="M5 9l7 7 7-7" />,
  gem: (
    <>
      <path fill="currentColor" d="M7 3.5h10l4 5.2L12 21 3 8.7z" />
      <path d="M3 8.7h18M9 3.5L7.4 8.7 12 21l4.6-12.3L15 3.5" fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M8.2 5.2l-1 2.6" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.2} strokeLinecap="round" />
    </>
  ),
  chest: (
    <g {...STROKE}>
      <path d="M4 10h16v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5z" />
      <path d="M4 10V8.5A4.5 4.5 0 018.5 4h7A4.5 4.5 0 0120 8.5V10" />
      <path d="M10.5 12.5h3v3h-3z" />
    </g>
  ),
  target: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" />
    </g>
  ),
  home: <path {...STROKE} d="M4 11.2L12 4l8 7.2M6.3 9.4V20h11.4V9.4M10 20v-5h4v5" />,
  refresh: <path {...STROKE} d="M20 12a8 8 0 11-2.4-5.7M20 4.5v4.8h-4.8" />,
  trash: <path {...STROKE} d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.2 10.5v6M13.8 10.5v6" />,
  sparkles: (
    <>
      <path fill="currentColor" d="M10 3l1.6 4.8L16.4 9.4l-4.8 1.6L10 15.8l-1.6-4.8L3.6 9.4l4.8-1.6z" />
      <path fill="currentColor" d="M17.5 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
    </>
  ),
  hex: <path fill="currentColor" d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />,
  info: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6v.01" />
    </g>
  ),
  exit: <path {...STROKE} d="M14 4h3.5A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5H14M10 16l-4-4 4-4M6 12h10" />,
  recall: <path {...STROKE} d="M9 13.5l-4-4 4-4M5 9.5h9.5a5 5 0 010 10H11" />,
  check: <path {...STROKE} d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path {...STROKE} d="M12 5v14M5 12h14" />,
  map: <path {...STROKE} d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8zM9 4.5v12.7M15 6.8v12.7" />,
  flame: (
    <path
      fill="currentColor"
      d="M12 2.5c1 3.5 5.2 5.4 5.2 10.2a5.2 5.2 0 01-10.4 0c0-2.6 1.4-4.2 2.7-5.5.2 1.7 1 2.8 2.3 3.3-.4-3.1.2-5.7.2-8z"
    />
  ),
  moon: <path fill="currentColor" d="M15.2 3.4a8.6 8.6 0 104.9 14.9 7.1 7.1 0 01-4.9-14.9z" />,
  feather: <path {...STROKE} d="M20 4c-6.5 0-12.3 4.4-14 10.6L4.5 20l5.3-1.6C16 16.6 20 10.6 20 4zM14.5 9.5L5.5 18.5" />,
  ghost: (
    <>
      <path fill="currentColor" d="M12 3a7 7 0 00-7 7v10.5l2.3-1.7 2.4 1.7 2.3-1.7 2.3 1.7 2.4-1.7 2.3 1.7V10a7 7 0 00-7-7z" />
      <circle cx="9.5" cy="10.5" r="1.4" fill="#000" fillOpacity={0.55} />
      <circle cx="14.5" cy="10.5" r="1.4" fill="#000" fillOpacity={0.55} />
    </>
  ),
  leaf: (
    <>
      <path fill="currentColor" d="M20 4C9 4 4 9.5 4 16c0 1.5.4 2.8.9 4C6 13.5 10.5 9.5 16 8c-5 2.6-8.4 6.4-9.8 12.2 1 .3 2 .4 3 .4C16.8 20.6 20 14.5 20 4z" />
    </>
  ),
} satisfies Record<string, React.ReactNode>;

export type IconName = keyof typeof ICONS;

export default function Icon({
  name,
  className,
  title,
  ...rest
}: { name: IconName; title?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
      {...rest}
    >
      {title && <title>{title}</title>}
      {ICONS[name]}
    </svg>
  );
}

/** 직업군 문장 */
export const JOB_GROUP_ICON: Record<string, IconName> = {
  전사: "shield",
  무도가: "flame",
  헌터: "target",
  마법사: "orb",
  암살자: "moon",
  스페셜리스트: "feather",
};
