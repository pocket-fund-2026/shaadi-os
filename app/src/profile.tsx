import React, { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from './api';
import { LANGS, LangCtx, tr } from './i18n';
import { Btn, C, Card, Chip, F, Input, M, Tag, confirm, dateIN, err, inr } from './ui';
import { Icon, IconName } from './icons';
import { categoryLabel } from './marketplace';
import { useLoad } from './couple';
import { Admin } from './more';
import { disableReminders, enableReminders, remindersEnabled } from './reminders';

const VERSION: string = require('../app.json').expo.version;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

// A settings row: icon, label, optional value on the right, and either a tap action or an expanding panel.
function Row({ icon, label, value, onPress, open, children, first }: { icon: IconName; label: string; value?: React.ReactNode; onPress?: () => void; open?: boolean; children?: React.ReactNode; first?: boolean }) {
  return <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
    <Pressable accessibilityRole="button" accessibilityState={children !== undefined ? { expanded: !!open } : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color={C.primary} /></View>
      <Text style={{ flex: 1, color: C.ink, fontSize: 15 }}>{label}</Text>
      {typeof value === 'string' ? <M>{value}</M> : value}
      {onPress ? <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" size={16} color={C.faint} /></View> : null}
    </Pressable>
    {open ? <View style={{ paddingBottom: 16 }}>{children}</View> : null}
  </View>;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <>
  <Text style={{ fontSize: 13, color: C.mute, fontWeight: '500', marginTop: 24, marginBottom: 8, marginLeft: 4 }}>{title}</Text>
  <Card style={{ paddingVertical: 4 }}>{children}</Card>
</>;

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const nav = useNavigation<any>();
  const { lang, setLang } = useContext(LangCtx);
  const [me, reload] = useLoad<any>('/me', null);
  const [overview, setOverview] = useState<any>(null); const [members, setMembers] = useState<any>(null);
  const [biz, setBiz] = useState<{ leads: number; bookings: number; rating: number | null; reviews: number } | null>(null);
  const [editing, setEditing] = useState(false); const [name, setName] = useState(''); const [saving, setSaving] = useState(false); const [nameError, setNameError] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [reminders, setReminders] = useState<boolean | null>(null); const [reminderNote, setReminderNote] = useState('');
  const [marketing, setMarketing] = useState<boolean | null>(null);
  const vendor = me?.user?.role === 'vendor';

  // Summary data for the top card, fetched only when it applies so nothing errors for the other role.
  useEffect(() => {
    if (!me) return;
    if (me.wedding) { api('/planner/overview').then(setOverview).catch(() => {}); api('/members').then(setMembers).catch(() => {}); }
    if (vendor && me.vendor) Promise.all([api<any[]>('/enquiries'), api<any[]>('/bookings'), api<any>('/vendors/' + me.vendor.id)])
      .then(([e, b, v]) => setBiz({ leads: e.length, bookings: b.length, rating: v.rating, reviews: v.reviews })).catch(() => {});
  }, [me, vendor]);
  useEffect(() => { remindersEnabled().then(setReminders); api<any>('/consent').then(r => setMarketing(r.marketing)).catch(() => {}); }, []);

  if (!me) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const user = me.user;
  const toggle = (row: string) => setOpenRow(openRow === row ? null : row);
  const openPlan = (tab: string) => nav.navigate('Plan', { tab, at: Date.now() });

  const saveName = async () => {
    if (name.trim().length < 2) return setNameError(tr('Enter your name.'));
    setSaving(true);
    try { await api('/me', 'PATCH', { name: name.trim() }); setEditing(false); reload(); } catch (e: any) { setNameError(e?.message || String(e)); } finally { setSaving(false); }
  };
  const chooseLang = (k: string) => { setLang(k); api('/me', 'PATCH', { lang: k }).catch(() => {}); };
  const toggleReminders = async () => {
    setReminderNote('');
    try { if (reminders) { await disableReminders(); setReminders(false); } else { const n = await enableReminders(); setReminders(true); setReminderNote(`${n} ${tr('reminders scheduled')}`); } }
    catch (e: any) { setReminderNote(e?.message || String(e)); }
  };
  const consent = (granted: boolean) => api('/consent', 'POST', { purpose: 'marketing', granted }).then(() => setMarketing(granted)).catch(err);
  const exportData = async () => { try { const d = await api('/my-data'); await Share.share({ message: JSON.stringify(d, null, 1) }); } catch (e) { err(e); } };
  const deleteData = async () => {
    if (await confirm(tr('Delete your account data?'), tr('This removes your profile, wedding plans and messages. Bookings with money in escrow are kept until they settle. This cannot be undone.'), tr('Delete'), true))
      api('/my-data', 'DELETE').then(onLogout).catch(err);
  };
  const role = members?.role && members.role !== 'owner' ? tr(members.role === 'editor' ? 'Editor' : members.role === 'budget_viewer' ? 'Budget viewer' : 'Viewer') : null;

  return <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: F.display, fontSize: 24, color: C.goldSoft }}>{initials(user.name || '')}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.display, fontSize: 24, color: C.ink }} numberOfLines={1}>{user.name}</Text>
          <M style={{ fontVariant: ['tabular-nums'] }}>+91 {String(user.phone).slice(0, 5)} {String(user.phone).slice(5)}</M>
          <View style={{ flexDirection: 'row', marginTop: 4 }}><Tag tone="gold" icon={vendor ? 'store' : 'family'} label={vendor ? tr('Vendor') : role ? `${tr('Family')} · ${role}` : tr('Couple')} /></View>
        </View>
        {!editing ? <Btn small kind="quiet" title={tr('Edit')} onPress={() => { setName(user.name || ''); setNameError(''); setEditing(true); }} /> : null}
      </View>
      {editing ? <View style={{ marginTop: 16 }}>
        <Input label={tr('Your name')} value={name} onChangeText={t => { setName(t); setNameError(''); }} autoFocus autoCapitalize="words" maxLength={80} returnKeyType="done" onSubmitEditing={saveName} />
        {nameError ? <Text accessibilityRole="alert" style={{ color: C.warn, marginBottom: 8 }}>{nameError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Btn small title={tr('Save')} disabled={saving} onPress={saveName} /></View><View style={{ flex: 1 }}><Btn small kind="ghost" title={tr('Cancel')} onPress={() => setEditing(false)} /></View></View>
        <M style={{ marginTop: 8 }}>{tr('Your mobile number is your login, so it can’t be changed here.')}</M>
      </View> : null}
    </Card>

    {!vendor && me.wedding ? <Pressable accessibilityRole="button" onPress={() => openPlan('settings')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ backgroundColor: C.primaryDark, borderColor: C.primaryDark }}>
        <M style={{ color: '#F4DDE5' }}>{tr('Your wedding')}</M>
        <Text style={{ fontFamily: F.display, fontSize: 24, color: C.goldSoft, marginTop: 4 }}>{me.wedding.title}</Text>
        <M style={{ color: '#F4DDE5', marginTop: 2 }}>{dateIN(me.wedding.date)} · {me.wedding.city}{overview ? ` · ${overview.days_left > 0 ? `${overview.days_left} ${tr('days to go')}` : overview.days_left === 0 ? tr('Today is the day') : tr('Just married')}` : ''}</M>
        {overview ? <View style={{ flexDirection: 'row', marginTop: 16, gap: 16 }}>{[[`${overview.tasks.done}/${overview.tasks.total}`, tr('Tasks')], [String(overview.guests.attending), tr('Guests coming')], [inr(overview.budget.booked_paise), tr('Booked')]].map(([v, l]) =>
          <View key={l} style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums'] }} numberOfLines={1}>{v}</Text><M style={{ color: '#F4DDE5' }}>{l}</M></View>)}</View> : null}
      </Card>
    </Pressable> : null}
    {!vendor && !me.wedding ? <Card><Text style={{ color: C.ink, fontSize: 15 }}>{tr('You haven’t set up a wedding yet.')}</Text><Btn small title={tr('Set up your wedding')} onPress={() => nav.navigate('Plan')} /></Card> : null}

    {vendor ? <Pressable accessibilityRole="button" onPress={() => nav.navigate('Store')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card>
        <M>{tr('Your business')}</M>
        {me.vendor ? <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}><Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink, flex: 1 }}>{me.vendor.name}</Text>
            {me.vendor.verified ? <Tag tone="ok" icon="seal" label={tr('Verified')} /> : <Tag label={tr('Not verified yet')} />}</View>
          <M>{categoryLabel(me.vendor.category)} · {me.vendor.city}{me.vendor.start_paise ? ` · ${tr('from')} ${inr(me.vendor.start_paise)}` : ''}</M>
          {biz ? <View style={{ flexDirection: 'row', marginTop: 16, gap: 16 }}>{[[String(biz.leads), tr('Leads')], [String(biz.bookings), tr('Bookings')], [biz.rating ? `${biz.rating} (${biz.reviews})` : '—', tr('Rating')]].map(([v, l]) =>
            <View key={l} style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{v}</Text><M>{l}</M></View>)}</View> : null}
        </> : <><Text style={{ color: C.ink, fontSize: 15, marginTop: 4 }}>{tr('Your storefront isn’t set up yet. Couples can’t find you until it is.')}</Text><Btn small title={tr('Set up your storefront')} onPress={() => nav.navigate('Store')} /></>}
      </Card>
    </Pressable> : null}

    <Section title={tr('Settings')}>
      <Row first icon="globe" label={tr('Language')} value={LANGS.find(([k]) => k === lang)?.[1]} open={openRow === 'lang'} onPress={() => toggle('lang')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{LANGS.map(([k, n]) => <Chip key={k} label={n} on={lang === k} onPress={() => chooseLang(k)} />)}</View>
      </Row>
      {!vendor ? <Row icon="calendar" label={tr('Phone reminders')} value={<Chip label={reminders ? tr('On') : tr('Off')} on={!!reminders} onPress={toggleReminders} />} /> : null}
      {!vendor && reminderNote ? <M style={{ marginBottom: 12 }}>{reminderNote}</M> : null}
      {!vendor && me.wedding ? <Row icon="family" label={tr('Family access')} value={members ? `${members.members.length} ${tr(members.members.length === 1 ? 'member' : 'members')}` : ''} onPress={() => openPlan('family')} /> : null}
      {!vendor && me.wedding ? <Row icon="ring" label={tr('Wedding details')} onPress={() => openPlan('settings')} /> : null}
      {vendor ? <Row icon="store" label={tr('Storefront')} onPress={() => nav.navigate('Store')} /> : null}
    </Section>

    <Section title={tr('Privacy')}>
      <Row first icon="lock" label={tr('Privacy and your data')} open={openRow === 'privacy'} onPress={() => toggle('privacy')}>
        <M style={{ marginBottom: 12 }}>{tr('Under the DPDP Act you can export or delete your data. Every consent choice is logged.')}</M>
        <Text style={{ fontSize: 13, fontWeight: '500', color: C.mute, marginBottom: 8 }}>{tr('Marketing messages')}</Text>
        <View style={{ flexDirection: 'row' }}><Chip label={tr('Allow')} on={marketing === true} onPress={() => consent(true)} /><Chip label={tr('Don’t allow')} on={marketing === false} onPress={() => consent(false)} /></View>
        <Btn small kind="quiet" icon="share" title={tr('Export my data')} onPress={exportData} />
        <Btn small kind="ghost" title={tr('Delete my account data')} onPress={deleteData} />
        <M style={{ marginTop: 8 }}>{tr('Grievance officer')}: grievance@shaadios.example {tr('(placeholder, set before launch)')}</M>
      </Row>
    </Section>

    <Admin />

    <Section title={tr('About')}>
      <Row first icon="seal" label="Shaadi OS" value={`${tr('Version')} ${VERSION}`} />
      <M style={{ paddingBottom: 12 }}>{tr('Demo build: payments, OTP and WhatsApp are simulated. Booking Protection and escrow do not move real money.')}</M>
    </Section>

    <View style={{ marginTop: 24 }}><Btn kind="ghost" icon="logout" title={tr('Log out')} onPress={onLogout} /></View>
  </ScrollView>;
}
