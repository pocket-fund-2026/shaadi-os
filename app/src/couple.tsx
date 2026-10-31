import { Overview, TaskManager, BudgetManager, WeddingSettings } from './planner';
import { tr } from './i18n';
import { Events, Family, ShortlistTab, InviteTab } from './more';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View, RefreshControl, Linking, KeyboardAvoidingView, Platform, Pressable, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, getBase } from './api';
import { Btn, Card, Chip, H, Input, M, C, F, inr, err, s, Empty, Rise, Tag, Stars, Bar, Check, Loading, confirm, notify, dateIN, DateField, todayISO, GuestCtx, ContactButtons } from './ui';
import { Icon, CAT_ICON, IconName } from './icons';
import { Marketplace } from './marketplace';
import { CategoryCover, FloralArch } from './visuals';
import { VendorCatalog } from './catalog';
import { Gifts, RunSheet, Stays } from './hospitality';
import { DayContacts, Documents, Seating, Shopping } from './organiser';
import { useT } from './i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export const useLoad = <T,>(path: string, init: T) => {
  const [d, setD] = useState<T>(init); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setBusy(true); try { setD(await api(path)); } catch (e) { err(e); } finally { setBusy(false); } }, [path]);
  useFocusEffect(useCallback(() => { load(); }, [load])); return [d, load, busy] as const;
};
const CAT_LABEL: Record<string, string> = { photographer: 'Photography', makeup: 'Makeup', mehndi: 'Mehndi', decor: 'Decor', venue: 'Venues', caterer: 'Catering', dj: 'DJ & music', pandit: 'Pandit' };
const catLabel = (c: string) => tr(CAT_LABEL[c] || c);
const refresh = (busy: boolean, load: () => void) => <RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} colors={[C.primary]} />;

const CatMark = ({ c, size = 46 }: { c: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={CAT_ICON[c] || 'store'} size={size * 0.5} color={C.primary} /></View>);

// Discover and Plan open with their own heading, so the tab hides the nav bar and these take the top safe area.
export function Discover(props: any) {
  return useContext(GuestCtx) ? <DiscoverView {...props} /> : <DiscoverSignedIn {...props} />;
}
function DiscoverSignedIn(props: any) { const [me] = useLoad<any>('/me', null); return <DiscoverView {...props} me={me} />; }
function DiscoverView({ navigation, route, me }: any) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.bg }}><Marketplace openVendor={id => navigation.navigate('Vendor', { id })} preset={route?.params} weddingDate={me?.wedding?.date} /></View>;
}

export function VendorScreen({ route, navigation }: any) {
  const [v] = useLoad<any>('/vendors/' + route.params.id, null); const t = useT(); const [saved, setSaved] = useState(false); const insets = useSafeAreaInsets(); const guest = useContext(GuestCtx);
  if (!v) return <Loading what={tr('vendor')} />;
  const shortlist = () => guest ? navigation.navigate('SignIn') : api('/shortlist', 'POST', { vendor_id: v.id }).then(() => setSaved(true)).catch(err);
  // Price and the booking action stay pinned at the bottom so they're reachable from anywhere in a long profile.
  return (<View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 20 }}><CategoryCover category={v.category} label={catLabel(v.category)} large /></View>
      <Rise i={0}>
        <H style={{ marginVertical: 0, fontSize: 28, lineHeight: 34 }}>{v.name}</H>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}><Icon name="pin" size={15} color={C.mute} /><M style={{ marginLeft: 4, flex: 1 }}>{catLabel(v.category)} · {v.locality ? v.locality + ', ' : ''}{v.city}</M></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          {v.sample ? <Tag label={tr('Sample listing')} /> : v.verified ? <Tag tone="ok" icon="seal" label={tr('Verified')} /> : null}
          {v.rating ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><Stars n={Math.round(v.rating)} /><M> {v.rating} · {v.reviews} {tr('reviews')}</M></View> : v.unclaimed ? null : <M>{tr('No reviews yet')}</M>}</View>
        {v.description ? <Text style={{ marginTop: 16, color: C.ink, fontSize: 15, lineHeight: 23 }}>{v.description}</Text> : null}
        {v.unclaimed
          ? <View style={{ marginTop: 16 }}>
            {v.contact_phone || v.contact_whatsapp || v.contact_email ? <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>{tr('Contact')}</Text>
              <ContactButtons phone={v.contact_phone} whatsapp={v.contact_whatsapp} email={v.contact_email} />
              <M style={{ marginTop: 8 }}>{tr('From their website')}{v.contact_source ? ` · ${String(v.contact_source).replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}` : ''}</M>
            </Card> : null}
            <View style={{ flexDirection: 'row', backgroundColor: C.chipBg, borderRadius: 12, padding: 12 }}><Icon name="alert" size={18} color={C.mute} /><M style={{ flex: 1, marginLeft: 8, color: C.ink }}>{tr('This business has not joined Shaadi OS yet, so you contact them directly. Details come from their own website and may be out of date.')}</M></View>
          </View>
          : <View style={{ flexDirection: 'row', backgroundColor: C.okSoft, borderRadius: 12, padding: 12, marginTop: 16 }}><Icon name="shield" size={18} color={C.ok} /><M style={{ flex: 1, marginLeft: 8, color: C.ink }}>{tr('Booking Protection: you pay in milestones and each one is held until you release it.')}</M></View>}
      </Rise>
      {v.unclaimed ? null : <>
      <VendorCatalog vendor={v} />
      <H style={{ marginTop: 28 }}>{tr('Reviews')}</H>
      {v.reviewList.length ? v.reviewList.map((r: any, i: number) => <Rise key={i} i={i}><Card>
        <View style={s.row}><Text style={{ fontWeight: '500', color: C.ink }}>{r.name}</Text><Stars n={r.rating} /></View>
        {r.text ? <M style={{ marginTop: 4 }}>{r.text}</M> : null}</Card></Rise>)
        : <Empty icon="star" title={tr('No reviews yet')} text={tr('Only couples who booked and paid through Shaadi OS can review, so every review here is from a real booking.')} />}
      </>}
    </ScrollView>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
      <View><M style={{ fontSize: 12 }}>{tr('Starting price')}</M><Text style={{ fontFamily: F.display, fontSize: v.start_paise ? 20 : 15, color: v.start_paise ? C.primary : C.mute }}>{v.start_paise ? inr(v.start_paise) : tr('Not listed')}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? tr('Shortlisted') : tr('Shortlist')} accessibilityState={{ selected: saved, disabled: saved }} disabled={saved} onPress={shortlist}
        style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 12, borderWidth: 1.3, borderColor: C.primary, backgroundColor: saved ? C.tint : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
        <Icon name={saved ? 'heartFill' : 'heart'} size={20} color={C.primary} /></Pressable>
      <View style={{ flex: 1 }}>{v.unclaimed
        ? (v.website ? <Btn kind="ghost" title={tr('Visit website')} onPress={() => Linking.openURL(v.website).catch(err)} /> : null)
        : <Btn title={guest ? tr('Sign in to enquire') : t('book')} onPress={() => guest ? navigation.navigate('SignIn') : navigation.navigate('EnquiryForm', { vendor: v })} />}</View>
    </View>
  </View>);
}

// Pre-filled from the couple's own plan (date, guests, budget for this service) so an enquiry takes seconds.
export function EnquiryForm({ route, navigation }: any) {
  const v = route.params.vendor;
  const [date, setDate] = useState(''); const [guests, setGuests] = useState(''); const [budget, setBudget] = useState(String(Math.round((v.start_paise || 0) / 100) || ''));
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [events, setEvents] = useState<any[]>([]); const [picked, setPicked] = useState<string[]>([]); const [prefilled, setPrefilled] = useState(false);
  // Other shortlisted vendors for the same service who can receive enquiries and haven't been asked yet.
  const [others, setOthers] = useState<any[]>([]); const [alsoTo, setAlsoTo] = useState<number[]>([]);
  useEffect(() => {
    Promise.all([api<any[]>('/shortlist'), api<any[]>('/deals')]).then(([sl, deals]) => {
      const asked = new Set(deals.map(d => d.vendor_id));
      setOthers(sl.filter(x => x.category === v.category && x.vendor_id !== v.id && !x.unclaimed && !asked.has(x.vendor_id)));
    }).catch(() => {});
  }, [v.id, v.category]);
  useEffect(() => {
    api<any>('/me').then(async me => {
      const w = me.wedding; if (!w) return;
      if (w.date >= todayISO()) setDate(w.date); setGuests(String(w.guests_est || ''));
      const [b, ev] = await Promise.all([api<any>('/budget').catch(() => null), api<any[]>('/events').catch(() => [])]);
      const alloc = b?.rows?.find((r: any) => r.category === v.category)?.allocated_paise; if (alloc) setBudget(String(Math.round(alloc / 100)));
      setEvents(ev || []); setPrefilled(true);
    }).catch(() => {});
  }, [v.category]);
  const send = async () => {
    setError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError(tr('Choose the event date.'));
    if (!(+guests > 0)) return setError(tr('Enter roughly how many guests.'));
    if (!(+budget > 0)) return setError(tr('Enter your budget for this service.'));
    setBusy(true);
    try {
      const av = await api(`/vendors/${v.id}/availability?date=${date}`);
      if (!av.available && !(await confirm(tr('Date not available'), tr('This vendor is busy on that date. Send anyway?'), tr('Send')))) return;
      const fullNote = [picked.length ? `${tr('Ceremonies')}: ${picked.join(', ')}` : '', note.trim()].filter(Boolean).join('\n');
      const body = { event_date: date, guests: +guests, budget_paise: Math.round(+budget * 100), note: fullNote };
      const r = await api('/enquiries', 'POST', { vendor_id: v.id, ...body });
      const sent: string[] = []; const busyOnDate: string[] = [];
      for (const o of others.filter(x => alsoTo.includes(x.vendor_id))) {
        const free = await api(`/vendors/${o.vendor_id}/availability?date=${date}`).then((a: any) => a.available).catch(() => true);
        if (!free) { busyOnDate.push(o.name); continue; }
        await api('/enquiries', 'POST', { vendor_id: o.vendor_id, ...body }).then(() => sent.push(o.name)).catch(() => busyOnDate.push(o.name));
      }
      if (busyOnDate.length) notify(tr('Not sent to everyone'), `${tr('Busy on that date or not reachable')}: ${busyOnDate.join(', ')}`);
      navigation.replace('Chat', { id: r.id, title: v.name, alsoSent: sent });
    } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><CatMark c={v.category} size={44} />
      <View style={{ flex: 1 }}><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{v.name}</Text><M>{catLabel(v.category)}{v.start_paise ? ` · ${tr('from')} ${inr(v.start_paise)}` : ''}</M></View></Card>
    {prefilled ? <M style={{ marginBottom: 12 }}>{tr('Filled in from your wedding plan. Change anything that’s different for this vendor.')}</M> : null}
    <DateField label={tr('Event date')} value={date} onChange={setDate} min={todayISO()} />
    <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label={tr('Guests')} value={guests} onChangeText={t => setGuests(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="250" /></View>
      <View style={{ flex: 1 }}><Input label={tr('Your budget (₹)')} value={budget} onChangeText={t => setBudget(t.replace(/\D/g, ''))} keyboardType="number-pad" />{+budget > 0 ? <M style={{ marginTop: -8, marginBottom: 12 }}>{inr(+budget * 100)}</M> : null}</View></View>
    {events.length ? <><Text style={s.label}>{tr('Which ceremonies?')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>{events.map(e => { const on = picked.includes(e.name); return <Chip key={e.id} icon={on ? 'check' : undefined} label={e.name} on={on} onPress={() => setPicked(on ? picked.filter(x => x !== e.name) : [...picked, e.name])} />; })}</View></> : null}
    {others.length ? <><Text style={s.label}>{tr('Also send to')}</Text>
      <M style={{ marginBottom: 8 }}>{tr('Other vendors you shortlisted for this service. Each gets the same enquiry as a separate conversation.')}</M>
      {others.map(o => { const on = alsoTo.includes(o.vendor_id); return <Pressable key={o.vendor_id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setAlsoTo(on ? alsoTo.filter(x => x !== o.vendor_id) : [...alsoTo, o.vendor_id])} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
        <Check on={on} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15 }}>{o.name}</Text><M>{o.city}{o.start_paise ? ` · ${tr('from')} ${inr(o.start_paise)}` : ''}</M></View></Pressable>; })}</> : null}
    <Input label={tr('Anything else?')} value={note} onChangeText={setNote} multiline placeholder={tr('Timings, style you like, questions for the vendor')} style={{ minHeight: 88, textAlignVertical: 'top' }} maxLength={400} />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Icon name="lock" size={16} color={C.mute} /><M style={{ marginLeft: 8, flex: 1 }}>{tr('Your phone number stays hidden until you book.')}</M></View>
    {error ? <Text accessibilityRole="alert" style={{ color: C.warn, fontSize: 15, marginBottom: 8 }}>{error}</Text> : null}
    <Btn icon="send" title={busy ? tr('Sending…') : alsoTo.length ? `${tr('Send to')} ${alsoTo.length + 1} ${tr('vendors')}` : tr('Send enquiry')} disabled={busy} onPress={send} /></ScrollView>);
}




const longDate = (d: string) => { const x = new Date(d + 'T00:00:00Z'); return isNaN(+x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const PLAN_BAR = [['overview', 'Overview', 'partnership'], ['checklist', 'Checklist', 'checklist'], ['budget', 'Budget', 'wallet'], ['guests', 'Guests', 'family'], ['tools', 'Tools', 'store']] as const;
const PLAN_TOOLS: [string, string, IconName, string][] = [
  ['events', 'Ceremonies', 'marigold', 'Dates, venues and dress codes'], ['run', 'Run sheet', 'flag', 'Timings for each ceremony'],
  ['shortlist', 'Shortlist', 'heart', 'Vendors you’re considering, with family votes'], ['family', 'Family', 'family', 'Who can see and edit the plan'],
  ['shagun', 'Shagun', 'rupee', 'Gifts received and thank-you notes'], ['stays', 'Guest stays', 'pin', 'Hotels, arrivals and pickups'],
  ['shopping', 'Shopping', 'receipt', 'Outfits, jewellery and family gifts'], ['contacts', 'Day contacts', 'phone', 'Everyone to call on the day'],
  ['documents', 'Documents', 'seal', 'Marriage registration papers'], ['seating', 'Seating', 'ledger', 'Tables for each ceremony'],
  ['invite', 'Wedding website', 'globe', 'A page to share with guests'], ['settings', 'Wedding details', 'ring', 'Names, date, city and budget'],
];
// Every planning tool beyond the four main sections, as a grid of labelled tiles.
function ToolsHub({ open }: { open: (tab: string) => void }) {
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, width: '100%', maxWidth: 700, alignSelf: 'center' }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {PLAN_TOOLS.map(([k, n, icon, detail], i) => <Rise key={k} i={i} style={{ width: '47%', flexGrow: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(n)} onPress={() => open(k)} style={({ pressed }) => ({ minHeight: 120, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, opacity: pressed ? 0.8 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={C.primary} /></View>
          <Text style={{ color: C.ink, fontSize: 15, fontWeight: '500', marginTop: 12 }}>{tr(n)}</Text>
          <M style={{ marginTop: 2 }}>{tr(detail)}</M>
        </Pressable>
      </Rise>)}
    </View>
  </ScrollView>;
}
const PLAN_TABS: [string, string][] = [['overview', 'Overview'], ['checklist', 'Checklist'], ['events', 'Events'], ['budget', 'Budget'], ['guests', 'Guests'], ['shortlist', 'Shortlist'], ['family', 'Family'], ['shagun', 'Shagun'], ['stays', 'Guest stays'], ['run', 'Run sheet'], ['shopping', 'Shopping'], ['contacts', 'Day contacts'], ['documents', 'Documents'], ['seating', 'Seating'], ['invite', 'Invite'], ['settings', 'Wedding details']];
const PLAN_MAIN = [['overview', 'Overview', 'partnership'], ['checklist', 'Checklist', 'checklist'], ['budget', 'Budget', 'wallet'], ['guests', 'Guests', 'family']] as const;
export function Plan(props: any) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.bg }}><PlanBody {...props} /></View>;
}
function PlanBody({ navigation: nav, route }: any) {
  const [me, reload] = useLoad<any>('/me', null); const [tab, setTab] = useState('overview');
  // Other screens (Profile) can open a specific section of the plan.
  useEffect(() => { if (route?.params?.tab) setTab(route.params.tab); }, [route?.params?.tab, route?.params?.at]); 
  if (!me) return <Loading what={tr('your wedding')} />;
  if (!me.wedding) return <Setup onDone={reload} name={me.user?.name} />;
  const tool = PLAN_TOOLS.find(t => t[0] === tab);
  return (<View style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 12, maxWidth: 700, width: '100%', alignSelf: 'center' }}>
      <Text style={{ fontFamily: F.display, fontSize: 24, color: C.ink }} numberOfLines={1}>{me.wedding.title}</Text>
      <M>{longDate(me.wedding.date)} · {me.wedding.city}</M>
      {/* Five fixed sections that always fit the width; everything else lives under Tools. */}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 4 }}>
        {PLAN_BAR.map(([k, n, icon]) => { const on = k === 'tools' ? tab === 'tools' || !!tool : tab === k; return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tr(n)} onPress={() => setTab(k)}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, borderRadius: 10, backgroundColor: on ? C.tint : 'transparent', opacity: pressed ? 0.7 : 1 })}>
            <Icon name={icon} size={20} color={on ? C.primary : C.mute} strokeWidth={on ? 1.8 : 1.5} />
            <Text style={{ fontSize: 12, color: on ? C.primary : C.mute, fontWeight: on ? '600' : '500' }} numberOfLines={1}>{tr(n)}</Text>
          </Pressable>); })}
      </View>
      {tool ? <Pressable accessibilityRole="button" onPress={() => setTab('tools')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, marginTop: 4 }}>
        <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="chevron" size={16} color={C.primary} /></View>
        <Text style={{ color: C.primary, fontSize: 13, fontWeight: '500' }}>{tr('All tools')}</Text><Text style={{ color: C.mute, fontSize: 13 }}> · {tr(tool[1])}</Text>
      </Pressable> : null}
    </View>
    <Rise key={tab} style={{ flex: 1 }}>{tab === 'tools' ? <ToolsHub open={setTab} /> : tab === 'overview' ? <Overview open={setTab} nav={nav} /> : tab === 'settings' ? <WeddingSettings wedding={me.wedding} onSaved={reload} /> : tab === 'checklist' ? <TaskManager /> : tab === 'budget' ? <BudgetManager /> : tab === 'events' ? <Events /> : tab === 'shortlist' ? <ShortlistTab navigation={nav} /> : tab === 'family' ? <Family /> : tab === 'shagun' ? <Gifts /> : tab === 'stays' ? <Stays /> : tab === 'run' ? <RunSheet /> : tab === 'shopping' ? <Shopping /> : tab === 'contacts' ? <DayContacts /> : tab === 'documents' ? <Documents /> : tab === 'seating' ? <Seating /> : tab === 'invite' ? <InviteTab title={me.wedding.title} /> : <Guests />}</Rise></View>);
}
const COMMUNITIES = ['North Indian Hindu', 'South Indian', 'Bengali', 'Gujarati', 'Marathi', 'Punjabi/Sikh', 'Muslim', 'Christian', 'Jain', 'Inter-faith'];
const SETUP_CITIES = ['Mumbai', 'Pune', 'Nashik', 'Nagpur'];
const BUDGETS = [500000, 1000000, 1500000, 2500000, 5000000];
const GUEST_COUNTS = [100, 250, 500, 1000];
// One question group per card, so the form reads as a few short steps rather than one long list.
const SetupSection = ({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) => (
  <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: hint ? 4 : 12 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>{n}</Text></View>
      <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink, flex: 1 }}>{title}</Text>
    </View>
    {hint ? <M style={{ marginBottom: 12 }}>{hint}</M> : null}
    {children}
  </Card>);

// First screen after a couple signs up: names, date and place, budget and guests, traditions.
function Setup({ onDone, name }: { onDone: () => void; name?: string }) {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  const [f, setF] = useState({ me: first, partner: '', date: '', city: 'Pune', otherCity: '', budget: '1500000', guests: '250', community: 'North Indian Hindu' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setError(''); };
  const city = f.city === 'other' ? f.otherCity.trim() : f.city;
  const go = async () => {
    if (f.me.trim().length < 2 || f.partner.trim().length < 2) return setError(tr('Enter both names.'));
    if (!f.date) return setError(tr('Choose your wedding date. You can change it later.'));
    if (!city) return setError(tr('Enter your wedding city.'));
    if (!(+f.budget > 0)) return setError(tr('Enter a budget, even a rough one.'));
    setBusy(true);
    try { await api('/wedding', 'POST', { title: `${f.me.trim()} & ${f.partner.trim()}`, date: f.date, city, community: f.community, budget_paise: +f.budget * 100, guests_est: +f.guests || 250 }); onDone(); }
    catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <View style={{ backgroundColor: C.primary, padding: 24, paddingTop: 20, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.3 }}><FloralArch size={150} color={C.goldSoft} /></View>
      <Text style={{ color: '#F4DDE5', fontSize: 13 }}>{tr('Last step')}</Text>
      <Text style={{ fontFamily: F.display, fontSize: 28, color: C.goldSoft, marginTop: 4 }}>{first ? `${tr('Welcome')}, ${first}` : tr('Welcome')}</Text>
      <Text style={{ color: '#F4DDE5', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 300 }}>{tr('Four quick answers and we’ll build your checklist, budget split and ceremonies. You can change any of it later.')}</Text>
    </View>
    <View style={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <SetupSection n={1} title={tr('Who’s getting married?')}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Input label={tr('Your name')} value={f.me} onChangeText={v => set('me', v)} autoCapitalize="words" maxLength={40} /></View>
          <View style={{ flex: 1 }}><Input label={tr('Partner’s name')} value={f.partner} onChangeText={v => set('partner', v)} autoCapitalize="words" maxLength={40} placeholder={tr('Name')} /></View>
        </View>
      </SetupSection>
      <SetupSection n={2} title={tr('When and where?')}>
        <DateField label={tr('Wedding date')} value={f.date} onChange={v => set('date', v)} min={todayISO()} placeholder={tr('Choose the main wedding day')} />
        <Text style={s.label}>{tr('City')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{SETUP_CITIES.map(c => <Chip key={c} label={c} on={f.city === c} onPress={() => set('city', c)} />)}<Chip label={tr('Other')} on={f.city === 'other'} onPress={() => set('city', 'other')} /></View>
        {f.city === 'other' ? <Input label={tr('Your city')} value={f.otherCity} onChangeText={v => set('otherCity', v)} autoCapitalize="words" maxLength={60} /> : null}
      </SetupSection>
      <SetupSection n={3} title={tr('Budget and guests')} hint={tr('A rough number is fine. We split it across services for you.')}>
        <Text style={s.label}>{tr('Total budget')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{BUDGETS.map(b => <Chip key={b} label={inr(b * 100)} on={+f.budget === b} onPress={() => set('budget', String(b))} />)}</View>
        <Input label={tr('Or enter an amount (₹)')} value={BUDGETS.includes(+f.budget) ? '' : f.budget} onChangeText={v => set('budget', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 1800000" />
        {+f.budget > 0 && !BUDGETS.includes(+f.budget) ? <M style={{ marginTop: -8, marginBottom: 12 }}>{inr(+f.budget * 100)}</M> : null}
        <Text style={s.label}>{tr('About how many guests?')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{GUEST_COUNTS.map(g => <Chip key={g} label={g === 1000 ? '1000+' : String(g)} on={+f.guests === g} onPress={() => set('guests', String(g))} />)}</View>
      </SetupSection>
      <SetupSection n={4} title={tr('Your traditions')} hint={tr('We suggest ceremonies to match. Keep only the ones your families want.')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{COMMUNITIES.map(c => <Chip key={c} label={tr(c)} on={f.community === c} onPress={() => set('community', c)} />)}</View>
      </SetupSection>
      {!!error && <Text accessibilityRole="alert" style={{ color: C.warn, fontSize: 15, lineHeight: 20, marginBottom: 8 }}>{error}</Text>}
      <Btn title={busy ? tr('Creating your plan…') : tr('Create our wedding plan')} onPress={go} disabled={busy} />
    </View>
  </ScrollView>);
}
function Guests() {
  const [list, load] = useLoad<any[]>('/guests', []); const [events] = useLoad<any[]>('/events', []);
  const [invites, loadInvites] = useLoad<any[]>('/guest-events', []); const [counts, loadCounts] = useLoad<any[]>('/events/headcount', []);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [side, setSide] = useState('bride'); const [busy, setBusy] = useState(false); const [adding, setAdding] = useState(false);
  const add = async () => {
    if (!name.trim()) return; if (phone && !/^[6-9]\d{9}$/.test(phone)) return err(new Error(tr('Enter a 10-digit mobile number, or leave it empty.')));
    try { await api('/guests', 'POST', { name: name.trim(), phone, side }); setName(''); setPhone(''); setAdding(false); load(); } catch (e) { err(e); }
  };
  const share = (g: any) => Linking.openURL(`https://wa.me/91${g.phone}?text=${encodeURIComponent(`Namaste ${g.name}, you're invited. Please reply here: ${getBase()}/rsvp/${g.token}`)}`).catch(err);
  // Tapping a ceremony chip invites or uninvites the guest for that ceremony.
  const invite = async (guestId: number, eventId: number, invited: boolean) => {
    if (busy) return; setBusy(true);
    try { await api(`/guests/${guestId}/events/${eventId}`, 'PUT', { invited }); await Promise.all([loadInvites(), loadCounts()]); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const replyFor = (guestId: number, eventId: number) => invites.find(x => x.guest_id === guestId && x.event_id === eventId)?.rsvp;
  // Plain-text headcount the couple can forward to a caterer or venue.
  const shareHeadcount = () => Share.share({ message: counts.filter(c => c.invited).map(c => `${c.name}${c.date ? ` (${dateIN(c.date)})` : ''}: ${c.coming} ${tr('coming')}, ${c.waiting} ${tr('yet to reply')}${c.jain ? `, ${c.jain} Jain` : ''}${c.nonveg ? `, ${c.nonveg} non-veg` : ''}`).join('\n') }).catch(() => {});
  const yes = list.filter(g => g.rsvp === 'yes').length; const no = list.filter(g => g.rsvp === 'no').length;
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card><View style={{ flexDirection: 'row' }}>{[[list.length, tr('Invited'), C.ink], [yes, tr('Coming'), C.ok], [no, tr('Declined'), C.warn], [list.length - yes - no, tr('Waiting'), C.mute]].map(([n, l, c], i) => (
      <View key={i} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontFamily: F.display, fontSize: 24, color: c as string, fontVariant: ['tabular-nums'] }}>{n as number}</Text><M>{l as string}</M></View>))}</View></Card>
    {counts.some(c => c.invited) ? <Card>
      <View style={s.row}><Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>{tr('Headcount by ceremony')}</Text><Btn small kind="quiet" icon="share" title={tr('Share')} onPress={shareHeadcount} /></View>
      {counts.filter(c => c.invited).map((c, i) => <View key={c.id} style={[s.row, { paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }]}>
        <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{c.name}</Text><M>{c.date ? dateIN(c.date) + ' · ' : ''}{c.invited} {tr('invited')}{c.jain ? ` · ${c.jain} Jain` : ''}{c.nonveg ? ` · ${c.nonveg} ${tr('non-veg')}` : ''}</M></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: C.ok, fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{c.coming}</Text><M>{c.waiting} {tr('waiting')}</M></View>
      </View>)}
    </Card> : null}
    {adding || !list.length ? <Card><Input label={tr('Guest name')} placeholder={tr('e.g. Meera Iyer')} value={name} onChangeText={setName} autoFocus={adding} /><Input label={tr('WhatsApp number (optional)')} placeholder="10-digit mobile" value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} />
    <View style={{ flexDirection: 'row' }}><Chip label={tr('Bride side')} on={side === 'bride'} onPress={() => setSide('bride')} /><Chip label={tr('Groom side')} on={side === 'groom'} onPress={() => setSide('groom')} /></View><Btn icon="plus" title={tr('Add guest')} onPress={add} />{list.length ? <Btn kind="ghost" title={tr('Done')} onPress={() => setAdding(false)} /> : null}</Card>
      : <Btn kind="quiet" icon="plus" title={tr('Add a guest')} onPress={() => setAdding(true)} />}
    {list.length && !events.length ? <M style={{ marginVertical: 8 }}>{tr('Add your ceremonies under More, then Events, to invite guests to each one separately.')}</M> : null}
    {!list.length && <Empty icon="family" title={tr('No guests yet')} text={tr('Add guests with a WhatsApp number and send each one a personal RSVP link.')} />}
    {list.map((g, i) => (<Rise key={g.id} i={i}><Card><View style={s.row}><View style={{ flex: 1 }}><Text style={{ fontWeight: '500', color: C.ink }}>{g.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}><Tag tone={g.rsvp === 'yes' ? 'ok' : g.rsvp === 'no' ? 'warn' : 'mute'} label={g.rsvp === 'yes' ? tr('Coming') : g.rsvp === 'no' ? tr('Declined') : tr('Waiting')} />
        <M> {g.side === 'bride' ? tr('Bride side') : tr('Groom side')}{g.meal ? ' · ' + g.meal : ''}{g.plus_ones ? ` · +${g.plus_ones}` : ''}</M></View></View>
      {g.phone ? <Btn small kind="quiet" icon="send" title="WhatsApp" onPress={() => share(g)} /> : null}</View>
      {events.length ? <View style={{ marginTop: 12 }}><M style={{ marginBottom: 4 }}>{tr('Invited to')}</M><ScrollView horizontal showsHorizontalScrollIndicator={false}>{events.map(e => {
        const reply = replyFor(g.id, e.id);
        return <Chip key={e.id} label={e.name} on={!!reply} icon={reply === 'yes' ? 'check' : reply === 'no' ? 'close' : undefined} onPress={() => invite(g.id, e.id, !reply)} />;
      })}</ScrollView></View> : null}
    </Card></Rise>))}</ScrollView>);
}
