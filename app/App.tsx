import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, View, Text, ScrollView, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { api, restore, setToken } from './src/api';
import { LangCtx, useT, LANGS, setCur, tr } from './src/i18n';
import Login from './src/auth';
import { PublicExplore } from './src/marketplace';
import { Discover, VendorScreen, EnquiryForm, Enquiries, Chat, Bookings, Plan } from './src/couple';
import { Payouts } from './src/vendor';
import { Business, Privacy, Admin } from './src/more';
import { Btn, Chip, C, F, M, H, Card, TabIcon, ErrorBoundary, MOTION, useReducedMotion } from './src/ui';
import { Icon, IconName, Logo } from './src/icons';
// Shown while the session and fonts load. Same burgundy as the native splash so the hand-off has no flash,
// and it says what is happening when the server is slow instead of spinning silently.
function BootScreen({ fontsReady }: { fontsReady: boolean }) {
  const { reduced } = useReducedMotion();
  const fade = React.useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(0);
  useEffect(() => {
    if (reduced) fade.setValue(1); else Animated.timing(fade, { toValue: 1, duration: MOTION.reveal, easing: MOTION.easing, useNativeDriver: Platform.OS !== 'web' }).start();
    const a = setTimeout(() => setSlow(1), 6000); const b = setTimeout(() => setSlow(2), 15000);
    return () => { clearTimeout(a); clearTimeout(b); fade.stopAnimation(); };
  }, [reduced, fade]);
  // The mark sits exactly where the native splash draws it (120 pt, centred), so the hand-off is invisible;
  // only the wordmark and status underneath fade in.
  return <View accessibilityRole="progressbar" accessibilityLabel={tr('Opening Shaadi OS')} style={{ flex: 1, backgroundColor: C.primary }}>
    <StatusBar style="light" />
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={120} radius={0} />
    </View>
    <Animated.View style={{ position: 'absolute', top: '50%', left: 32, right: 32, marginTop: 84, alignItems: 'center', opacity: fade }}>
      <Text style={{ fontSize: 28, color: C.goldSoft, fontFamily: fontsReady ? F.display : Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }) }}>Shaadi OS</Text>
      <ActivityIndicator style={{ marginTop: 24 }} color={C.goldSoft} />
      <Text accessibilityLiveRegion="polite" style={{ marginTop: 16, minHeight: 60, maxWidth: 280, textAlign: 'center', fontSize: 13, lineHeight: 20, color: '#F4DDE5' }}>
        {slow === 2 ? tr('Still connecting. Check your internet connection; the app will open as soon as it reaches the server.') : slow === 1 ? tr('Connecting to the server…') : ''}
      </Text>
    </Animated.View>
  </View>;
}
const Tab = createBottomTabNavigator(); const Stack = createNativeStackNavigator();
const hdr = { headerStyle: { backgroundColor: C.bg }, headerTintColor: C.primary, headerShadowVisible: false, headerTitleStyle: { fontFamily: F.display, color: C.ink, fontSize: 20 } };
const tabs = { ...hdr, tabBarActiveTintColor: C.primary, tabBarInactiveTintColor: C.mute, tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.line, ...(Platform.OS === 'web' ? { height: 72, paddingTop: 8, paddingBottom: 12 } : null) }, tabBarLabelStyle: { fontSize: 12, lineHeight: 14, fontWeight: '500' as const } };
const ti = (name: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <TabIcon name={name} focused={focused} color={color} />;
function Profile({ me, onLogout }: any) {
  const { lang, setLang } = React.useContext(LangCtx);
  return (<ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Text style={{ fontFamily: F.display, fontSize: 20, color: C.primary }}>{(me.user.name || '?')[0].toUpperCase()}</Text></View>
      <View><H style={{ marginVertical: 0 }}>{me.user.name}</H><M>+91 {me.user.phone} · {me.user.role === 'vendor' ? tr('Vendor') : tr('Couple')}</M></View></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}><Icon name="globe" size={18} color={C.mute} /><Text style={{ marginLeft: 8, fontWeight: '500', color: C.ink }}>{tr('Language')}</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{LANGS.map(([k, n]) => <Chip key={k} label={n} on={lang === k} onPress={() => setLang(k)} />)}</View>
    <Privacy onDeleted={onLogout} /><Admin />
    <Card style={{ backgroundColor: C.goldSoft, borderColor: C.goldSoft }}><M style={{ color: C.ink }}>{tr('Demo build: payments, OTP and WhatsApp are simulated. Booking Protection and escrow do not move real money.')}</M></Card>
    <Btn kind="ghost" icon="logout" title={tr('Log out')} onPress={onLogout} /></ScrollView>);
}
const CoupleTabs = (me: any, logout: () => void) => function T() {
  const t = useT();
  return (<Tab.Navigator screenOptions={tabs}>
    <Tab.Screen name="Discover" options={{ title: t('discover'), tabBarIcon: ti('search'), headerShown: false }} component={Discover} />
    <Tab.Screen name="Enquiries" options={{ title: t('enquiries'), tabBarIcon: ti('chat') }} component={Enquiries} />
    <Tab.Screen name="Bookings" options={{ title: t('bookings'), tabBarIcon: ti('ledger') }}>{() => <Bookings />}</Tab.Screen>
    <Tab.Screen name="Plan" options={{ title: t('plan'), tabBarIcon: ti('partnership'), headerShown: false }} component={Plan} />
    <Tab.Screen name="Profile" options={{ title: t('profile'), tabBarIcon: ti('person') }}>{() => <Profile me={me} onLogout={logout} />}</Tab.Screen></Tab.Navigator>);
};
const VendorTabs = (me: any, logout: () => void) => function T() {
  const t = useT();
  return (<Tab.Navigator screenOptions={tabs}>
    <Tab.Screen name="Leads" options={{ title: t('leads'), tabBarIcon: ti('inbox') }}>{(p: any) => <Enquiries {...p} vendor />}</Tab.Screen>
    <Tab.Screen name="Bookings" options={{ title: t('bookings'), tabBarIcon: ti('ledger') }}>{() => <Bookings vendor />}</Tab.Screen>
    <Tab.Screen name="Payouts" options={{ title: t('payouts'), tabBarIcon: ti('wallet') }} component={Payouts} />
    <Tab.Screen name="Store" options={{ title: tr('Business'), tabBarIcon: ti('store') }}>{() => <Business />}</Tab.Screen>
    <Tab.Screen name="Profile" options={{ title: t('profile'), tabBarIcon: ti('person') }}>{() => <Profile me={me} onLogout={logout} />}</Tab.Screen></Tab.Navigator>);
};
export default function App() {
  const [exploring, setExploring] = useState(() => typeof window !== 'undefined' && !!window.location && new URLSearchParams(window.location.search).get('browse') === '1');
  const [fonts] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });
  // Language changes remount navigation so every title re-renders; this keeps the user on the screen they were on.
  const navState = React.useRef<any>(undefined);
  const [state, setState] = useState<'boot' | 'out' | 'in'>('boot'); const [me, setMe] = useState<any>(null); const [lang, setLangS] = useState('en');
  const setLang = (l: string) => { setCur(l); setLangS(l); AsyncStorage.setItem('lang', l).catch(() => {}); };
  const boot = async () => { try { const has = await restore(); { const l = (await AsyncStorage.getItem('lang')) || 'en'; setCur(l); setLangS(l); } if (!has) return setState('out'); setMe(await api('/me')); setState('in'); } catch { setState('out'); } };
  useEffect(() => { boot(); }, []);
  const logout = async () => { await setToken(''); navState.current = undefined; setState('out'); };
  if (state === 'boot' || !fonts) return <BootScreen fontsReady={!!fonts} />;
  if (state === 'out') return <SafeAreaProvider><StatusBar style="dark" /><ErrorBoundary>{exploring ? <PublicExplore onSignIn={() => setExploring(false)} onBack={() => setExploring(false)} /> : <Login onDone={boot} onBrowse={() => setExploring(true)} lang={lang} setLang={setLang} />}</ErrorBoundary></SafeAreaProvider>;
  const vendor = me.user.role === 'vendor'; const Tabs = vendor ? VendorTabs(me, logout) : CoupleTabs(me, logout);
  return (<LangCtx.Provider value={{ lang, setLang }}><SafeAreaProvider><StatusBar style="dark" /><ErrorBoundary><NavigationContainer key={lang} initialState={navState.current} onStateChange={state => { navState.current = state; }}>
    <Stack.Navigator screenOptions={{ ...hdr, animation: 'slide_from_right' }}><Stack.Screen name="Home" component={Tabs} options={{ title: 'Shaadi OS', headerShown: false }} />
      <Stack.Screen name="Vendor" component={VendorScreen} options={{ title: '' }} /><Stack.Screen name="EnquiryForm" component={EnquiryForm} options={{ title: tr('Enquiry'), animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Chat" component={Chat} options={({ route }: any) => ({ title: route.params?.title || 'Chat' })} /></Stack.Navigator></NavigationContainer></ErrorBoundary></SafeAreaProvider></LangCtx.Provider>);
}
