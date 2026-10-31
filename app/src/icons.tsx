import React from 'react';
import { Image } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

// Bespoke set drawn for Shaadi OS on a 24px grid, 1.6 stroke, round joins.
// Kept in-house so icons depict wedding work (diya, mandap, henna) instead of a stock library's generic glyphs.
type El = ['p', string, Opt?] | ['c', number, number, number, Opt?] | ['r', number, number, number, number, number, Opt?];
type Opt = { fill?: boolean; rotate?: number };

const petal = 'M12 10.2c-1.9-1.2-2.4-3.4-1.1-5.3.4-.6.7-.8 1.1-.8s.7.2 1.1.8c1.3 1.9.8 4.1-1.1 5.3z';

const I = {
  partnership: [['c', 9, 13, 5.5], ['c', 15, 13, 5.5], ['p', 'M7 5l2-2 2 2M13 5l2-2 2 2']],
  pin: [['p', 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z'], ['c', 12, 10, 2.4]],
  search: [['c', 10.5, 10.5, 6], ['p', 'M15 15l5 5']],
  chat: [['p', 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16h0A2.5 2.5 0 0 1 4 13.5z'], ['p', 'M8 8.8h8M8 11.8h5']],
  ledger: [['r', 5, 3.5, 14, 17, 2], ['p', 'M9 3.5v17M12 8h4M12 11.5h4']],
  checklist: [['p', 'M10 6.5h9.5M10 12h9.5M10 17.5h9.5'], ['p', 'M4.3 6.6l1.3 1.3 2.2-2.6M4.3 12.1l1.3 1.3 2.2-2.6'], ['c', 6, 17.5, 1.5]],
  person: [['c', 12, 8.5, 3.6], ['p', 'M5 20c.9-3.6 3.7-5.5 7-5.5s6.1 1.9 7 5.5']],
  inbox: [['p', 'M4 13l2.2-7.1A1.5 1.5 0 0 1 7.6 4.8h8.8a1.5 1.5 0 0 1 1.4 1.1L20 13v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z'], ['p', 'M4 13h4.5l1 2h5l1-2H20']],
  wallet: [['p', 'M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3'], ['p', 'M4 7.5v9A2.5 2.5 0 0 0 6.5 19H19a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z'], ['c', 16, 13.5, 1.1, { fill: true }]],
  store: [['p', 'M4 9l1.6-4.5h12.8L20 9'], ['p', 'M4 9c0 1.4 1.1 2.5 2.7 2.5S9.3 10.4 9.3 9c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.4 20 9'], ['p', 'M5.5 11.5v8h13v-8M10 19.5V15h4v4.5']],
  camera: [['p', 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z'], ['c', 12, 13, 3.5]],
  lipstick: [['r', 8.5, 13, 7, 8, 1.2], ['p', 'M10 13V9.4l4-2.6V13'], ['p', 'M7.5 13h9']],
  leaf: [['p', 'M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14z'], ['p', 'M5 19l8.5-8.5M10 14h3.5M13.5 10.5v3.5']],
  marigold: [['p', petal], ['p', petal, { rotate: 72 }], ['p', petal, { rotate: 144 }], ['p', petal, { rotate: 216 }], ['p', petal, { rotate: 288 }], ['c', 12, 12, 1.7, { fill: true }]],
  mandap: [['p', 'M3.5 20h17M6 20v-8M18 20v-8M6 12c0-3.3 2.7-6 6-6s6 2.7 6 6M12 6V3.5M10 20v-4.5a2 2 0 0 1 4 0V20']],
  cloche: [['p', 'M3.5 18.5h17M5.5 16.5a6.5 6.5 0 0 1 13 0zM12 10V8.5M10.8 8.2h2.4']],
  headphones: [['p', 'M5 14.5v-2.5a7 7 0 0 1 14 0v2.5'], ['p', 'M5 14h2a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM19 14h-2a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1z']],
  diya: [['p', 'M4 14h16c-.7 3-4 5-8 5s-7.3-2-8-5z'], ['p', 'M12 11.2c-1.3-.9-1.7-2.4-.9-3.9L12 5.5l.9 1.8c.8 1.5.4 3-.9 3.9z', { fill: true }]],
  seal: [['p', 'M12 3.5l2.1 1.5 2.6-.1.8 2.5L19.6 9l-.8 2.5.8 2.5-2.1 1.5-.8 2.5-2.6-.1L12 20.5l-2.1-1.5-2.6.1-.8-2.5L4.4 15l.8-2.5L4.4 10l2.1-1.5.8-2.5 2.6.1z'], ['p', 'M8.8 12.2l2.2 2.2 4.2-4.6']],
  star: [['p', 'M12 4l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z', { fill: true }]],
  heart: [['p', 'M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19z']],
  heartFill: [['p', 'M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19z', { fill: true }]],
  up: [['p', 'M12 5l6 7h-3.5v7h-5v-7H6z']],
  down: [['p', 'M12 5l6 7h-3.5v7h-5v-7H6z', { rotate: 180 }]],
  share: [['p', 'M12 4v11M8 8l4-4 4 4M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12']],
  send: [['p', 'M4.5 11.5L20 4.5 14.5 20l-2.8-6.2zM11.7 13.8L20 4.5']],
  check: [['p', 'M5 12.5l4.5 4.5L19 7.5']],
  chevron: [['p', 'M9.5 6l6 6-6 6']],
  shield: [['p', 'M12 3.5l7 2.6v5.2c0 4.4-3 7.8-7 9.2-4-1.4-7-4.8-7-9.2V6.1z'], ['p', 'M9 12l2.2 2.2L15.3 10']],
  ring: [['c', 12, 14.5, 5.5], ['p', 'M9.6 6.6l1.2-2.1h2.4l1.2 2.1L12 9.1z']],
  calendar: [['r', 4, 5.5, 16, 14.5, 2], ['p', 'M4 10h16M8.5 3.5v4M15.5 3.5v4']],
  logout: [['p', 'M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h9']],
  plus: [['p', 'M12 5v14M5 12h14']],
  close: [['p', 'M6.5 6.5l11 11M17.5 6.5l-11 11']],
  phone: [['p', 'M6.5 4h2.8l1.5 4-2 1.4a11 11 0 0 0 5.8 5.8l1.4-2 4 1.5v2.8a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z']],
  globe: [['c', 12, 12, 8], ['p', 'M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8S9.8 6.3 12 4z']],
  lock: [['r', 5.5, 10.5, 13, 9.5, 2], ['p', 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5']],
  flag: [['p', 'M6 20.5V4M6 4.5h10.5l-2 3.5 2 3.5H6']],
  receipt: [['p', 'M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z'], ['p', 'M9 8h6M9 11.5h6M9 15h3.5']],
  family: [['c', 9, 9, 3], ['p', 'M3.5 19c.7-3 2.8-4.6 5.5-4.6s4.8 1.6 5.5 4.6'], ['c', 16.5, 8.5, 2.4], ['p', 'M15.6 14.3c2.3.1 4 1.6 4.6 4.2']],
  eye: [['p', 'M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z'], ['c', 12, 12, 2.6]],
  alert: [['c', 12, 12, 8], ['p', 'M12 7.8v5M12 16h.01']],
  rupee: [['p', 'M7 5h10M7 9h10M9.5 5c4 0 4.6 8-.5 8H7l7.5 6.5']],
  sparkLine: [['p', 'M4 17l5-5 3.5 3.5L20 8M15 8h5v5']],
} satisfies Record<string, El[]>;

export type IconName = keyof typeof I;

export function Icon({ name, size = 22, color = '#241019', strokeWidth = 1.5 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const els: El[] = I[name] || I.alert;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {els.map((e, i) => {
        const o = (e[0] === 'p' ? e[2] : e[0] === 'c' ? e[4] : e[6]) as Opt | undefined;
        const paint = o?.fill ? { fill: color, stroke: 'none' } : { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
        const node = e[0] === 'p' ? <Path d={e[1]} {...paint} /> : e[0] === 'c' ? <Circle cx={e[1]} cy={e[2]} r={e[3]} {...paint} /> : <Rect x={e[1]} y={e[2]} width={e[3]} height={e[4]} rx={e[5]} {...paint} />;
        return o?.rotate ? <G key={i} transform={`rotate(${o.rotate} 12 12)`}>{node}</G> : <G key={i}>{node}</G>;
      })}
    </Svg>
  );
}

// Brand mark: a mandap arch over the sacred fire. Same geometry as brand/mark.svg and the app icon.
export function Logo({ size = 56, tile = '#7A1F3D', gold = '#E8C877', radius }: { size?: number; tile?: string; gold?: string; radius?: number }) {
  return <Image source={require('../assets/brand-icon-v3.png')} accessibilityLabel="Shaadi OS" style={{ width: size, height: size, borderRadius: radius ?? size * 0.22 }} />;
}

// Retained vector version of the first mark for reference and alternate contexts.
export function LegacyLogo({ size = 56, tile = '#7A1F3D', gold = '#E8C877', radius }: { size?: number; tile?: string; gold?: string; radius?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Rect x={0} y={0} width={1024} height={1024} rx={radius ?? 230} fill={tile} />
      <G transform="translate(512 512) scale(1.1) translate(-512 -506)">
        <Path d="M318 772V488C318 386 404 334 456 304C488 285 505 262 512 232C519 262 536 285 568 304C620 334 706 386 706 488V772" fill="none" stroke={gold} strokeWidth={54} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M268 772H756" stroke={gold} strokeWidth={54} strokeLinecap="round" />
        <Path d="M512 440C560 504 580 548 580 596C580 638 549 670 512 670C475 670 444 638 444 596C444 548 464 504 512 440Z" fill={gold} />
        <Path d="M512 556C529 580 536 598 536 616C536 632 525 643 512 643C499 643 488 632 488 616C488 598 495 580 512 556Z" fill={tile} />
      </G>
    </Svg>
  );
}

export const CAT_ICON: Record<string, IconName> = { photographer: 'camera', makeup: 'lipstick', mehndi: 'leaf', decor: 'marigold', venue: 'mandap', caterer: 'cloche', dj: 'headphones', pandit: 'diya' };
