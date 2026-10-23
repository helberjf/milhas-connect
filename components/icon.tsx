import type { CSSProperties } from "react";

const paths = {
  plane: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  calculator: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM8 7h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1",
  compare: "M5 20V10m7 10V4m7 16v-7M3 20h18",
  history: "M3 11a9 9 0 1 1 2.6 7M3 4v7h7m2-4v5l3 2",
  chevron: "m6 9 6 6 6-6", arrow: "M4 12h16m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14", check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6", menu: "M4 6h16M4 12h16M4 18h16",
  moon: "M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z",
  sun: "M12 3V1m0 22v-2M3 12H1m22 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4m-12.8 0-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  wallet: "M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h15v11H6a3 3 0 0 1-3-3V6m18 7h-5v4h5m-3-2h.01",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  receipt: "M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2-3-2ZM9 9h6m-6 4h6",
  fuel: "M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 7h6v4H6V7Zm8 6h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V8l-4-4m2 2-2 2 4 3",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5",
  filter: "M4 6h16M7 12h10m-7 6h4",
  shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
} as const;

export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}><path d={paths[name]} /></svg>;
}
