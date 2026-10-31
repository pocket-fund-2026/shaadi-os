import { Overview, TaskManager, BudgetManager, WeddingSettings } from './planner';
import { tr } from './i18n';
import { Events, Family, ShortlistTab, InviteTab } from './more';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View, RefreshControl, Linking, KeyboardAvoidingView, Platform, Pressable, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, getBase } from './api';
import { Btn, Card, Chip, H, Input, M, C, F, inr, err, s, Empty, Rise, Tag, Stars, Bar, Check, Loading, confirm, notify, dateIN, DateField, todayISO } from './ui';
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
export function Discover({ navigation, route }: any) {
  const insets = useSafeAreaInsets(); const [me] = useLoad<any>('/me', null);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.bg }}><Marketplace openVendor={id => navigation.navigate('Vendor', { id })} preset={route?.params} weddingDate={me?.wedding?.date} /></View>;
}

export function VendorScreen({ route, navigation }: any) {
  const [v] = useLoad<any>('/vendors/' + route.params.id, null); const t = useT(); const [saved, setSaved] = useState(false); const insets = useSafeAreaInsets();
  if (!v) return <Loading what={tr('vendor')} />;
  const shortlist = () => api('/shortlist', 'POST', { vendor_id: v.id }).then(() => setSaved(true)).catch(err);
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
          ? <View style={{ flexDirection: 'row', backgroundColor: C.chipBg, borderRadius: 12, padding: 12, marginTop: 16 }}><Icon name="alert" size={18} color={C.mute} /><M style={{ flex: 1, marginLeft: 8, color: C.ink }}>{tr('This business has not joined Shaadi OS yet. Its details come from its own public pages and may be out of date.')}</M></View>
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
        : <Btn title={t('book')} onPress={() => navigation.navigate('EnquiryForm', { vendor: v })} />}</View>
    </View>
  </View>);
}

export function EnquiryForm({ route, navigation }: any) {
  const v = route.params.vendor; const [date, setDate] = useState(''); const [guests, setGuests] = useState('200'); const [budget, setBudget] = useState(String(Math.round(v.start_paise / 100))); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(new Error(tr('Choose the event date.')));
    setBusy(true);
    try { const av = await api(`/vendors/${v.id}/availability?date=${date}`); if (!av.available && !(await confirm(tr('Date not available'), tr('This vendor is busy on that date. Send anyway?'), tr('Send')))) return; const r = await api('/enquiries', 'POST', { vendor_id: v.id, event_date: date, guests: +guests, budget_paise: +budget * 100, note }); navigation.replace('Chat', { id: r.id, title: v.name }); } catch (e) { err(e); } finally { setBusy(false); }
  };
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><CatMark c={v.category} size={40} /><H style={{ marginLeft: 12, flex: 1 }}>{v.name}</H></View>
    <DateField label={tr('Event date')} value={date} onChange={setDate} min={todayISO()} />
    <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label={tr('Guests')} value={guests} onChangeText={setGuests} keyboardType="number-pad" /></View>
      <View style={{ flex: 1 }}><Input label={tr('Budget (₹)')} value={budget} onChangeText={setBudget} keyboardType="number-pad" /></View></View>
    <Input label={tr('Note')} value={note} onChangeText={setNote} multiline placeholder={tr('Ceremonies, timings, anything the vendor should know')} style={{ minHeight: 88, textAlignVertical: 'top' }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Icon name="lock" size={16} color={C.mute} /><M style={{ marginLeft: 8, flex: 1 }}>{tr('Your phone number stays hidden until you book.')}</M></View>
    <Btn icon="send" title={busy ? tr('Sending…') : tr('Send enquiry')} disabled={busy} onPress={send} /></ScrollView>);
}

export function Enquiries({ navigation, vendor }: any) {
  const [list, load, busy] = useLoad<any[]>('/enquiries', []);
  return (<FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} data={list} keyExtractor={e => String(e.id)} refreshControl={refresh(busy, load)}
    ListEmptyComponent={busy ? null : vendor
      ? <Empty icon="inbox" title={tr('No leads yet')} text={tr('Couples who enquire about your services appear here. A complete storefront with a clear starting price gets found more often.')} action={tr('Edit storefront')} onAction={() => navigation.navigate('Store')} />
      : <Empty icon="chat" title={tr('No enquiries yet')} text={tr('Pick a vendor in Discover and send an enquiry. Their reply and quote will show up here.')} action={tr('Browse vendors')} onAction={() => navigation.navigate('Discover')} />}
    renderItem={({ item: e, index }) => (<Rise i={index}><Card onPress={() => navigation.navigate('Chat', { id: e.id, title: e.vendor_name || e.couple_name, vendor })}>
      <View style={s.row}><Text style={{ fontWeight: '500', color: C.ink, fontSize: 17, flex: 1 }}>{e.vendor_name || e.couple_name}</Text>
        {e.status === 'booked' ? <Tag tone="ok" icon="check" label={tr('Booked')} /> : e.quote_status === 'sent' ? <Tag tone="gold" label={tr('Quote received')} /> : <Tag label={tr('Open')} />}</View>
      <M style={{ marginTop: 4 }}>{dateIN(e.event_date)} · {e.guests} {tr('guests')} · {tr('budget')} {inr(e.budget_paise)}</M></Card></Rise>)} />);
}

export function Chat({ route, navigation }: any) {
  const { id, vendor } = route.params; const [d, load] = useLoad<any>('/enquiries/' + id, null); const [msg, setMsg] = useState('');
  const [qLabel, setQLabel] = useState(''); const [qAmt, setQAmt] = useState(''); const [showQ, setShowQ] = useState(false);
  useEffect(() => { const i = setInterval(load, 6000); return () => clearInterval(i); }, [load]);
  if (!d) return <Loading what={tr('conversation')} />;
  const send = async () => { if (!msg.trim()) return; try { await api(`/enquiries/${id}/messages`, 'POST', { body: msg }); setMsg(''); load(); } catch (e) { err(e); } };
  const sendQuote = async () => { try { await api(`/enquiries/${id}/quotes`, 'POST', { items: [{ label: qLabel || 'Service', amount_paise: Math.round(+qAmt * 100) }] }); setShowQ(false); setQLabel(''); setQAmt(''); load(); } catch (e) { err(e); } };
  const accept = async (qid: number) => { try { await api(`/quotes/${qid}/accept`, 'POST'); navigation.navigate('Home', { screen: 'Bookings' }); } catch (e) { err(e); } };
  return (<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {d.booked && <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.okSoft, borderRadius: 10, padding: 12, marginBottom: 12 }}><Icon name="shield" size={18} color={C.ok} /><Text style={{ color: C.ok, fontWeight: '500', marginLeft: 8 }}>{tr('Booked. Booking Protection is active.')}</Text></View>}
      {d.quotes.map((qt: any) => (<Rise key={qt.id}><Card style={qt.status === 'sent' ? { borderColor: C.gold } : undefined}>
        <View style={s.row}><Text style={{ fontWeight: '500', color: C.ink }}>{tr('Quote')} v{qt.version}</Text><Tag tone={qt.status === 'accepted' ? 'ok' : qt.status === 'sent' ? 'gold' : 'mute'} label={tr(qt.status[0].toUpperCase() + qt.status.slice(1))} /></View>
        <Text style={{ fontFamily: F.display, fontSize: 24, color: C.primary, marginVertical: 4 }}>{inr(qt.total_paise)}</Text>
        {qt.items.map((i: any, k: number) => <View key={k} style={s.row}><M>{i.label}</M><M>{inr(i.amount_paise)}</M></View>)}
        <M style={{ marginTop: 8 }}>{tr('Paid in milestones')}: {qt.milestones.map((m: any) => `${m.label} ${m.pct}%`).join(' · ')}</M>
        {!vendor && qt.status === 'sent' && <Btn icon="shield" title={tr('Accept & book')} onPress={() => accept(qt.id)} />}</Card></Rise>))}
      {!d.messages.length && <M style={{ textAlign: 'center', marginVertical: 16 }}>{vendor ? tr('Reply to start the conversation. Phone numbers stay hidden until the couple books.') : tr('Your enquiry was sent. The vendor usually replies here with questions or a quote.')}</M>}
      {d.messages.map((m: any) => { const mine = vendor ? m.sender_id !== d.enquiry.couple_id : m.sender_id === d.enquiry.couple_id; return (
        <Rise key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
          <View style={{ backgroundColor: mine ? C.primary : '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, marginBottom: 8, borderWidth: mine ? 0 : 1, borderColor: C.line }}>
            <Text style={{ color: mine ? '#fff' : C.ink, fontSize: 15, lineHeight: 20 }}>{m.body}</Text></View></Rise>); })}
      {vendor && !d.booked && <Btn kind="quiet" icon="receipt" title={showQ ? tr('Cancel quote') : tr('Send a quote')} onPress={() => setShowQ(!showQ)} />}
      {showQ && <Rise><Card><Input label={tr('Item')} value={qLabel} onChangeText={setQLabel} placeholder={tr('What you will deliver')} /><Input label={tr('Amount (₹)')} value={qAmt} onChangeText={setQAmt} keyboardType="number-pad" />
        <M>{tr('Paid as 20% token, 50% one week before, 30% after the event.')}</M><Btn title={tr('Send quote')} onPress={sendQuote} /></Card></Rise>}
    </ScrollView>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line }}>
      <View style={{ flex: 1 }}><Input value={msg} onChangeText={setMsg} placeholder={tr('Message…')} onSubmitEditing={send} returnKeyType="send" style={{ marginBottom: -12 }} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Send')} onPress={send} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, marginLeft: 8, backgroundColor: msg.trim() ? C.primary : C.chipBg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Icon name="send" size={20} color={msg.trim() ? '#fff' : C.mute} /></Pressable></View></KeyboardAvoidingView>);
}

const MS: Record<string, { tone: 'ok' | 'gold' | 'mute'; label: string }> = { released: { tone: 'ok', label: 'Released' }, held: { tone: 'gold', label: 'Held in escrow' }, pending: { tone: 'mute', label: 'Due' } };
export function Bookings({ vendor }: any) {
  const [list, load, busy] = useLoad<any[]>('/bookings', []); const [rate, setRate] = useState<Record<number, number>>({});
  const act = async (path: string) => { try { await api(path, 'POST'); load(); } catch (e) { err(e); } };
  const review = async (id: number) => { try { await api(`/bookings/${id}/review`, 'POST', { rating: rate[id] || 5, text: '' }); load(); } catch (e) { err(e); } };
  const dispute = async (id: number) => { if (await confirm(tr('Raise a dispute?'), tr('Support will review this booking and any money still in escrow stays held until it is resolved.'), tr('Raise dispute'), true)) api(`/bookings/${id}/dispute`, 'POST', { reason: 'Issue with service, needs review by support' }).then(load).catch(err); };
  return (<FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} data={list} keyExtractor={b => String(b.id)} refreshControl={refresh(busy, load)}
    ListEmptyComponent={busy ? null : <Empty icon="ledger" title={tr('No bookings yet')} text={vendor ? tr('A booking is created when a couple accepts your quote in chat.') : tr('A booking is created when you accept a vendor’s quote in chat. Payments then run milestone by milestone.')} />}
    renderItem={({ item: b, index }) => { const paid = b.milestones.filter((m: any) => m.status !== 'pending').reduce((a: number, m: any) => a + m.amount_paise, 0); return (<Rise i={index}><Card>
      <View style={s.row}><Text style={{ fontWeight: '500', fontSize: 17, color: C.ink, flex: 1 }}>{vendor ? b.couple_name : b.vendor_name}</Text><Tag tone={b.status === 'completed' ? 'ok' : 'mute'} label={tr(b.status[0].toUpperCase() + b.status.slice(1))} /></View>
      <View style={[s.row, { marginTop: 8 }]}><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{inr(b.total_paise)}</Text><M>{inr(paid)} {tr('paid')}</M></View>
      <View style={{ marginTop: 8, marginBottom: 4 }}><Bar pct={b.total_paise ? Math.round(paid / b.total_paise * 100) : 0} color={C.ok} /></View>
      {b.milestones.map((m: any) => (<View key={m.id} style={[s.row, { marginTop: 12 }]}><View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: C.ink, fontWeight: '500' }}>{m.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}><Tag tone={MS[m.status]?.tone || 'mute'} label={tr(MS[m.status]?.label || m.status)} /><M> {inr(m.amount_paise)}</M></View></View>
        {!vendor && m.status === 'pending' && <Btn small kind={m.id === b.milestones.find((x: any) => x.status === 'pending')?.id ? 'primary' : 'quiet'} title={tr('Pay (demo)')} onPress={() => act(`/milestones/${m.id}/pay`)} />}
        {!vendor && m.status === 'held' && <Btn small kind="ok" title={tr('Release')} onPress={() => act(`/milestones/${m.id}/release`)} />}</View>))}
      <M style={{ marginTop: 12 }}>{tr('Platform fee')} {b.commission_bps / 100}% · {tr('paid by the vendor')}</M>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}><Chip icon="flag" label={tr('Raise dispute')} onPress={() => dispute(b.id)} />
        {vendor && <Chip icon="receipt" label={tr('GST invoice')} onPress={() => api(`/bookings/${b.id}/invoice`).then((i: any) => notify(i.invoice_no, `${tr('Commission')} ${inr(i.commission_paise)} + GST ${inr(i.gst_paise)} = ${inr(i.total_paise)}\n${i.note}`)).catch(err)} />}</View>
      {!vendor && !b.reviewed && b.milestones.some((m: any) => m.status !== 'pending') && (<View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}><Text style={{ fontWeight: '500', color: C.ink }}>{tr('Rate this vendor')}</Text>
        <View style={{ flexDirection: 'row', marginVertical: 8 }}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} stars`} accessibilityState={{ selected: n <= (rate[b.id] || 0) }} hitSlop={6} onPress={() => setRate({ ...rate, [b.id]: n })} style={{ padding: 4 }}><Icon name="star" size={28} color={n <= (rate[b.id] || 0) ? C.gold : C.line} /></Pressable>)}</View>
        <Btn small kind="ghost" title={tr('Submit review')} disabled={!rate[b.id]} onPress={() => review(b.id)} /></View>)}</Card></Rise>); }} />);
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
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [side, setSide] = useState('bride'); const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return; if (phone && !/^[6-9]\d{9}$/.test(phone)) return err(new Error(tr('Enter a 10-digit mobile number, or leave it empty.')));
    try { await api('/guests', 'POST', { name: name.trim(), phone, side }); setName(''); setPhone(''); load(); } catch (e) { err(e); }
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
    <Input label={tr('Guest name')} placeholder="Guest Name" value={name} onChangeText={setName} /><Input label={tr('WhatsApp number (optional)')} placeholder="10-digit mobile" value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} />
    <View style={{ flexDirection: 'row' }}><Chip label={tr('Bride side')} on={side === 'bride'} onPress={() => setSide('bride')} /><Chip label={tr('Groom side')} on={side === 'groom'} onPress={() => setSide('groom')} /></View><Btn icon="plus" title={tr('Add guest')} onPress={add} />
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
