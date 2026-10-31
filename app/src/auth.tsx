import { tr, LANGS } from './i18n';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, setToken, setBase, getBase } from './api';
import { Btn, Input, C, F, H, M, Chip, Tag, Rise } from './ui';
import { Logo } from './icons';
import { FloralArch } from './visuals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RESEND_SECONDS = 30;
// Accept pasted "+91 98765 43210" / "098765 43210" and keep the last 10 digits.
const cleanPhone = (t: string) => { const d = t.replace(/\D/g, ''); return (d.length > 10 && /^(91|0)/.test(d) ? d.replace(/^(91|0)/, '') : d).slice(0, 10); };
const validPhone = (p: string) => /^[6-9]\d{9}$/.test(p);

export default function Login({ onDone, onBrowse, lang, setLang }: { onDone: () => void; onBrowse: () => void; lang: string; setLang: (l: string) => void }) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(''); const [otp, setOtp] = useState(''); const [step, setStep] = useState(0);
  const [role, setRole] = useState<'couple' | 'vendor'>('couple'); const [name, setName] = useState(''); const [server, setServer] = useState(getBase()); const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [error, setError] = useState(''); const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const sendOtp = async () => {
    await api('/auth/otp', 'POST', { phone }); setOtp(''); setStep(1); setWait(RESEND_SECONDS);
  };
  const go = async () => {
    if (busy) return;
    setError('');
    if (step === 0 && !validPhone(phone)) return setError(tr('Enter a valid 10-digit mobile number.'));
    if (step === 1 && otp.length !== 6) return setError(tr('Enter the 6-digit code.'));
    if (step === 2 && !name.trim()) return setError(tr('Enter your name to continue.'));
    setBusy(true);
    try {
      await setBase(server);
      if (step === 0) { await sendOtp(); return; }
      const r = await api('/auth/verify', 'POST', step === 2 ? { phone, otp, role, name: name.trim() } : { phone, otp });
      if (r.needsProfile) { setStep(2); return; }
      await setToken(r.token); onDone();
    } catch (e: any) {
      const m = e?.message || String(e);
      // A wrong code on the final step means the OTP can no longer be edited, so send them back to retype it.
      if (step === 2 && /otp/i.test(m)) setStep(1);
      setError(m);
    } finally { setBusy(false); }
  };
  const resend = async () => {
    if (busy || wait > 0) return;
    setError(''); setBusy(true);
    try { await setBase(server); await sendOtp(); } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  const changeNumber = () => { setStep(0); setOtp(''); setName(''); setError(''); setWait(0); };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: C.bg }}>
      <Rise i={0}>
        <View style={{ marginBottom: 20 }}><Logo size={64} /></View>
        {/* Language comes first: many couples and families prefer to sign up in their own language. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
          {LANGS.map(([k, n]) => <Chip key={k} label={n} on={lang === k} onPress={() => setLang(k)} />)}
        </ScrollView>
        <Text style={{ fontFamily: F.display, fontSize: 34, color: C.ink, lineHeight: 42 }}>Shaadi OS</Text>
        <View style={{ backgroundColor: C.primaryDark, borderRadius: 20, padding: 24, marginVertical: 24, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -24, top: 8, opacity: 0.4 }}><FloralArch size={150} /></View>
          <Text style={{ fontFamily: F.display, fontSize: 34, lineHeight: 38, color: C.goldSoft, maxWidth: '85%' }}>{tr('A celebration that feels like you')}</Text>
          <Text style={{ fontSize: 15, color: C.goldSoft, marginTop: 16, lineHeight: 23, maxWidth: '88%' }}>{tr('Find your vendors. Bring your people together. Plan every detail in one place.')}</Text>
        </View>
        <Btn kind="ghost" icon="search" title={tr('Explore wedding vendors')} onPress={onBrowse} />
      </Rise>
      <Rise i={1}>
        <H>{step === 0 ? tr('Your wedding starts here') : step === 1 ? tr('Verify your number') : tr('Tell us about yourself')}</H>
        <Input label={tr('Mobile number (+91)')} value={phone} onChangeText={t => { setPhone(cleanPhone(t)); setError(''); }} keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="10-digit mobile" editable={step === 0} returnKeyType="go" onSubmitEditing={go} />
        {step === 1 && <Rise>
          <Input label={tr('OTP (demo: 123456)')} value={otp} onChangeText={t => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} placeholder="6-digit code" autoFocus returnKeyType="go" onSubmitEditing={go} />
          <M style={{ marginBottom: 8 }}>{tr('We sent a code to')} +91 {phone}</M>
        </Rise>}
        {step === 2 && (<Rise>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}><Tag tone="ok" icon="check" label={tr('Number verified')} /></View>
          <Input label={tr('Your name')} value={name} onChangeText={t => { setName(t); setError(''); }} placeholder="Your Name" autoFocus autoCapitalize="words" textContentType="name" autoComplete="name" returnKeyType="go" onSubmitEditing={go} />
          <H style={{ fontSize: 17 }}>{tr('I am a…')}</H><View style={{ flexDirection: 'row' }}><Chip icon="family" label={tr('Couple / Family')} on={role === 'couple'} onPress={() => setRole('couple')} /><Chip icon="store" label={tr('Vendor')} on={role === 'vendor'} onPress={() => setRole('vendor')} /></View></Rise>)}
        {!!error && <Text accessibilityRole="alert" style={{ color: C.warn, fontSize: 15, lineHeight: 20, marginBottom: 8 }}>{error}</Text>}
        <Btn title={busy ? tr('Please wait…') : step === 0 ? tr('Send OTP') : step === 1 ? tr('Verify') : tr('Create account')} onPress={go} disabled={busy} />
        {step === 1 && <Btn kind="quiet" title={wait > 0 ? `${tr('Resend code in')} ${wait}s` : tr('Resend code')} onPress={resend} disabled={busy || wait > 0} />}
        {step > 0 && <Btn kind="ghost" title={tr('Change mobile number')} onPress={changeNumber} disabled={busy} />}
      </Rise>
      <M style={{ marginTop: 24 }}>{tr('Demo vendor login: 9000000001 · OTP 123456')}</M>
      <M style={{ marginTop: 12 }}>{tr('Demo build: payments and OTP are simulated. No real money is transferred.')}</M>
      <Btn kind="ghost" small title={showServer ? tr('Hide server settings') : tr('Server settings')} onPress={() => setShowServer(!showServer)} />
      {showServer && <Rise><Input label={tr('Server address')} value={server} onChangeText={setServer} autoCapitalize="none" /></Rise>}
    </ScrollView>);
}
