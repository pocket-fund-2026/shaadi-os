import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { C, F } from './ui';
import { CAT_ICON, Icon } from './icons';
import { tr } from './i18n';

// Decorative artwork is drawn locally, so it stays crisp and works offline.
export function FloralArch({ color = C.gold, size = 180 }: { color?: string; size?: number }) {
  const leaf = 'M0 0C-18-7-23-22-19-34C-2-29 6-16 0 0Z';
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size * 1.16} viewBox="0 0 180 210">
      <Path d="M33 193V91a57 57 0 0 1 114 0v102M43 193V91a47 47 0 0 1 94 0v102" stroke={color} strokeWidth="1" fill="none" opacity="0.55" />
      <Path d="M15 197c19-38 7-87 34-128M165 197c-19-38-7-87-34-128" stroke={color} strokeWidth="1.3" fill="none" />
      {[0, 1, 2, 3].map(i => <G key={i} opacity={0.65 - i * 0.07}>
        <Path d={leaf} fill={color} transform={`translate(${24 + i * 3} ${175 - i * 27}) rotate(${-20 + i * 15}) scale(.65)`} />
        <Path d={leaf} fill={color} transform={`translate(${156 - i * 3} ${175 - i * 27}) rotate(${20 - i * 15}) scale(-.65 .65)`} />
      </G>)}
      <G transform="translate(90 122)">
        {[0, 60, 120, 180, 240, 300].map(angle => <Path key={angle} d="M0-5C-15-18-11-33 0-39C11-33 15-18 0-5Z" fill="none" stroke={color} strokeWidth="1.2" transform={`rotate(${angle})`} />)}
        <Circle r="5" fill={color} />
      </G>
      <Path d="M65 167h50M74 172h32" stroke={color} opacity="0.55" />
      <Circle cx="90" cy="57" r="2.5" fill={color} />
    </Svg>
  </View>;
}

const PALETTES: Record<string, { bg: string; ink: string; light: string }> = {
  photographer: { bg: '#EEE5D8', ink: '#684935', light: '#D5C2A8' },
  makeup: { bg: '#F4E3E7', ink: '#8B405A', light: '#DDB6C3' },
  mehndi: { bg: '#E9EBDD', ink: '#586142', light: '#BEC4A8' },
  decor: { bg: '#F1E6D8', ink: '#8B6338', light: '#DDC39E' },
  venue: { bg: '#E4EBE5', ink: '#426451', light: '#B7CBBA' },
  caterer: { bg: '#F5E4DA', ink: '#935A40', light: '#DCBBA8' },
  dj: { bg: '#EEE5D8', ink: '#684935', light: '#D5C2A8' },
  pandit: { bg: '#F3E9D0', ink: '#856726', light: '#DECB98' },
};
export const categoryPalette = (category: string) => PALETTES[category] || PALETTES.decor;

export function CategoryCover({ category, label, large = false }: { category: string; label: string; large?: boolean }) {
  const palette = categoryPalette(category);
  return <View style={{ height: large ? 220 : 132, backgroundColor: palette.bg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
        <Path d="M45 220V132a82 82 0 0 1 164 0v88M54 220V132a73 73 0 0 1 146 0v88" fill="none" stroke={palette.light} strokeWidth="1.4" />
        <Circle cx="335" cy="30" r="88" fill={palette.light} opacity=".25" />
        <Circle cx="335" cy="30" r="71" fill="none" stroke={palette.light} />
        <Path d="M305 200c-18-30-1-69-26-99M279 129c-18 0-31-11-33-26 18-2 31 8 33 26M283 153c18-3 29-17 26-30-17 2-29 15-26 30" fill="none" stroke={palette.ink} opacity=".23" />
        <Rect x="14" y="14" width="372" height="172" rx="8" stroke={palette.ink} strokeWidth=".6" fill="none" opacity=".15" />
      </Svg>
    </View>
    <View style={{ width: large ? 82 : 58, height: large ? 82 : 58, borderRadius: 50, backgroundColor: '#FFFFFF99', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={CAT_ICON[category] || 'store'} size={large ? 38 : 28} color={palette.ink} strokeWidth={1.4} />
    </View>
    <Text style={{ fontSize: 13, fontWeight: '500', color: palette.ink, marginTop: 12, textAlign: 'center' }}>{label}</Text>
  </View>;
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 12, marginBottom: 16 }}>
    <Text accessibilityRole="header" style={{ flexShrink: 1, fontFamily: F.display, fontSize: 24, color: C.ink }}>{tr(title)}</Text>
    {detail && <Text style={{ color: C.mute, fontSize: 12 }}>{detail}</Text>}
  </View>;
}
