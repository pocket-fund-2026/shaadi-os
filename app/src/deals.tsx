// One place per couple-vendor relationship: the list ("My vendors" for couples, "Clients" for vendors) and
// a single screen that holds the quote, booking, instalments and chat, with the next step at the top.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from './api';
import { tr } from './i18n';
import { Bar, Btn, C, Card, Chip, Empty, F, Input, Loading, M, Rise, Tag, confirm, dateIN, err, inr, notify, s } from './ui';
import { CAT_ICON, Icon } from './icons';
import { categoryLabel } from './marketplace';

type Deal = any;
const STAGES = ['Enquiry', 'Quote', 'Booked', 'Paid', 'Done'];
const stageIndex = (stage: string) => ({ new: 0, quoted: 1, booked: 2, paying: 3, completed: 4, disputed: 3 } as Record<string, number>)[stage] ?? 0;
const STAGE_TAG: Record<string, { label: string; tone: 'ok' | 'gold' | 'warn' | 'mute' }> = {
  new: { label: 'Enquiry sent', tone: 'mute' }, quoted: { label: 'Quote received', tone: 'gold' }, booked: { label: 'Booked', tone: 'ok' },
  paying: { label: 'Paying', tone: 'ok' }, completed: { label: 'Completed', tone: 'ok' }, disputed: { label: 'In dispute', tone: 'warn' },
};
const VENDOR_TAG: Record<string, string> = { new: 'New enquiry', quoted: 'Quote sent' };

// The one thing that moves this relationship forward, for whoever is looking at it.
export function nextStep(d: Deal, vendor: boolean): { text: string; urgent: boolean } | null {
  const ms: any[] = d.booking?.milestones || [];
  const open = ms.find(m => m.status !== 'released');
  if (d.stage === 'disputed') return { text: tr('Dispute under review by support'), urgent: false };
  if (vendor) {
    if (d.stage === 'new') return { text: tr('Send a quote'), urgent: true };
    if (d.stage === 'quoted') return { text: tr('Waiting for the couple to accept'), urgent: false };
    if (open) return { text: open.status === 'pending' ? `${tr('Waiting for payment')}: ${open.label}` : `${tr('Paid into escrow, waiting for release')}: ${open.label}`, urgent: false };
    return null;
  }
  if (d.stage === 'new') return { text: tr('Waiting for the vendor’s quote'), urgent: false };
  if (d.stage === 'quoted') return { text: `${tr('Review the quote')} · ${inr(d.quote.total_paise)}`, urgent: true };
  if (open) return { text: open.status === 'pending' ? `${tr('Pay')} ${open.label} · ${inr(open.amount_paise)}` : `${tr('Release')} ${open.label} ${tr('after the work is done')}`, urgent: true };
  if (d.stage === 'completed' && d.booking && !d.booking.reviewed) return { text: tr('Leave a review'), urgent: true };
  return null;
};

const needsAction = (d: Deal, vendor: boolean) => !!nextStep(d, vendor)?.urgent;

export function DealsList({ navigation, vendor }: { navigation: any; vendor?: boolean }) {
  const [deals, setDeals] = useState<Deal[] | null>(null); const [busy, setBusy] = useState(false); const [filter, setFilter] = useState<'action' | 'booked' | 'all'>('all');
  const load = useCallback(async () => { setBusy(true); try { setDeals(await api('/deals')); } catch (e) { err(e); } finally { setBusy(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const list = deals || [];
  const counts = { action: list.filter(d => needsAction(d, !!vendor)).length, booked: list.filter(d => ['booked', 'paying', 'completed'].includes(d.stage)).length };
  const shown = list.filter(d => filter === 'all' || (filter === 'action' ? needsAction(d, !!vendor) : ['booked', 'paying', 'completed'].includes(d.stage)));
  return <FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32, width: '100%', maxWidth: 700, alignSelf: 'center' }} data={shown} keyExtractor={d => String(d.id)}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} />}
    ListHeaderComponent={list.length ? <View style={{ flexDirection: 'row', marginBottom: 8 }}>
      <Chip label={tr('All')} on={filter === 'all'} onPress={() => setFilter('all')} />
      <Chip label={`${tr('Needs action')}${counts.action ? ` · ${counts.action}` : ''}`} on={filter === 'action'} onPress={() => setFilter('action')} />
      <Chip label={`${tr('Booked')}${counts.booked ? ` · ${counts.booked}` : ''}`} on={filter === 'booked'} onPress={() => setFilter('booked')} />
    </View> : null}
    ListEmptyComponent={deals === null ? <Loading what={tr(vendor ? 'clients' : 'your vendors')} /> : list.length ? <M style={{ textAlign: 'center', marginTop: 24 }}>{tr('Nothing here right now.')}</M> : vendor
      ? <Empty icon="inbox" title={tr('No enquiries yet')} text={tr('Couples who enquire appear here, and stay here through quote, booking and payment. A complete storefront gets found more often.')} action={tr('Edit storefront')} onAction={() => navigation.navigate('Store')} />
      : <Empty icon="chat" title={tr('No vendors yet')} text={tr('Send an enquiry from any vendor’s page. Each vendor then lives here, from first message to final payment.')} action={tr('Find vendors')} onAction={() => navigation.navigate('Discover')} />}
    renderItem={({ item: d, index }) => { const step = nextStep(d, !!vendor); const tag = STAGE_TAG[d.stage];
      return <Rise i={index}><Card onPress={() => navigation.navigate('Chat', { id: d.id, title: d.other_name, vendor })} style={{ padding: 16, borderColor: step?.urgent ? C.primary : C.line }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
            {vendor ? <Text style={{ fontFamily: F.display, fontSize: 17, color: C.primary }}>{(d.other_name || '?')[0].toUpperCase()}</Text> : <Icon name={CAT_ICON[d.category] || 'store'} size={22} color={C.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.row}><Text style={{ flex: 1, color: C.ink, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>{d.other_name}</Text><Tag tone={tag.tone} label={tr(vendor && VENDOR_TAG[d.stage] ? VENDOR_TAG[d.stage] : tag.label)} /></View>
            <M>{vendor ? `${d.guests} ${tr('guests')}` : categoryLabel(d.category)} · {dateIN(d.event_date)}{d.booking ? ` · ${inr(d.booking.total_paise)}` : d.quote ? ` · ${inr(d.quote.total_paise)}` : ''}</M>
            {d.last_message ? <M style={{ marginTop: 4 }} numberOfLines={1}>{d.last_message.mine ? `${tr('You')}: ` : ''}{d.last_message.body}</M> : null}
            {step ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}><Text style={{ flex: 1, color: step.urgent ? C.primary : C.mute, fontSize: 13, fontWeight: step.urgent ? '600' : '400' }}>{step.text}</Text>{step.urgent ? <Icon name="chevron" size={16} color={C.primary} /> : null}</View> : null}
          </View>
        </View>
      </Card></Rise>; }} />;
}

// Progress across the five stages of a vendor relationship.
function StageTracker({ stage }: { stage: string }) {
  const at = stageIndex(stage);
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}>
    {STAGES.map((label, i) => <View key={label} style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= at ? C.primary : C.line }} />
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: i <= at ? C.primary : C.card, borderWidth: 2, borderColor: i <= at ? C.primary : C.line, alignItems: 'center', justifyContent: 'center' }}>{i < at || stage === 'completed' ? <Icon name="check" size={12} color="#fff" strokeWidth={2.4} /> : null}</View>
        <View style={{ flex: 1, height: 2, backgroundColor: i === STAGES.length - 1 ? 'transparent' : i < at ? C.primary : C.line }} />
      </View>
      <Text style={{ fontSize: 12, color: i === at ? C.primary : C.mute, fontWeight: i === at ? '600' : '400', marginTop: 4 }}>{tr(label)}</Text>
    </View>)}
  </View>;
}

const SPLIT = [['Token advance', 20], ['One week before event', 50], ['After event', 30]] as const;
// Several line items, with the instalment split shown before sending.
function QuoteBuilder({ enquiryId, onSent, onCancel }: { enquiryId: number; onSent: () => void; onCancel: () => void }) {
  const [items, setItems] = useState([{ label: '', amount: '' }]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const amount = (a: string) => Math.round(Number(a.replace(/,/g, '')) * 100);
  const valid = items.filter(i => i.label.trim() && amount(i.amount) > 0);
  const total = valid.reduce((sum, i) => sum + amount(i.amount), 0);
  const set = (k: number, key: 'label' | 'amount', v: string) => { setItems(items.map((it, j) => j === k ? { ...it, [key]: v } : it)); setError(''); };
  const send = async () => {
    if (!valid.length || valid.length !== items.filter(i => i.label.trim() || i.amount.trim()).length) return setError(tr('Give every item a name and an amount.'));
    setBusy(true);
    try { await api(`/enquiries/${enquiryId}/quotes`, 'POST', { items: valid.map(i => ({ label: i.label.trim(), amount_paise: amount(i.amount) })) }); onSent(); } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  return <Card style={{ borderColor: C.primary }}>
    <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: 12 }}>{tr('Your quote')}</Text>
    {items.map((it, k) => <View key={k} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <View style={{ flex: 2 }}><Input label={k === 0 ? tr('Item') : undefined} value={it.label} onChangeText={v => set(k, 'label', v)} placeholder={tr('e.g. Wedding day coverage')} accessibilityLabel={`${tr('Item')} ${k + 1}`} /></View>
      <View style={{ flex: 1 }}><Input label={k === 0 ? tr('Amount (₹)') : undefined} value={it.amount} onChangeText={v => set(k, 'amount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={`${tr('Amount')} ${k + 1}`} /></View>
      {items.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={tr('Remove item')} onPress={() => setItems(items.filter((_, j) => j !== k))} hitSlop={8} style={{ height: 52, justifyContent: 'center', marginBottom: 12 }}><Icon name="close" size={18} color={C.mute} /></Pressable> : null}
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => setItems([...items, { label: '', amount: '' }])} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40 }}><Icon name="plus" size={16} color={C.primary} /><Text style={{ color: C.primary, fontWeight: '500' }}>{tr('Add another item')}</Text></Pressable>
    <View style={[s.row, { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 8 }]}><Text style={{ color: C.ink, fontWeight: '500' }}>{tr('Total')}</Text><Text style={{ fontFamily: F.display, fontSize: 20, color: C.primary }}>{inr(total)}</Text></View>
    {total > 0 ? <View style={{ marginTop: 8 }}>{SPLIT.map(([l, pct]) => <View key={l} style={s.row}><M>{tr(l)} · {pct}%</M><M>{inr(Math.round(total * pct / 100))}</M></View>)}</View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: C.warn, marginTop: 8 }}>{error}</Text> : null}
    <Btn icon="send" title={busy ? tr('Sending…') : tr('Send quote')} disabled={busy} onPress={send} /><Btn kind="ghost" title={tr('Cancel')} onPress={onCancel} />
  </Card>;
}

// The whole relationship with one vendor (or one couple): next step, quote, booking and payments, then the conversation.
export function DealScreen({ route, navigation }: any) {
  const { id, vendor } = route.params;
  const [deal, setDeal] = useState<Deal | null>(null); const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState(''); const [quoting, setQuoting] = useState(false); const [rating, setRating] = useState(0); const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    try { const [all, d] = await Promise.all([api<Deal[]>('/deals'), api(`/enquiries/${id}`)]); setDeal(all.find(x => x.id === id) || null); setDetail(d); } catch (e) { err(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  if (!deal || !detail) return <Loading what={tr('this vendor')} />;
  const act = async (path: string, body?: any) => { if (working) return; setWorking(true); try { await api(path, 'POST', body); await load(); } catch (e) { err(e); } finally { setWorking(false); } };
  const send = async () => { if (!msg.trim()) return; try { await api(`/enquiries/${id}/messages`, 'POST', { body: msg.trim() }); setMsg(''); load(); } catch (e) { err(e); } };
  const accept = async (q: any) => { if (await confirm(tr('Accept this quote?'), `${inr(q.total_paise)} · ${tr('paid in instalments, each held until you release it')}`, tr('Accept & book'))) act(`/quotes/${q.id}/accept`); };
  const dispute = async () => { if (await confirm(tr('Raise a dispute?'), tr('Support will review this booking and any money still in escrow stays held until it is resolved.'), tr('Raise dispute'), true)) act(`/bookings/${deal.booking.id}/dispute`, { reason: 'Issue with service, needs review by support' }); };
  const invoice = () => api(`/bookings/${deal.booking.id}/invoice`).then((i: any) => notify(i.invoice_no, `${tr('Commission')} ${inr(i.commission_paise)} + GST ${inr(i.gst_paise)} = ${inr(i.total_paise)}\n${i.note}`)).catch(err);
  const quote = detail.quotes.find((q: any) => q.status === 'sent' || q.status === 'accepted');
  const ms: any[] = deal.booking?.milestones || [];
  const paid = ms.filter(m => m.status !== 'pending').reduce((a, m) => a + m.amount_paise, 0);
  const open = ms.find(m => m.status !== 'released');
  const step = nextStep(deal, !!vendor);
  const canReview = !vendor && deal.booking && !deal.booking.reviewed && ms.some(m => m.status !== 'pending');

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, width: '100%', maxWidth: 700, alignSelf: 'center' }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.primary} />}>
      <Card>
        <Text style={{ fontFamily: F.display, fontSize: 24, color: C.ink }}>{deal.other_name}</Text>
        <M>{vendor ? `${deal.guests} ${tr('guests')}` : categoryLabel(deal.category)} · {dateIN(deal.event_date)} · {tr('budget')} {inr(deal.budget_paise)}</M>
        {detail.enquiry.note ? <View style={{ marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: C.bg }}>
          <M style={{ fontSize: 12 }}>{vendor ? tr('Their enquiry') : tr('Your enquiry')}</M>
          <Text style={{ color: C.ink, fontSize: 15, lineHeight: 22, marginTop: 2 }}>{detail.enquiry.note}</Text>
        </View> : null}
        <StageTracker stage={deal.stage} />
      </Card>

      {step ? <Card style={{ backgroundColor: step.urgent ? C.tint : C.card, borderColor: step.urgent ? C.primary : C.line }}>
        <M>{tr('Next step')}</M>
        <Text style={{ color: C.ink, fontSize: 17, fontWeight: '500', marginTop: 2 }}>{step.text}</Text>
        {!vendor && deal.stage === 'quoted' && quote ? <Btn icon="shield" title={tr('Accept & book')} disabled={working} onPress={() => accept(quote)} /> : null}
        {!vendor && open && deal.stage !== 'disputed' ? (open.status === 'pending'
          ? <Btn title={`${tr('Pay (demo)')} ${inr(open.amount_paise)}`} disabled={working} onPress={() => act(`/milestones/${open.id}/pay`)} />
          : <Btn kind="ok" title={`${tr('Release')} ${inr(open.amount_paise)}`} disabled={working} onPress={() => act(`/milestones/${open.id}/release`)} />) : null}
        {vendor && deal.stage === 'new' && !quoting ? <Btn icon="receipt" title={tr('Send a quote')} onPress={() => setQuoting(true)} /> : null}
      </Card> : null}

      {quoting ? <QuoteBuilder enquiryId={id} onSent={() => { setQuoting(false); load(); }} onCancel={() => setQuoting(false)} /> : null}

      {quote ? <Card>
        <View style={s.row}><Text style={{ color: C.ink, fontWeight: '500' }}>{tr('Quote')} v{quote.version}</Text><Tag tone={quote.status === 'accepted' ? 'ok' : 'gold'} label={tr(quote.status === 'accepted' ? 'Accepted' : 'Waiting for you')} /></View>
        <Text style={{ fontFamily: F.display, fontSize: 24, color: C.primary, marginVertical: 4 }}>{inr(quote.total_paise)}</Text>
        {quote.items.map((i: any, k: number) => <View key={k} style={s.row}><M style={{ flex: 1 }}>{i.label}</M><M>{inr(i.amount_paise)}</M></View>)}
        {!deal.booking ? <M style={{ marginTop: 8 }}>{tr('Paid in instalments')}: {quote.milestones.map((m: any) => `${tr(m.label)} ${m.pct}%`).join(' · ')}</M> : null}
        {vendor && !deal.booking && !quoting ? <Btn small kind="quiet" title={tr('Send a revised quote')} onPress={() => setQuoting(true)} /> : null}
      </Card> : null}

      {deal.booking ? <Card>
        <View style={s.row}><Text style={{ color: C.ink, fontWeight: '500' }}>{tr('Payments')}</Text><M>{inr(paid)} {tr('of')} {inr(deal.booking.total_paise)}</M></View>
        <View style={{ marginVertical: 8 }}><Bar pct={deal.booking.total_paise ? paid / deal.booking.total_paise * 100 : 0} color={C.ok} /></View>
        {ms.map(m => <View key={m.id} style={[s.row, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }]}>
          <View style={{ flex: 1 }}><Text style={{ color: C.ink }}>{tr(m.label)}</Text><M>{inr(m.amount_paise)}</M></View>
          <Tag tone={m.status === 'released' ? 'ok' : m.status === 'held' ? 'gold' : 'mute'} label={tr(m.status === 'released' ? 'Released' : m.status === 'held' ? 'Held in escrow' : 'Due')} />
        </View>)}
        <M style={{ marginTop: 8 }}>{vendor ? `${tr('Platform fee')} ${deal.booking.commission_bps / 100}% · ${tr('paid by you when money is released')}` : tr('Each payment is held until you release it, so you only release money for work that is done.')}</M>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {vendor ? <Btn small kind="quiet" icon="receipt" title={tr('GST invoice')} onPress={invoice} /> : null}
          {deal.stage !== 'disputed' && deal.stage !== 'completed' ? <Btn small kind="quiet" icon="flag" title={tr('Raise dispute')} onPress={dispute} /> : null}
        </View>
      </Card> : null}

      {canReview ? <Card>
        <Text style={{ color: C.ink, fontWeight: '500' }}>{tr('Rate this vendor')}</Text>
        <View style={{ flexDirection: 'row', marginVertical: 8 }}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} stars`} accessibilityState={{ selected: n <= rating }} hitSlop={6} onPress={() => setRating(n)} style={{ padding: 4 }}><Icon name="star" size={28} color={n <= rating ? C.gold : C.line} /></Pressable>)}</View>
        <Btn small title={tr('Submit review')} disabled={!rating || working} onPress={() => act(`/bookings/${deal.booking.id}/review`, { rating, text: '' })} />
      </Card> : null}

      <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink, marginTop: 8, marginBottom: 8 }}>{tr('Messages')}</Text>
      {!detail.messages.length ? <M style={{ marginBottom: 12 }}>{vendor ? tr('Reply to start the conversation. Phone numbers stay hidden until the couple books.') : tr('Your enquiry was sent. The vendor usually replies here with questions or a quote.')}</M> : null}
      {detail.messages.map((m: any) => { const mine = vendor ? m.sender_id !== detail.enquiry.couple_id : m.sender_id === detail.enquiry.couple_id; return (
        <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginBottom: 8 }}>
          <View style={{ backgroundColor: mine ? C.primary : C.card, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, borderWidth: mine ? 0 : 1, borderColor: C.line }}>
            <Text style={{ color: mine ? '#fff' : C.ink, fontSize: 15, lineHeight: 20 }}>{m.body}</Text></View>
          <Text style={{ fontSize: 12, color: C.mute, marginTop: 2, alignSelf: mine ? 'flex-end' : 'flex-start' }}>{String(m.created_at).slice(11, 16)}</Text>
        </View>); })}
    </ScrollView>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
      <View style={{ flex: 1 }}><Input value={msg} onChangeText={setMsg} placeholder={tr('Message…')} onSubmitEditing={send} returnKeyType="send" style={{ marginBottom: -12 }} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Send')} onPress={send} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, marginLeft: 8, backgroundColor: msg.trim() ? C.primary : C.chipBg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Icon name="send" size={20} color={msg.trim() ? '#fff' : C.mute} /></Pressable>
    </View>
  </KeyboardAvoidingView>;
}
