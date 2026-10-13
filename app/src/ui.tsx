import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, Pressable, View, StyleSheet, TextInputProps, Alert, Platform, Animated, Easing, AccessibilityInfo, ActivityIndicator } from 'react-native';
import { Icon, IconName } from './icons';

export const C = {
  primary: '#74263F', primaryDark: '#4D192C', gold: '#896522', goldSoft: '#F3E8D1',
  bg: '#FAF7F2', card: '#FFFEFC', ink: '#2C2024', mute: '#75656B', faint: '#87767D',
  ok: '#1E7A50', okSoft: '#E3F2EA', warn: '#A8402A', warnSoft: '#FAE9E3', line: '#EADCD3', chipBg: '#F3E9E0', tint: '#F6ECEF',
};
// Fraunces is used for display text only: wedding stationery is set in warm serifs, so headings borrow that register.
export const F = { display: 'Fraunces_600SemiBold', displayBold: 'Fraunces_700Bold' };
const ND = Platform.OS !== 'web';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => { if (active) setReduced(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return { reduced: reduced !== false, ready: reduced !== null };
}
export const MOTION = { control: 160, reveal: 220, progress: 320, easing: Easing.out(Easing.cubic) };

export function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: string }) {
  const { reduced } = useReducedMotion();
  const value = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { value.stopAnimation(); value.setValue(focused ? 1 : 0); return; }
    const animation = Animated.timing(value, { toValue: focused ? 1 : 0, duration: MOTION.control, easing: MOTION.easing, useNativeDriver: ND });
    animation.start(); return () => animation.stop();
  }, [focused, reduced, value]);
  return <Animated.View style={{ width: 38, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.tint : 'transparent', transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }}><Icon name={name} size={22} color={color} strokeWidth={focused ? 2 : 1.6} /></Animated.View>;
}

// Indian number format: ₹4.5 L, ₹1.2 Cr
export const inr = (paise: number) => { const r = (paise || 0) / 100; if (r >= 1e7) return `₹${+(r / 1e7).toFixed(2)} Cr`; if (r >= 1e5) return `₹${+(r / 1e5).toFixed(2)} L`; return '₹' + r.toLocaleString('en-IN'); };

// Press feedback: a small spring scale so a tap visibly registers on touch screens (no hover there).
function usePress(to = 0.97) {
  const { reduced } = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (reduced) { v.stopAnimation(); v.setValue(1); } return () => v.stopAnimation(); }, [reduced, v]);
  const go = (n: number) => { if (reduced) return; Animated.spring(v, { toValue: n, useNativeDriver: ND, speed: 40, bounciness: 0 }).start(); };
  return { style: { transform: [{ scale: v }] }, onPressIn: () => go(to), onPressOut: () => go(1) };
}

// One-shot entry for list rows as data arrives; stagger capped so long lists don't drip in.
export function Rise({ i = 0, children, style }: { i?: number; children: React.ReactNode; style?: any }) {
  const { reduced, ready } = useReducedMotion();
  const entered = useRef(false);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!ready) return;
    if (reduced) { v.stopAnimation(); v.setValue(1); entered.current = true; return; }
    if (entered.current) return;
    entered.current = true;
    v.setValue(0);
    const animation = Animated.timing(v, { toValue: 1, duration: MOTION.reveal, delay: Math.min(i, 3) * 30, easing: MOTION.easing, useNativeDriver: ND });
    animation.start(); return () => { animation.stop(); v.setValue(1); };
  }, [ready, reduced, i, v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>{children}</Animated.View>;
}

type BtnKind = 'primary' | 'ghost' | 'ok' | 'quiet';
export const Btn = ({ title, onPress, kind = 'primary', disabled, icon, small }: { title: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; icon?: IconName; small?: boolean }) => {
  const p = usePress();
  const fg = kind === 'ghost' || kind === 'quiet' ? C.primary : '#fff';
  return (
      <AnimatedPressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut}
        style={[s.btn, { marginVertical: 5 }, small && s.btnSmall, kind === 'primary' && s.btnLift, kind === 'ghost' && s.btnGhost, kind === 'quiet' && s.btnQuiet, kind === 'ok' && { backgroundColor: C.ok }, disabled && { opacity: 0.45 }, p.style]}>
        {icon ? <View style={{ marginRight: 8 }}><Icon name={icon} size={small ? 16 : 18} color={fg} /></View> : null}
        <Text style={[s.btnT, small && { fontSize: 14 }, { color: fg, flexShrink: 1, textAlign: 'center' }]}>{title}</Text>
      </AnimatedPressable>);
};

export const Input = (p: TextInputProps & { label?: string }) => {
  const [focus, setFocus] = useState(false);
  return (<View style={{ marginBottom: 12 }}>{p.label ? <Text style={s.label}>{p.label}</Text> : null}
    <TextInput accessibilityLabel={p.label || p.placeholder} placeholderTextColor={C.faint} {...p} onFocus={e => { setFocus(true); p.onFocus?.(e); }} onBlur={e => { setFocus(false); p.onBlur?.(e); }} style={[s.input, focus && { borderColor: C.primary, borderWidth: 2, paddingHorizontal: 13, paddingVertical: 13 }, p.style]} /></View>);
};

export const Card = ({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: any }) => {
  const p = usePress(0.985);
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return <AnimatedPressable accessibilityRole="button" onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut} style={[s.card, style, p.style]}>{children}</AnimatedPressable>;
};

export const H = ({ children, style }: { children: React.ReactNode; style?: any }) => <Text accessibilityRole="header" style={[{ fontFamily: F.display, fontSize: 24, color: C.ink, marginVertical: 10 }, style]}>{children}</Text>;
export const M = ({ children, style }: any) => <Text style={[{ color: C.mute, fontSize: 13, lineHeight: 18 }, style]}>{children}</Text>;

export const Chip = ({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName }) => {
  const p = usePress(0.97);
  return (<AnimatedPressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut} hitSlop={6} style={[s.chip, on && s.chipOn, p.style]}>
    {icon ? <View style={{ marginRight: 5 }}><Icon name={icon} size={14} color={on ? '#fff' : C.ink} /></View> : null}
    <Text style={{ color: on ? '#fff' : C.ink, fontSize: 13, fontWeight: on ? '600' : '500', flexShrink: 1 }}>{label}</Text></AnimatedPressable>);
};

// A status label that marks real state (verified, escrow, RSVP). Sentence case, no glow, no pulse.
export const Tag = ({ label, tone = 'mute', icon }: { label: string; tone?: 'ok' | 'warn' | 'gold' | 'mute'; icon?: IconName }) => {
  const fg = tone === 'ok' ? C.ok : tone === 'warn' ? C.warn : tone === 'gold' ? C.gold : C.mute;
  const bg = tone === 'ok' ? C.okSoft : tone === 'warn' ? C.warnSoft : tone === 'gold' ? C.goldSoft : C.chipBg;
  return (<View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' }}>
    {icon ? <View style={{ marginRight: 4 }}><Icon name={icon} size={12} color={fg} strokeWidth={2} /></View> : null}
    <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text></View>);
};

export const Stars = ({ n, size = 13 }: { n: number; size?: number }) => (
  <View style={{ flexDirection: 'row' }}>{[1, 2, 3, 4, 5].map(i => <Icon key={i} name="star" size={size} color={i <= n ? C.gold : C.line} />)}</View>);

// Empty state names the cause and offers the one action that fills it.
export const Empty = ({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) => (
  <Rise style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28 }}>
    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name={icon} size={24} color={C.primary} /></View>
    <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink, marginBottom: 4, textAlign: 'center' }}>{title}</Text>
    <M style={{ textAlign: 'center' }}>{text}</M>
    {action && onAction ? <View style={{ marginTop: 12 }}><Btn small kind="ghost" title={action} onPress={onAction} /></View> : null}
  </Rise>);

export const Loading = ({ what }: { what: string }) => <View accessibilityRole="progressbar" style={{ padding: 28, alignItems: 'center', gap: 12 }}><ActivityIndicator color={C.primary} /><M>Loading {what}…</M></View>;

// Animated fill for progress; animates once when the value changes so the change itself is visible.
export const Bar = ({ pct, color = C.primary }: { pct: number; color?: string }) => {
  const { reduced } = useReducedMotion();
  const value = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const v = useRef(new Animated.Value(value)).current;
  useEffect(() => { if (reduced) { v.stopAnimation(); v.setValue(value); return; } const animation = Animated.timing(v, { toValue: value, duration: MOTION.progress, easing: MOTION.easing, useNativeDriver: false }); animation.start(); return () => animation.stop(); }, [value, reduced, v]);
  return (<View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }} style={{ height: 5, borderRadius: 3, backgroundColor: C.chipBg, overflow: 'hidden' }}>
    <Animated.View style={{ height: '100%', borderRadius: 3, backgroundColor: color, width: v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} /></View>);
};

// Checkbox pops on toggle to confirm the tap landed.
export const Check = ({ on }: { on: boolean }) => {
  const { reduced } = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current; const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (reduced) { v.stopAnimation(); v.setValue(1); return; } v.setValue(0.9); const animation = Animated.spring(v, { toValue: 1, useNativeDriver: ND, speed: 35, bounciness: 0 }); animation.start(); return () => { animation.stop(); v.setValue(1); }; }, [on, reduced, v]);
  return (<Animated.View style={{ transform: [{ scale: v }], width: 24, height: 24, borderRadius: 7, borderWidth: 1.6, borderColor: on ? C.ok : C.faint, backgroundColor: on ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
    {on ? <Icon name="check" size={15} color="#fff" strokeWidth={2.4} /> : null}</Animated.View>);
};

// Alert.alert with buttons does nothing on react-native-web, so confirmations route to window.confirm there.
export const confirm = (title: string, message: string, ok: string, destructive = false) => new Promise<boolean>(res => {
  if (Platform.OS === 'web') return res((globalThis as any).confirm(`${title}\n\n${message}`));
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel', onPress: () => res(false) }, { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => res(true) }], { cancelable: true, onDismiss: () => res(false) });
});
export const notify = (title: string, message: string) => Platform.OS === 'web' ? (globalThis as any).alert(`${title}\n\n${message}`) : Alert.alert(title, message);
export const err = (e: any) => Platform.OS === 'web' ? (globalThis as any).alert(e.message || String(e)) : Alert.alert('Something went wrong', e.message || String(e));

export const s = StyleSheet.create({
  btn: { flexDirection: 'row', backgroundColor: C.primary, minHeight: 52, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  // Only the primary action lifts off the page; everything else sits flat.
  btnLift: { shadowColor: C.primaryDark, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.3, borderColor: C.primary },
  btnQuiet: { backgroundColor: C.tint },
  btnT: { fontWeight: '700', fontSize: 15 },
  // Web's default outline is replaced by the primary-colour border set on focus, so focus stays visible.
  input: { ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null), borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: C.ink, minHeight: 52 },
  label: { fontSize: 13, fontWeight: '600', color: C.mute, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 44, borderRadius: 10, backgroundColor: C.chipBg, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
