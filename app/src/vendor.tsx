import { tr } from './i18n';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from './api';
import { Btn, Card, Chip, H, Input, M, C, F, inr, err, Empty, Rise, Tag, s } from './ui';
import { CAT_ICON } from './icons';
import { useLoad } from './couple';
import { CatalogEditor } from './catalog';

export function Payouts() {
  const [p, , busy] = useLoad<any>('/payouts', { released_paise: 0, in_escrow_paise: 0, rows: [] });
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
    <Rise><Card>
      <M>{tr('Released to you')}</M><Text style={{ fontFamily: F.display, fontSize: 30, color: C.ok, marginTop: 2 }}>{inr(p.released_paise)}</Text><M>{tr('After the platform fee')}</M>
      <View style={{ height: 1, backgroundColor: C.line, marginVertical: 12 }} />
      <View style={s.row}><View><M>{tr('Held in escrow')}</M><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, marginTop: 2 }}>{inr(p.in_escrow_paise)}</Text></View>
        <M style={{ maxWidth: '50%', textAlign: 'right' }}>{tr('Paid out as each couple releases a milestone')}</M></View></Card></Rise>
    <H style={{ fontSize: 18, marginTop: 12 }}>{tr('Payout history')}</H>
    {p.rows.length ? p.rows.map((r: any, i: number) => <Rise key={r.id} i={i}><Card><View style={s.row}>
      <View><Text style={{ fontWeight: '600', color: C.ok, fontSize: 15 }}>+{inr(r.amount_paise)}</Text><M>{tr('Booking')} #{r.booking_id}</M></View><M>{String(r.created_at).slice(0, 10)}</M></View></Card></Rise>)
      : busy ? null : <Empty icon="wallet" title={tr('No payouts yet')} text={tr('When a couple releases a milestone, the amount minus the platform fee lands here.')} />}</ScrollView>);
}

const CATS = ['photographer', 'makeup', 'mehndi', 'decor', 'venue', 'caterer', 'dj', 'pandit'];
const CAT_LABEL: Record<string, string> = { photographer: 'Photography', makeup: 'Makeup', mehndi: 'Mehndi', decor: 'Decor', venue: 'Venue', caterer: 'Catering', dj: 'DJ & music', pandit: 'Pandit' };
export function VendorProfile({ onSaved }: any) {
  const [me] = useLoad<any>('/me', null); const [f, setF] = useState({ name: '', category: 'photographer', city: '', locality: '', price: '', description: '' }); const [saved, setSaved] = useState(false);
  useEffect(() => { const v = me?.vendor; if (v) setF({ name: v.name, category: v.category, city: v.city, locality: v.locality || '', price: String(v.start_paise / 100), description: v.description || '' }); }, [me]);
  const set = (k: string, v: string) => { setSaved(false); setF({ ...f, [k]: v }); };
  const save = async () => { try { await api('/vendor', 'PUT', { name: f.name, category: f.category, city: f.city, locality: f.locality, start_paise: Math.round(+f.price * 100), description: f.description }); setSaved(true); onSaved?.(); } catch (e) { err(e); } };
  const fee = ['venue', 'caterer'].includes(f.category) ? 3 : 6;
  return (<ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <M style={{ marginBottom: 12 }}>{tr('Listing is free. You pay')} {fee}% {tr('only when a couple books and pays through the app.')}</M>
    <Input label={tr('Business name')} value={f.name} onChangeText={v => set('name', v)} placeholder="Business Name" />
    <Text style={s.label}>{tr('Category')}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{CATS.map(c => <Chip key={c} icon={CAT_ICON[c]} label={tr(CAT_LABEL[c])} on={f.category === c} onPress={() => set('category', c)} />)}</View>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Input label={tr('City')} value={f.city} onChangeText={v => set('city', v)} placeholder="City" /></View>
      <View style={{ flex: 1 }}><Input label={tr('Locality')} value={f.locality} onChangeText={v => set('locality', v)} placeholder="Area" /></View></View>
    <Input label={tr('Starting price (₹), shown publicly')} value={f.price} onChangeText={v => set('price', v)} keyboardType="number-pad" />
    <Input label={tr('About')} value={f.description} onChangeText={v => set('description', v)} multiline placeholder={tr('What you offer, your style, what is included')} style={{ minHeight: 96, textAlignVertical: 'top' }} />
    <Btn title={tr('Save storefront')} onPress={save} />
    {saved && <Rise style={{ alignItems: 'center', marginTop: 6 }}><Tag tone="ok" icon="check" label={tr('Saved. Couples see this now.')} /></Rise>}
    {(me?.vendor || saved) ? <CatalogEditor /> : <M style={{ marginTop: 20 }}>{tr('Save your storefront to add portfolio photos and packages.')}</M>}</ScrollView>);
}
