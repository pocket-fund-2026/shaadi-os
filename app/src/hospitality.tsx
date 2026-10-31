import React, { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { api } from './api';
import { tr } from './i18n';
import { Btn, C, Card, Check, Chip, DateField, Empty, F, Input, M, Rise, Tag, confirm, dateIN, err, inr, s } from './ui';
import { useLoad } from './couple';

const rupeesToPaise = (value: string) => { const n = Number(value.replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };

// Shagun and gift register: who gave what, at which ceremony, and whether a thank-you has gone out.
export function Gifts() {
  const [list, load, busy] = useLoad<any[] | null>('/gifts', null); const [events] = useLoad<any[]>('/events', []);
  const [giver, setGiver] = useState(''); const [kind, setKind] = useState<'cash' | 'gift'>('cash'); const [amount, setAmount] = useState(''); const [what, setWhat] = useState('');
  const [eventId, setEventId] = useState<number | null>(null); const [pendingOnly, setPendingOnly] = useState(false); const [saving, setSaving] = useState(false);
  if (list === null) return busy ? null : <Empty icon="lock" title={tr('Gifts are private')} text={tr('Only the couple and family members who can see the budget can see gifts.')} />;
  const add = async () => {
    if (!giver.trim()) return err(new Error(tr('Enter who gave it.')));
    if (kind === 'cash' && !rupeesToPaise(amount)) return err(new Error(tr('Enter the amount.')));
    setSaving(true);
    try { await api('/gifts', 'POST', { giver: giver.trim(), kind, event_id: eventId, amount_paise: kind === 'cash' ? rupeesToPaise(amount) : null, description: kind === 'gift' ? what.trim() : '' }); setGiver(''); setAmount(''); setWhat(''); await load(); }
    catch (e) { err(e); } finally { setSaving(false); }
  };
  const thank = async (g: any) => { try { await api(`/gifts/${g.id}`, 'PATCH', { thanked: !g.thanked }); load(); } catch (e) { err(e); } };
  const remove = async (g: any) => { if (await confirm(tr('Remove this entry?'), g.giver, tr('Remove'), true)) { try { await api(`/gifts/${g.id}`, 'DELETE'); load(); } catch (e) { err(e); } } };
  const cash = list.filter(g => g.kind === 'cash').reduce((sum, g) => sum + (g.amount_paise || 0), 0);
  const thanked = list.filter(g => g.thanked).length;
  const shown = pendingOnly ? list.filter(g => !g.thanked) : list;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card><View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 1 }}><M>{tr('Shagun received')}</M><Text style={{ fontFamily: F.display, fontSize: 24, color: C.ink, fontVariant: ['tabular-nums'] }}>{inr(cash)}</Text></View>
      <View style={{ flex: 1 }}><M>{tr('Thank-you notes')}</M><Text style={{ fontFamily: F.display, fontSize: 24, color: C.ink, fontVariant: ['tabular-nums'] }}>{thanked}/{list.length}</Text></View>
    </View></Card>
    <Card>
      <Input label={tr('From')} value={giver} onChangeText={setGiver} placeholder={tr('Name or family')} maxLength={120} />
      <View style={{ flexDirection: 'row' }}><Chip icon="rupee" label={tr('Cash')} on={kind === 'cash'} onPress={() => setKind('cash')} /><Chip icon="receipt" label={tr('Gift')} on={kind === 'gift'} onPress={() => setKind('gift')} /></View>
      {kind === 'cash'
        ? <Input label={tr('Amount (₹)')} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="11000" />
        : <Input label={tr('What they gave')} value={what} onChangeText={setWhat} placeholder={tr('e.g. silver dinner set')} maxLength={300} />}
      {events.length ? <><M style={{ marginBottom: 8 }}>{tr('Ceremony (optional)')}</M>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{events.map(e => <Chip key={e.id} label={e.name} on={eventId === e.id} onPress={() => setEventId(eventId === e.id ? null : e.id)} />)}</ScrollView></> : null}
      <Btn icon="plus" title={tr('Add to register')} disabled={saving} onPress={add} />
    </Card>
    {list.length ? <View style={{ flexDirection: 'row', marginBottom: 8 }}><Chip label={tr('All')} on={!pendingOnly} onPress={() => setPendingOnly(false)} /><Chip label={tr('Thank-you pending')} on={pendingOnly} onPress={() => setPendingOnly(true)} /></View> : null}
    {!list.length && !busy ? <Empty icon="receipt" title={tr('No gifts recorded yet')} text={tr('Note each shagun envelope or gift as it arrives, so thank-you notes are easy later.')} /> : null}
    {shown.map((g, i) => <Rise key={g.id} i={i}><Card style={{ paddingVertical: 16 }}>
      <View style={s.row}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`${tr('Thank-you sent to')} ${g.giver}`} accessibilityState={{ checked: !!g.thanked }} onPress={() => thank(g)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Check on={!!g.thanked} />
          <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{g.giver}</Text>
            <M>{g.kind === 'cash' ? inr(g.amount_paise) : g.description || tr('Gift')}{g.event_name ? ` · ${g.event_name}` : ''}</M></View>
        </Pressable>
        <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(g)} />
      </View>
    </Card></Rise>)}
  </ScrollView>;
}

// Outstation guests: hotel, room, dates, arrival and pickups, with a list to forward to whoever is driving.
export function Stays() {
  const [list, load, busy] = useLoad<any[]>('/stays', []);
  const blank = { guest_name: '', people: '1', hotel: '', room: '', check_in: '', check_out: '', arrival: '', pickup: false };
  const [f, setF] = useState(blank); const [saving, setSaving] = useState(false); const [adding, setAdding] = useState(false);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const add = async () => {
    if (!f.guest_name.trim()) return err(new Error(tr('Enter the guest or family name.')));
    setSaving(true);
    try { await api('/stays', 'POST', { ...f, guest_name: f.guest_name.trim(), people: Math.max(1, Number(f.people) || 1), check_in: f.check_in || null, check_out: f.check_out || null }); setF(blank); setAdding(false); await load(); }
    catch (e) { err(e); } finally { setSaving(false); }
  };
  const remove = async (x: any) => { if (await confirm(tr('Remove this stay?'), x.guest_name, tr('Remove'), true)) { try { await api(`/stays/${x.id}`, 'DELETE'); load(); } catch (e) { err(e); } } };
  const people = list.reduce((sum, x) => sum + (x.people || 0), 0);
  const rooms = list.filter(x => x.room).length; const pickups = list.filter(x => x.pickup);
  const sharePickups = () => Share.share({ message: pickups.map(x => `${x.guest_name} (${x.people}) · ${x.arrival || tr('arrival time not set')}${x.hotel ? ` → ${x.hotel}` : ''}`).join('\n') }).catch(() => {});
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card><View style={{ flexDirection: 'row' }}>{[[people, tr('Staying')], [rooms, tr('Rooms')], [pickups.length, tr('Pickups')]].map(([n, l], i) =>
      <View key={i} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontFamily: F.display, fontSize: 24, color: C.ink, fontVariant: ['tabular-nums'] }}>{n as number}</Text><M>{l as string}</M></View>)}</View>
      {pickups.length ? <Btn small kind="quiet" icon="share" title={tr('Share pickup list')} onPress={sharePickups} /> : null}
    </Card>
    {adding ? <Card>
      <Input label={tr('Guest or family')} value={f.guest_name} onChangeText={v => set('guest_name', v)} placeholder={tr('e.g. Sharma family from Delhi')} maxLength={120} />
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label={tr('People')} value={f.people} onChangeText={v => set('people', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} /></View>
        <View style={{ flex: 1 }}><Input label={tr('Room')} value={f.room} onChangeText={v => set('room', v)} maxLength={40} /></View></View>
      <Input label={tr('Hotel or host')} value={f.hotel} onChangeText={v => set('hotel', v)} maxLength={120} />
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><DateField label={tr('Check-in')} value={f.check_in} onChange={v => set('check_in', v)} optional /></View>
        <View style={{ flex: 1 }}><DateField label={tr('Check-out')} value={f.check_out} onChange={v => set('check_out', v)} min={f.check_in || undefined} optional /></View></View>
      <Input label={tr('Arrival')} value={f.arrival} onChangeText={v => set('arrival', v)} placeholder={tr('Train or flight and time')} maxLength={160} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: f.pickup }} onPress={() => set('pickup', !f.pickup)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}><Check on={f.pickup} /><Text style={{ color: C.ink, fontSize: 15 }}>{tr('Needs a pickup')}</Text></Pressable>
      <Btn icon="plus" title={tr('Add stay')} disabled={saving} onPress={add} /><Btn kind="ghost" title={tr('Cancel')} onPress={() => { setAdding(false); setF(blank); }} />
    </Card> : <Btn icon="plus" title={tr('Add a guest stay')} onPress={() => setAdding(true)} />}
    {!list.length && !busy && !adding ? <Empty icon="family" title={tr('No stays planned yet')} text={tr('Add relatives coming from out of town with their hotel, dates and arrival, so pickups and rooms are sorted before the wedding.')} /> : null}
    {list.map((x, i) => <Rise key={x.id} i={i}><Card>
      <View style={s.row}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500', flex: 1 }}>{x.guest_name} · {x.people}</Text>{x.pickup ? <Tag tone="gold" label={tr('Needs pickup')} /> : null}</View>
      {x.hotel || x.room ? <M style={{ marginTop: 4 }}>{[x.hotel, x.room ? `${tr('Room')} ${x.room}` : ''].filter(Boolean).join(' · ')}</M> : null}
      {x.check_in ? <M>{dateIN(x.check_in)}{x.check_out ? ` – ${dateIN(x.check_out)}` : ''}</M> : null}
      {x.arrival ? <M>{tr('Arrival')}: {x.arrival}</M> : null}
      <View style={{ flexDirection: 'row', marginTop: 8 }}><Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(x)} /></View>
    </Card></Rise>)}
  </ScrollView>;
}
