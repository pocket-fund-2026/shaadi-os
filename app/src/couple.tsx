import { Overview, TaskManager, BudgetManager, WeddingSettings } from './planner';
import { tr } from './i18n';
import { Events, Family, ShortlistTab, InviteTab } from './more';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View, RefreshControl, Linking, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, getBase } from './api';
import { Btn, Card, Chip, H, Input, M, C, F, inr, err, s, Empty, Rise, Tag, Stars, Bar, Check, Loading, confirm, notify } from './ui';
import { Icon, CAT_ICON } from './icons';
import { Marketplace } from './marketplace';
import { CategoryCover } from './visuals';
import { VendorCatalog } from './catalog';
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

export function Discover({ navigation }: any) {
  return <Marketplace openVendor={id => navigation.navigate('Vendor', { id })} />;
}

export function VendorScreen({ route, navigation }: any) {
  const [v] = useLoad<any>('/vendors/' + route.params.id, null); const t = useT(); const [saved, setSaved] = useState(false); const insets = useSafeAreaInsets();
  if (!v) return <Loading what={tr('vendor')} />;
  const shortlist = () => api('/shortlist', 'POST', { vendor_id: v.id }).then(() => setSaved(true)).catch(err);
  // Price and the booking action stay pinned at the bottom so they're reachable from anywhere in a long profile.
  return (<View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 18 }}><CategoryCover category={v.category} label={catLabel(v.category)} large /></View>
      <Rise i={0}>
        <H style={{ marginVertical: 0, fontSize: 28, lineHeight: 34 }}>{v.name}</H>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><Icon name="pin" size={15} color={C.mute} /><M style={{ marginLeft: 5, flex: 1 }}>{catLabel(v.category)} · {v.locality ? v.locality + ', ' : ''}{v.city}</M></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          {v.verified ? <Tag tone="ok" icon="seal" label={tr('Verified')} /> : null}
          {v.rating ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><Stars n={Math.round(v.rating)} /><M> {v.rating} · {v.reviews} {tr('reviews')}</M></View> : <M>{tr('No reviews yet')}</M>}</View>
        {v.description ? <Text style={{ marginTop: 14, color: C.ink, fontSize: 15, lineHeight: 23 }}>{v.description}</Text> : null}
        <View style={{ flexDirection: 'row', backgroundColor: C.okSoft, borderRadius: 12, padding: 12, marginTop: 16 }}><Icon name="shield" size={18} color={C.ok} /><M style={{ flex: 1, marginLeft: 8, color: C.ink }}>{tr('Booking Protection: you pay in milestones and each one is held until you release it.')}</M></View>
      </Rise>
      <VendorCatalog vendor={v} />
      <H style={{ marginTop: 28 }}>{tr('Reviews')}</H>
      {v.reviewList.length ? v.reviewList.map((r: any, i: number) => <Rise key={i} i={i}><Card>
        <View style={s.row}><Text style={{ fontWeight: '600', color: C.ink }}>{r.name}</Text><Stars n={r.rating} /></View>
        {r.text ? <M style={{ marginTop: 4 }}>{r.text}</M> : null}</Card></Rise>)
        : <Empty icon="star" title={tr('No reviews yet')} text={tr('Only couples who booked and paid through Shaadi OS can review, so every review here is from a real booking.')} />}
    </ScrollView>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
      <View><M style={{ fontSize: 11 }}>{tr('Starting price')}</M><Text style={{ fontFamily: F.display, fontSize: 21, color: C.primary }}>{inr(v.start_paise)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? tr('Shortlisted') : tr('Shortlist')} accessibilityState={{ selected: saved, disabled: saved }} disabled={saved} onPress={shortlist}
        style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 12, borderWidth: 1.3, borderColor: C.primary, backgroundColor: saved ? C.tint : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
        <Icon name={saved ? 'heartFill' : 'heart'} size={20} color={C.primary} /></Pressable>
      <View style={{ flex: 1 }}><Btn title={t('book')} onPress={() => navigation.navigate('EnquiryForm', { vendor: v })} /></View>
    </View>
  </View>);
}

export function EnquiryForm({ route, navigation }: any) {
  const v = route.params.vendor; const [date, setDate] = useState(''); const [guests, setGuests] = useState('200'); const [budget, setBudget] = useState(String(Math.round(v.start_paise / 100))); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(new Error(tr('Enter the event date as YYYY-MM-DD.')));
    setBusy(true);
    try { const av = await api(`/vendors/${v.id}/availability?date=${date}`); if (!av.available && !(await confirm(tr('Date not available'), tr('This vendor is busy on that date. Send anyway?'), tr('Send')))) return; const r = await api('/enquiries', 'POST', { vendor_id: v.id, event_date: date, guests: +guests, budget_paise: +budget * 100, note }); navigation.replace('Chat', { id: r.id, title: v.name }); } catch (e) { err(e); } finally { setBusy(false); }
  };
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><CatMark c={v.category} size={40} /><H style={{ marginLeft: 10, flex: 1 }}>{v.name}</H></View>
    <Input label={tr('Event date (YYYY-MM-DD)')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Input label={tr('Guests')} value={guests} onChangeText={setGuests} keyboardType="number-pad" /></View>
      <View style={{ flex: 1 }}><Input label={tr('Budget (₹)')} value={budget} onChangeText={setBudget} keyboardType="number-pad" /></View></View>
    <Input label={tr('Note')} value={note} onChangeText={setNote} multiline placeholder={tr('Ceremonies, timings, anything the vendor should know')} style={{ minHeight: 88, textAlignVertical: 'top' }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Icon name="lock" size={16} color={C.mute} /><M style={{ marginLeft: 6, flex: 1 }}>{tr('Your phone number stays hidden until you book.')}</M></View>
    <Btn icon="send" title={busy ? tr('Sending…') : tr('Send enquiry')} disabled={busy} onPress={send} /></ScrollView>);
}

export function Enquiries({ navigation, vendor }: any) {
  const [list, load, busy] = useLoad<any[]>('/enquiries', []);
  return (<FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} data={list} keyExtractor={e => String(e.id)} refreshControl={refresh(busy, load)}
    ListEmptyComponent={busy ? null : vendor
      ? <Empty icon="inbox" title={tr('No leads yet')} text={tr('Couples who enquire about your services appear here. A complete storefront with a clear starting price gets found more often.')} action={tr('Edit storefront')} onAction={() => navigation.navigate('Store')} />
      : <Empty icon="chat" title={tr('No enquiries yet')} text={tr('Pick a vendor in Discover and send an enquiry. Their reply and quote will show up here.')} action={tr('Browse vendors')} onAction={() => navigation.navigate('Discover')} />}
    renderItem={({ item: e, index }) => (<Rise i={index}><Card onPress={() => navigation.navigate('Chat', { id: e.id, title: e.vendor_name || e.couple_name, vendor })}>
      <View style={s.row}><Text style={{ fontWeight: '600', color: C.ink, fontSize: 16, flex: 1 }}>{e.vendor_name || e.couple_name}</Text>
        {e.status === 'booked' ? <Tag tone="ok" icon="check" label={tr('Booked')} /> : e.quote_status === 'sent' ? <Tag tone="gold" label={tr('Quote received')} /> : <Tag label={tr('Open')} />}</View>
      <M style={{ marginTop: 4 }}>{e.event_date} · {e.guests} {tr('guests')} · {tr('budget')} {inr(e.budget_paise)}</M></Card></Rise>)} />);
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
      {d.booked && <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.okSoft, borderRadius: 10, padding: 10, marginBottom: 12 }}><Icon name="shield" size={18} color={C.ok} /><Text style={{ color: C.ok, fontWeight: '600', marginLeft: 8 }}>{tr('Booked. Booking Protection is active.')}</Text></View>}
      {d.quotes.map((qt: any) => (<Rise key={qt.id}><Card style={qt.status === 'sent' ? { borderColor: C.gold } : undefined}>
        <View style={s.row}><Text style={{ fontWeight: '600', color: C.ink }}>{tr('Quote')} v{qt.version}</Text><Tag tone={qt.status === 'accepted' ? 'ok' : qt.status === 'sent' ? 'gold' : 'mute'} label={tr(qt.status[0].toUpperCase() + qt.status.slice(1))} /></View>
        <Text style={{ fontFamily: F.display, fontSize: 24, color: C.primary, marginVertical: 4 }}>{inr(qt.total_paise)}</Text>
        {qt.items.map((i: any, k: number) => <View key={k} style={s.row}><M>{i.label}</M><M>{inr(i.amount_paise)}</M></View>)}
        <M style={{ marginTop: 6 }}>{tr('Paid in milestones')}: {qt.milestones.map((m: any) => `${m.label} ${m.pct}%`).join(' · ')}</M>
        {!vendor && qt.status === 'sent' && <Btn icon="shield" title={tr('Accept & book')} onPress={() => accept(qt.id)} />}</Card></Rise>))}
      {!d.messages.length && <M style={{ textAlign: 'center', marginVertical: 16 }}>{vendor ? tr('Reply to start the conversation. Phone numbers stay hidden until the couple books.') : tr('Your enquiry was sent. The vendor usually replies here with questions or a quote.')}</M>}
      {d.messages.map((m: any) => { const mine = vendor ? m.sender_id !== d.enquiry.couple_id : m.sender_id === d.enquiry.couple_id; return (
        <Rise key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
          <View style={{ backgroundColor: mine ? C.primary : '#fff', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, marginBottom: 6, borderWidth: mine ? 0 : 1, borderColor: C.line }}>
            <Text style={{ color: mine ? '#fff' : C.ink, fontSize: 15, lineHeight: 20 }}>{m.body}</Text></View></Rise>); })}
      {vendor && !d.booked && <Btn kind="quiet" icon="receipt" title={showQ ? tr('Cancel quote') : tr('Send a quote')} onPress={() => setShowQ(!showQ)} />}
      {showQ && <Rise><Card><Input label={tr('Item')} value={qLabel} onChangeText={setQLabel} placeholder={tr('What you will deliver')} /><Input label={tr('Amount (₹)')} value={qAmt} onChangeText={setQAmt} keyboardType="number-pad" />
        <M>{tr('Paid as 20% token, 50% one week before, 30% after the event.')}</M><Btn title={tr('Send quote')} onPress={sendQuote} /></Card></Rise>}
    </ScrollView>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line }}>
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
      <View style={s.row}><Text style={{ fontWeight: '600', fontSize: 16, color: C.ink, flex: 1 }}>{vendor ? b.couple_name : b.vendor_name}</Text><Tag tone={b.status === 'completed' ? 'ok' : 'mute'} label={tr(b.status[0].toUpperCase() + b.status.slice(1))} /></View>
      <View style={[s.row, { marginTop: 8 }]}><Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink }}>{inr(b.total_paise)}</Text><M>{inr(paid)} {tr('paid')}</M></View>
      <View style={{ marginTop: 6, marginBottom: 4 }}><Bar pct={b.total_paise ? Math.round(paid / b.total_paise * 100) : 0} color={C.ok} /></View>
      {b.milestones.map((m: any) => (<View key={m.id} style={[s.row, { marginTop: 10 }]}><View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: C.ink, fontWeight: '500' }}>{m.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}><Tag tone={MS[m.status]?.tone || 'mute'} label={tr(MS[m.status]?.label || m.status)} /><M> {inr(m.amount_paise)}</M></View></View>
        {!vendor && m.status === 'pending' && <Btn small kind={m.id === b.milestones.find((x: any) => x.status === 'pending')?.id ? 'primary' : 'quiet'} title={tr('Pay (demo)')} onPress={() => act(`/milestones/${m.id}/pay`)} />}
        {!vendor && m.status === 'held' && <Btn small kind="ok" title={tr('Release')} onPress={() => act(`/milestones/${m.id}/release`)} />}</View>))}
      <M style={{ marginTop: 10 }}>{tr('Platform fee')} {b.commission_bps / 100}% · {tr('paid by the vendor')}</M>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}><Chip icon="flag" label={tr('Raise dispute')} onPress={() => dispute(b.id)} />
        {vendor && <Chip icon="receipt" label={tr('GST invoice')} onPress={() => api(`/bookings/${b.id}/invoice`).then((i: any) => notify(i.invoice_no, `${tr('Commission')} ${inr(i.commission_paise)} + GST ${inr(i.gst_paise)} = ${inr(i.total_paise)}\n${i.note}`)).catch(err)} />}</View>
      {!vendor && !b.reviewed && b.milestones.some((m: any) => m.status !== 'pending') && (<View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }}><Text style={{ fontWeight: '600', color: C.ink }}>{tr('Rate this vendor')}</Text>
        <View style={{ flexDirection: 'row', marginVertical: 6 }}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityLabel={`${n} stars`} hitSlop={6} onPress={() => setRate({ ...rate, [b.id]: n })} style={{ padding: 4 }}><Icon name="star" size={28} color={n <= (rate[b.id] || 0) ? C.gold : C.line} /></Pressable>)}</View>
        <Btn small kind="ghost" title={tr('Submit review')} disabled={!rate[b.id]} onPress={() => review(b.id)} /></View>)}</Card></Rise>); }} />);
}

const longDate = (d: string) => { const x = new Date(d + 'T00:00:00Z'); return isNaN(+x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const PLAN_TABS: [string, string][] = [['overview', 'Overview'], ['checklist', 'Checklist'], ['events', 'Events'], ['budget', 'Budget'], ['guests', 'Guests'], ['shortlist', 'Shortlist'], ['family', 'Family'], ['invite', 'Invite'], ['settings', 'Wedding details']];
const PLAN_MAIN = [['overview', 'Overview', 'partnership'], ['checklist', 'Checklist', 'checklist'], ['budget', 'Budget', 'wallet'], ['guests', 'Guests', 'family']] as const;
export function Plan({ navigation: nav }: any) {
  const [me, reload] = useLoad<any>('/me', null); const [tab, setTab] = useState('overview'); const [showMore, setShowMore] = useState(false);
  if (!me) return <Loading what={tr('your wedding')} />;
  if (!me.wedding) return <Setup onDone={reload} />;
  return (<View style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, maxWidth: 700, width: '100%', alignSelf: 'center' }}><M style={{ color: C.gold, fontWeight: '600' }}>{tr('The wedding plan')}</M><Text style={{ fontFamily: F.display, fontSize: 27, color: C.ink, marginTop: 2 }}>{me.wedding.title}</Text><M>{longDate(me.wedding.date)} · {me.wedding.city}</M></View>
    <View style={{ maxWidth: 700, width: '100%', alignSelf: 'center' }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}>{PLAN_MAIN.map(([k, n, icon]) => <Chip key={k} icon={icon} label={tr(n)} on={tab === k} onPress={() => { setTab(k); setShowMore(false); }} />)}<Chip icon="plus" label={tr('More')} on={showMore || !PLAN_MAIN.some(([k]) => k === tab)} onPress={() => setShowMore(!showMore)} /></ScrollView>
      {showMore && <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 4 }}>{PLAN_TABS.filter(([k]) => !PLAN_MAIN.some(([main]) => main === k)).map(([k, n]) => <Chip key={k} label={tr(n)} on={tab === k} onPress={() => { setTab(k); setShowMore(false); }} />)}</View>}
      {!showMore && !PLAN_MAIN.some(([k]) => k === tab) && <M style={{ paddingHorizontal: 16, paddingBottom: 3 }}>{tr(PLAN_TABS.find(([k]) => k === tab)?.[1] || '')}</M>}</View>
    <Rise key={tab} style={{ flex: 1 }}>{tab === 'overview' ? <Overview open={setTab} /> : tab === 'settings' ? <WeddingSettings wedding={me.wedding} onSaved={reload} /> : tab === 'checklist' ? <TaskManager /> : tab === 'budget' ? <BudgetManager /> : tab === 'events' ? <Events /> : tab === 'shortlist' ? <ShortlistTab navigation={nav} /> : tab === 'family' ? <Family /> : tab === 'invite' ? <InviteTab title={me.wedding.title} /> : <Guests />}</Rise></View>);
}
function Setup({ onDone }: any) {
  const [f, setF] = useState({ title: '', date: '', city: 'Pune', budget: '1500000', guests: '250', community: 'North Indian Hindu' });
  const go = async () => { try { await api('/wedding', 'POST', { title: f.title, date: f.date, city: f.city, community: f.community, budget_paise: +f.budget * 100, guests_est: +f.guests }); onDone(); } catch (e) { err(e); } };
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"><H>{tr('Set up your wedding')}</H>
    <M style={{ marginBottom: 12 }}>{tr('We build your checklist, budget split and ceremonies from these details. You can change them later.')}</M>
    <Input label={tr('Couple names')} value={f.title} onChangeText={v => setF({ ...f, title: v })} placeholder="Partner & Partner" /><Input label={tr('Date (YYYY-MM-DD)')} value={f.date} onChangeText={v => setF({ ...f, date: v })} placeholder="YYYY-MM-DD" />
    <Input label={tr('City')} value={f.city} onChangeText={v => setF({ ...f, city: v })} />
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Input label={tr('Total budget (₹)')} value={f.budget} onChangeText={v => setF({ ...f, budget: v })} keyboardType="number-pad" /></View>
      <View style={{ flex: 1 }}><Input label={tr('Estimated guests')} value={f.guests} onChangeText={v => setF({ ...f, guests: v })} keyboardType="number-pad" /></View></View>
    <Text style={s.label}>{tr('Community (sets your ceremonies)')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 }}>{['North Indian Hindu', 'South Indian', 'Bengali', 'Gujarati', 'Marathi', 'Punjabi/Sikh', 'Muslim', 'Christian', 'Jain', 'Inter-faith'].map(c => <Chip key={c} label={c} on={f.community === c} onPress={() => setF({ ...f, community: c })} />)}</View>
    <Btn title={tr('Create workspace')} onPress={go} /></ScrollView>);
}
function Guests() {
  const [list, load] = useLoad<any[]>('/guests', []); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [side, setSide] = useState('bride');
  const add = async () => { if (!name.trim()) return; if (phone && !/^[6-9]\d{9}$/.test(phone)) return err(new Error(tr('Enter a 10-digit mobile number, or leave it empty.'))); await api('/guests', 'POST', { name, phone, side }).catch(err); setName(''); setPhone(''); load(); };
  const share = (g: any) => Linking.openURL(`https://wa.me/91${g.phone}?text=${encodeURIComponent(`Namaste ${g.name}, you're invited! RSVP: ${getBase()}/rsvp/${g.token}`)}`).catch(err);
  const yes = list.filter(g => g.rsvp === 'yes').length; const no = list.filter(g => g.rsvp === 'no').length;
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <Card><View style={{ flexDirection: 'row' }}>{[[list.length, tr('Invited'), C.ink], [yes, tr('Coming'), C.ok], [no, tr('Declined'), C.warn], [list.length - yes - no, tr('Waiting'), C.mute]].map(([n, l, c], i) => (
      <View key={i} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontFamily: F.display, fontSize: 24, color: c as string }}>{n as number}</Text><M>{l as string}</M></View>))}</View></Card>
    <Input label={tr('Guest name')} placeholder="Guest Name" value={name} onChangeText={setName} /><Input label={tr('WhatsApp number (optional)')} placeholder="10-digit mobile" value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} />
    <View style={{ flexDirection: 'row' }}><Chip label={tr('Bride side')} on={side === 'bride'} onPress={() => setSide('bride')} /><Chip label={tr('Groom side')} on={side === 'groom'} onPress={() => setSide('groom')} /></View><Btn icon="plus" title={tr('Add guest')} onPress={add} />
    {!list.length && <Empty icon="family" title={tr('No guests yet')} text={tr('Add guests with a WhatsApp number and send each one a personal RSVP link.')} />}
    {list.map((g, i) => (<Rise key={g.id} i={i}><Card><View style={s.row}><View style={{ flex: 1 }}><Text style={{ fontWeight: '600', color: C.ink }}>{g.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}><Tag tone={g.rsvp === 'yes' ? 'ok' : g.rsvp === 'no' ? 'warn' : 'mute'} label={g.rsvp === 'yes' ? tr('Coming') : g.rsvp === 'no' ? tr('Declined') : tr('Waiting')} />
        <M> {g.side === 'bride' ? tr('Bride side') : tr('Groom side')}{g.meal ? ' · ' + g.meal : ''}{g.plus_ones ? ` · +${g.plus_ones}` : ''}</M></View></View>
      {g.phone ? <Btn small kind="quiet" icon="send" title="WhatsApp" onPress={() => share(g)} /> : null}</View></Card></Rise>))}</ScrollView>);
}
