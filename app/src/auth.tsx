import { tr, LANGS } from './i18n';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, setToken, setBase, getBase } from './api';
import { Btn, Input, C, F, H, M, Chip, Tag, Rise } from './ui';
import { Icon, IconName, Logo } from './icons';
import { FloralArch } from './visuals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RESEND_SECONDS = 30;
// Accept pasted "+91 98765 43210" / "098765 43210" and keep the last 10 digits.
const cleanPhone = (t: string) => { const d = t.replace(/\D/g, ''); return (d.length > 10 && /^(91|0)/.test(d) ? d.replace(/^(91|0)/, '') : d).slice(0, 10); };
const validPhone = (p: string) => /^[6-9]\d{9}$/.test(p);

// After sign-in the app opens where the person can do something useful: new couples set up the wedding, new vendors their storefront.
export type SignedIn = { isNew: boolean; role: 'couple' | 'vendor' };

const ROLE_OPTIONS: ['couple' | 'vendor', IconName, string, string][] = [
  ['couple', 'family', 'I’m planning a wedding', 'For the couple and family: vendors, checklist, budget and guests'],
  ['vendor', 'store', 'I’m a wedding vendor', 'List your services, get enquiries and manage bookings'],
];

export default function Login({ onDone, onBrowse, lang, setLang }: { onDone: (s: SignedIn) => void; onBrowse: () => void; lang: string; setLang: (l: string) => void }) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(''); const [otp, setOtp] = useState(''); const [step, setStep] = useState<0 | 1 | 2>(0);
  const [role, setRole] = useState<'couple' | 'vendor' | null>(null); const [name, setName] = useState(''); const [server, setServer] = useState(getBase()); const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false); const [showLangs, setShowLangs] = useState(false);
  const [error, setError] = useState(''); const [wait, setWait] = useState(0);
  const submitted = useRef('');
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const sendOtp = async () => { await api('/auth/otp', 'POST', { phone }); setOtp(''); submitted.current = ''; setStep(1); setWait(RESEND_SECONDS); };
  const go = async (code = otp) => {
    if (busy) return;
    setError('');
    if (step === 0 && !validPhone(phone)) return setError(tr('Enter a valid 10-digit mobile number.'));
    if (step === 1 && code.length !== 6) return setError(tr('Enter the 6-digit code.'));
    if (step === 2 && name.trim().length < 2) return setError(tr('Enter your name to continue.'));
    if (step === 2 && !role) return setError(tr('Choose whether you are planning a wedding or a vendor.'));
    setBusy(true);
    try {
      await setBase(server);
      if (step === 0) { await sendOtp(); return; }
      const r = await api('/auth/verify', 'POST', step === 2 ? { phone, otp: code, role, name: name.trim() } : { phone, otp: code });
      if (r.needsProfile) { setStep(2); return; }
      await setToken(r.token); onDone({ isNew: step === 2, role: r.user?.role === 'vendor' ? 'vendor' : 'couple' });
    } catch (e: any) {
      const m = e?.message || String(e);
      // A wrong code can only be fixed on the code step, so go back there with it cleared.
      if (/code is not right/i.test(m)) { setStep(1); setOtp(''); submitted.current = ''; }
      setError(m);
    } finally { setBusy(false); }
  };
  // The code submits itself once six digits are in, so there is nothing else to tap.
  const typeCode = (t: string) => {
    const code = t.replace(/\D/g, '').slice(0, 6); setOtp(code); setError('');
    if (code.length === 6 && submitted.current !== code) { submitted.current = code; go(code); }
  };
  const resend = async () => {
    if (busy || wait > 0) return;
    setError(''); setBusy(true);
    try { await setBase(server); await sendOtp(); } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  const changeNumber = () => { setStep(0); setOtp(''); setName(''); setRole(null); setError(''); setWait(0); submitted.current = ''; };
  const current = LANGS.find(([k]) => k === lang)?.[1] || 'English';

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 32, flexGrow: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ backgroundColor: C.primary, paddingTop: insets.top + 16, paddingHorizontal: 24, paddingBottom: 24, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -32, bottom: -48, opacity: 0.3 }}><FloralArch size={150} color={C.goldSoft} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Logo size={44} radius={10} /><Text style={{ fontFamily: F.display, fontSize: 24, color: C.goldSoft }}>Shaadi OS</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${tr('Language')}: ${current}`} onPress={() => setShowLangs(!showLangs)} hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(243,232,209,0.5)' }}>
            <Icon name="globe" size={16} color={C.goldSoft} /><Text style={{ color: C.goldSoft, fontSize: 13 }}>{current}</Text>
          </Pressable>
        </View>
        <Text style={{ color: '#F4DDE5', fontSize: 15, lineHeight: 22, marginTop: 16, maxWidth: 300 }}>{tr('Find vendors and plan your wedding with your family, in one app.')}</Text>
      </View>
      {showLangs ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, paddingTop: 16 }}>{LANGS.map(([k, n]) => <Chip key={k} label={n} on={lang === k} onPress={() => { setLang(k); setShowLangs(false); }} />)}</View> : null}

      <View style={{ paddingHorizontal: 24, paddingTop: 24, width: '100%', maxWidth: 520, alignSelf: 'center', flexGrow: 1 }}>
        <Rise>
          <H style={{ marginTop: 0 }}>{step === 0 ? tr('Sign in or create an account') : step === 1 ? tr('Enter the code') : tr('Tell us about yourself')}</H>
          {step === 0 ? <M style={{ marginTop: -4, marginBottom: 16 }}>{tr('We’ll send a 6-digit code to your mobile. New here? The same steps create your account.')}</M> : null}

          {step === 0 ? <Input label={tr('Mobile number')} prefix="+91" value={phone} onChangeText={t => { setPhone(cleanPhone(t)); setError(''); }} keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="98765 43210" returnKeyType="go" onSubmitEditing={() => go()} />
            : <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{step === 2 ? <Tag tone="ok" icon="check" label={tr('Verified')} /> : null}<Text style={{ color: C.ink, fontSize: 15, fontVariant: ['tabular-nums'] }}>+91 {phone.slice(0, 5)} {phone.slice(5)}</Text></View>
                <Pressable accessibilityRole="button" onPress={changeNumber} hitSlop={10} disabled={busy}><Text style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>{tr('Change')}</Text></Pressable>
              </View>}

          {step === 1 ? <>
            <Input label={tr('6-digit code')} value={otp} onChangeText={typeCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} placeholder="••••••" autoFocus style={{ fontSize: 20, letterSpacing: 6 }} />
            <M style={{ marginTop: -4, marginBottom: 12 }}>{tr('Demo build: the code is always 123456.')}</M>
          </> : null}

          {step === 2 ? <>
            <Input label={tr('Your name')} value={name} onChangeText={t => { setName(t); setError(''); }} placeholder={tr('e.g. Priya Sharma')} autoFocus autoCapitalize="words" textContentType="name" autoComplete="name" returnKeyType="done" maxLength={80} />
            <Text style={{ fontSize: 13, fontWeight: '500', color: C.mute, marginBottom: 8 }}>{tr('How will you use Shaadi OS?')}</Text>
            {ROLE_OPTIONS.map(([key, icon, title, detail]) => { const on = role === key; return (
              <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { setRole(key); setError(''); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? C.primary : C.line, backgroundColor: on ? C.tint : C.card, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: on ? C.card : C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={C.primary} /></View>
                <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{tr(title)}</Text><M>{tr(detail)}</M></View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? C.primary : C.faint, alignItems: 'center', justifyContent: 'center' }}>{on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary }} /> : null}</View>
              </Pressable>); })}
          </> : null}

          {!!error && <Text accessibilityRole="alert" style={{ color: C.warn, fontSize: 15, lineHeight: 20, marginBottom: 8 }}>{error}</Text>}
          <Btn title={busy ? tr('Please wait…') : step === 0 ? tr('Send code') : step === 1 ? tr('Verify') : tr('Create account')} onPress={() => go()} disabled={busy} />
          {step === 1 ? <Btn kind="quiet" title={wait > 0 ? `${tr('Resend code in')} ${wait}s` : tr('Resend code')} onPress={resend} disabled={busy || wait > 0} /> : null}
        </Rise>

        {step === 0 ? <Pressable accessibilityRole="button" onPress={onBrowse} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 8 }}>
          <Icon name="search" size={18} color={C.primary} /><Text style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>{tr('Browse vendors without signing in')}</Text>
        </Pressable> : null}

        <View style={{ flexGrow: 1 }} />
        <M style={{ marginTop: 32, fontSize: 12, textAlign: 'center' }}>{tr('Demo build: OTP and payments are simulated. Demo vendor: 9000000001.')}</M>
        <Pressable accessibilityRole="button" onPress={() => setShowServer(!showServer)} style={{ alignSelf: 'center', minHeight: 40, justifyContent: 'center' }}><Text style={{ color: C.mute, fontSize: 12, textDecorationLine: 'underline' }}>{showServer ? tr('Hide server settings') : tr('Server settings')}</Text></Pressable>
        {showServer && <Input label={tr('Server address')} value={server} onChangeText={setServer} autoCapitalize="none" />}
      </View>
    </ScrollView>);
}
