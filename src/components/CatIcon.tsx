// HeyKip's 2D icons: bold, flat, filled shapes with cut-out details, drawn on a 24px grid.
// One ink colour; cut-outs are see-through (a mask), so they sit on any colour.
// Same shapes as the canvas (cat_icons).
import { useId, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Mask, Path, Rect } from 'react-native-svg';

import type { IconKey } from '@/lib/budget';
import { colors } from '@/theme';

const ICONS: Record<IconKey, { solid: (ink: string) => ReactNode; cut: ReactNode | null }> = {
  food: {
    solid: (ink) => <><Path d="M2.4 11.2h19.2a9.6 9.6 0 0 1-9.6 8.6 9.6 9.6 0 0 1-9.6-8.6z" /><Rect x="8.2" y="19.4" width="7.6" height="2.6" rx="1" /><Path d="M11.4 9.4 18.6 2.6M14.6 9.6l7-5.6" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" /></>,
    cut: <><Rect x="5.4" y="13.2" width="13.2" height="1.6" rx=".8" /></>,
  },
  travel: {
    solid: (ink) => <><Path d="M6.9 4.4h10.2a1.4 1.4 0 0 1 1.3.9L20.3 10h.3a1.4 1.4 0 0 1 1.4 1.4v6H2v-6A1.4 1.4 0 0 1 3.4 10h.3l1.9-4.7a1.4 1.4 0 0 1 1.3-.9z" /><Rect x="3.4" y="16.6" width="4.4" height="4.2" rx="1" /><Rect x="16.2" y="16.6" width="4.4" height="4.2" rx="1" /></>,
    cut: <><Path d="M7.7 6.6h8.6l1.4 3.4H6.3z" /><Circle cx="6.2" cy="13.6" r="1.5" /><Circle cx="17.8" cy="13.6" r="1.5" /><Rect x="9.6" y="13" width="4.8" height="1.4" rx=".7" /></>,
  },
  shop: {
    solid: (ink) => <><Rect x="3.6" y="7.6" width="16.8" height="14" rx="2" /><Path d="M8 9.4V7a4 4 0 0 1 8 0v2.4" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" /></>,
    cut: <><Circle cx="8" cy="11.6" r="1.25" /><Circle cx="16" cy="11.6" r="1.25" /></>,
  },
  fun: {
    solid: (ink) => <><Path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5V10a2 2 0 0 0 0 4v3.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V14a2 2 0 0 0 0-4V6.5A1.5 1.5 0 0 1 4.5 5z" /></>,
    cut: <><Rect x="14.2" y="7" width="1.8" height="2.4" rx=".9" /><Rect x="14.2" y="10.8" width="1.8" height="2.4" rx=".9" /><Rect x="14.2" y="14.6" width="1.8" height="2.4" rx=".9" /></>,
  },
  health: {
    solid: (ink) => <><Path d="M12 21.2 3.6 13.3A5.6 5.6 0 0 1 12 5.9a5.6 5.6 0 0 1 8.4 7.4z" /></>,
    cut: <><Rect x="10.9" y="8.6" width="2.2" height="7.6" rx=".6" /><Rect x="8.2" y="11.3" width="7.6" height="2.2" rx=".6" /></>,
  },
  book: {
    solid: (ink) => <><Path d="M1.8 5.4c3.6-1.2 7-.8 9.4 1.2v14.6c-2.4-1.8-5.8-2.2-9.4-1.2z" /><Path d="M22.2 5.4c-3.6-1.2-7-.8-9.4 1.2v14.6c2.4-1.8 5.8-2.2 9.4-1.2z" /></>,
    cut: null,
  },
  gift: {
    solid: (ink) => <><Rect x="2.6" y="7.6" width="18.8" height="4.6" rx="1.2" /><Rect x="4" y="13.2" width="16" height="8.4" rx="1.2" /><Path d="M12 7.6C10.4 4 6.2 3 6.2 5.6c0 1.6 2.6 2 5.8 2zM12 7.6c1.6-3.6 5.8-4.6 5.8-2 0 1.6-2.6 2-5.8 2z" /></>,
    cut: <><Rect x="11.1" y="7.6" width="1.8" height="14" /></>,
  },
  more: {
    solid: (ink) => <><Circle cx="4.8" cy="12" r="2.4" /><Circle cx="12" cy="12" r="2.4" /><Circle cx="19.2" cy="12" r="2.4" /></>,
    cut: null,
  },
  rent: {
    solid: (ink) => <><Path d="M12 2.6 22.6 11h-2.8v9.6a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V11H1.4z" /></>,
    cut: <><Path d="M9.6 21.6v-5.1a2.4 2.4 0 0 1 4.8 0v5.1z" /></>,
  },
  bill: {
    solid: (ink) => <><Path d="M4.6 2.4h14.8v19.4l-2.47-1.6-2.47 1.6L12 20.2l-2.47 1.6-2.47-1.6-2.46 1.6z" /></>,
    cut: <><Rect x="8" y="6.4" width="8" height="2" rx="1" /><Rect x="8" y="10.4" width="8" height="2" rx="1" /><Rect x="8" y="14.4" width="4.6" height="2" rx="1" /></>,
  },
  shield: {
    solid: (ink) => <><Path d="M12 1.9 20.2 5v6.3c0 5.1-3.5 8.9-8.2 10.7-4.7-1.8-8.2-5.6-8.2-10.7V5z" /></>,
    cut: <><Circle cx="12" cy="11.6" r="3.7" fill="none" stroke="#000" strokeWidth="1.8" /></>,
  },
  cash: {
    solid: (ink) => <><Rect x="1.6" y="5.4" width="20.8" height="13.2" rx="2" /></>,
    cut: <><Circle cx="12" cy="12" r="3.1" /><Circle cx="5.4" cy="12" r="1.2" /><Circle cx="18.6" cy="12" r="1.2" /></>,
  },
  plane: {
    solid: (ink) => <><Path d="M12 1.8c.95 0 1.6 1.05 1.6 2.3v4.8l7.6 4.4v2.3l-7.6-2.3v4.5l2.3 1.8V21.3L12 20.3l-3.9 1v-1.7l2.3-1.8v-4.5l-7.6 2.3v-2.3l7.6-4.4V4.1c0-1.25.65-2.3 1.6-2.3z" /></>,
    cut: null,
  },
  phone: {
    solid: (ink) => <><Rect x="5.6" y="1.8" width="12.8" height="20.4" rx="3.2" /></>,
    cut: <><Rect x="7.8" y="4.4" width="8.4" height="13" rx="1.2" /><Rect x="10.3" y="19.1" width="3.4" height="1.3" rx=".65" /></>,
  },
  family: {
    solid: (ink) => <><Circle cx="8" cy="6.4" r="3.2" /><Circle cx="16.6" cy="8.2" r="2.6" /><Path d="M1.8 20.6c0-4 2.8-6.8 6.2-6.8s6.2 2.8 6.2 6.8z" /><Path d="M14.6 20.6c.1-2.8-.6-4.6-1.8-6 1-.8 2.2-1.2 3.8-1.2 3 0 5.6 2.4 5.6 7.2z" /></>,
    cut: null,
  },
  lipstick: {
    solid: (ink) => <><Path d="M9.2 2.6 14.6 1v6.4H9.2z" /><Rect x="8" y="8.6" width="8" height="3" rx=".8" /><Rect x="7.2" y="12.8" width="9.6" height="9" rx="1.4" /></>,
    cut: null,
  },
  shirt: {
    solid: (ink) => <><Path d="M8.6 3.2 3 5.8 1.6 10.6l3.6 1.4 1-2.2V21h11.6V9.8l1 2.2 3.6-1.4L21 5.8l-5.6-2.6c-.6 1.6-1.9 2.6-3.4 2.6s-2.8-1-3.4-2.6z" /></>,
    cut: null,
  },
  note: {
    solid: (ink) => <><Path d="M9 3.4 20.4 1.4v14.2a3.4 3.4 0 1 1-2.2-3.2V6.4L11.2 7.7v10.1A3.4 3.4 0 1 1 9 14.6z" /></>,
    cut: null,
  },
  ring: {
    solid: (ink) => <><Path d="M9.4 1.8h5.2l1.8 3-4.4 3.2-4.4-3.2z" /><Circle cx="12" cy="14.4" r="6.8" /></>,
    cut: <><Circle cx="12" cy="14.4" r="4.2" /></>,
  },
  sparkle: {
    solid: (ink) => <><Path d="M12 1.5c.5 4.9 2.6 7.6 8.5 8.6-5.9 1-8 3.7-8.5 8.6-.5-4.9-2.6-7.6-8.5-8.6 5.9-1 8-3.7 8.5-8.6z" /><Path d="M19.5 15.5c.2 2 1 3 3 3.4-2 .4-2.8 1.4-3 3.4-.2-2-1-3-3-3.4 2-.4 2.8-1.4 3-3.4z" /></>,
    cut: null,
  },
  shuffle: {
    solid: (ink) => <><Path d="M2 6.2h3.6c2.2 0 3.6 1 4.9 3l4.4 6.6c.9 1.3 1.7 1.8 3.1 1.8h.8v-2.4l4.4 3.5-4.4 3.5v-2.2H18c-2.2 0-3.6-1-4.9-3L8.7 10.4C7.8 9 7 8.6 5.6 8.6H2z" /><Path d="M2 15.4h3.6c1.4 0 2.2-.4 3-1.6l.6-.9 1.5 2.2-.2.3c-1.3 2-2.7 2.4-4.9 2.4H2z" /><Path d="m13.3 8.8.2-.3c1.3-2 2.7-3 4.5-3h.8V3.3l4.4 3.5-4.4 3.5V8.1h-.8c-1.4 0-2.2.5-3.1 1.8l-.1.1z" /></>,
    cut: null,
  },
  camera: {
    solid: (ink) => <><Path d="M8.4 3.4h7.2l1.6 2.6h3.2A1.8 1.8 0 0 1 22.2 7.8v11a1.8 1.8 0 0 1-1.8 1.8H3.6a1.8 1.8 0 0 1-1.8-1.8v-11A1.8 1.8 0 0 1 3.6 6h3.2z" /></>,
    cut: <><Circle cx="12" cy="13.2" r="4.6" /></>,
  },
  plus: {
    solid: (ink) => <><Rect x="10.6" y="3" width="2.8" height="18" rx="1.4" /><Rect x="3" y="10.6" width="18" height="2.8" rx="1.4" /></>,
    cut: null,
  },
};

export function CatIcon({ name, size = 24, ink = colors.ink }: { name: IconKey; size?: number; ink?: string }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const icon = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {icon.cut ? (
        <>
          <Defs>
            <Mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
              <Rect width="24" height="24" fill="#fff" />
              <G fill="#000">{icon.cut}</G>
            </Mask>
          </Defs>
          <G fill={ink} mask={`url(#${id})`}>
            {icon.solid(ink)}
          </G>
        </>
      ) : (
        <G fill={ink}>{icon.solid(ink)}</G>
      )}
    </Svg>
  );
}

/** The icon on its brand-coloured circle (Categories, Your month). */
export function CatBadge({ name, color, size = 38 }: { name: IconKey; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <CatIcon name={name} size={Math.round(size * 0.52)} ink={color === colors.ink ? '#FFFFFF' : colors.ink} />
    </View>
  );
}
