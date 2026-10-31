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

// Accepts how people write times ("6:30 pm", "6.30pm", "18:30") and stores 24-hour HH:MM.
export const parseTime = (text: string) => {
  const m = text.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/); if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0); if (min > 59 || h > 23 || (m[3] && (h < 1 || h > 12))) return null;
  if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};
const showTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

// Wedding-day run sheet: what happens when at each ceremony and who is in charge.
export function RunSheet() {
  const [events] = useLoad<any[]>('/events', []); const [items, load, busy] = useLoad<any[]>('/run-sheet', []);
  const [eventId, setEventId] = useState<number | null>(null); const [time, setTime] = useState(''); const [title, setTitle] = useState(''); const [owner, setOwner] = useState(''); const [saving, setSaving] = useState(false);
  const current = eventId ?? events[0]?.id ?? null; const event = events.find(e => e.id === current);
  const rows = items.filter(x => x.event_id === current);
  const add = async () => {
    const t = parseTime(time); if (!t) return err(new Error(tr('Enter a time such as 6:30 pm.')));
    if (!title.trim()) return err(new Error(tr('Enter what happens at that time.')));
    setSaving(true);
    try { await api('/run-sheet', 'POST', { event_id: current, time: t, title: title.trim(), owner: owner.trim() }); setTime(''); setTitle(''); setOwner(''); await load(); } catch (e) { err(e); } finally { setSaving(false); }
  };
  const remove = async (x: any) => { if (await confirm(tr('Remove this item?'), `${showTime(x.time)} · ${x.title}`, tr('Remove'), true)) { try { await api(`/run-sheet/${x.id}`, 'DELETE'); load(); } catch (e) { err(e); } } };
  const share = () => Share.share({ message: `${event?.name}${event?.date ? ` · ${dateIN(event.date)}` : ''}\n` + rows.map(x => `${showTime(x.time)}  ${x.title}${x.owner ? ` (${x.owner})` : ''}`).join('\n') }).catch(() => {});
  if (!events.length) return busy ? null : <Empty icon="calendar" title={tr('Add your ceremonies first')} text={tr('Each ceremony gets its own run sheet. Add them under More, then Events.')} />;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{events.map(e => <Chip key={e.id} label={e.name} on={current === e.id} onPress={() => setEventId(e.id)} />)}</ScrollView>
    <Card>
      <View style={s.row}><View style={{ flex: 1 }}><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{event?.name}</Text><M>{event?.date ? dateIN(event.date) : tr('Date not set')}{event?.venue ? ` · ${event.venue}` : ''}</M></View>
        {rows.length ? <Btn small kind="quiet" icon="share" title={tr('Share')} onPress={share} /> : null}</View>
      {rows.length ? rows.map((x, i) => <View key={x.id} style={[s.row, { paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, gap: 12, marginTop: i ? 0 : 12 }]}>
        <Text style={{ width: 72, color: C.primary, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{showTime(x.time)}</Text>
        <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15 }}>{x.title}</Text>{x.owner ? <M>{x.owner}</M> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${tr('Remove')} ${x.title}`} onPress={() => remove(x)} hitSlop={12} style={{ padding: 4 }}><Text style={{ color: C.mute, fontSize: 13 }}>{tr('Remove')}</Text></Pressable>
      </View>) : <M style={{ marginTop: 12 }}>{tr('Nothing scheduled yet. Add the first item below.')}</M>}
    </Card>
    <Card>
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ width: 120 }}><Input label={tr('Time')} value={time} onChangeText={setTime} placeholder="6:30 pm" autoCapitalize="none" /></View>
        <View style={{ flex: 1 }}><Input label={tr('In charge')} value={owner} onChangeText={setOwner} placeholder={tr('Name')} maxLength={80} /></View></View>
      <Input label={tr('What happens')} value={title} onChangeText={setTitle} placeholder={tr('e.g. Baraat arrives at the gate')} maxLength={160} />
      <Btn icon="plus" title={tr('Add to run sheet')} disabled={saving} onPress={add} />
    </Card>
  </ScrollView>;
}
