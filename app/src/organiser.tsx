import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from './api';
import { tr } from './i18n';
import { Btn, C, Card, Check, Chip, Empty, F, Input, M, Rise, Tag, confirm, dateIN, err, inr, s } from './ui';
import { Icon } from './icons';
import { useLoad } from './couple';
import { categoryLabel } from './marketplace';

const rupees = (v: string) => { const n = Number(String(v).replace(/,/g, '')); return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; };
const remove = async (path: string, label: string, reload: () => void) => { if (await confirm(tr('Remove this?'), label, tr('Remove'), true)) { try { await api(path, 'DELETE'); reload(); } catch (e) { err(e); } } };

// What needs attention now, at the top of the plan. Each row opens the section that fixes it.
export function RemindersCard({ open }: { open: (tab: string) => void }) {
  const [d] = useLoad<any>('/reminders', null);
  if (!d?.items?.length) return null;
  const nav = useNavigation<any>();
  const text = (i: any) => i.kind === 'instalment' ? `${i.title} · ${inr(i.amount_paise)} · ${tr(i.overdue ? 'overdue since' : 'due')} ${dateIN(i.date)}` : i.kind === 'task' ? `${i.title} · ${tr(i.detail === 'overdue' ? 'overdue since' : 'due')} ${dateIN(i.date)}`
    : i.kind === 'payment' ? `${i.count} ${tr(i.count === 1 ? 'payment still due' : 'payments still due')} · ${inr(i.amount_paise)}`
    : i.kind === 'pickup' ? `${i.count} ${tr(i.count === 1 ? 'pickup this week' : 'pickups this week')} · ${tr('from')} ${dateIN(i.date)}`
    : `${i.count} ${tr(i.count === 1 ? 'guest yet to reply' : 'guests yet to reply')}`;
  return <Card>
    <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink, marginBottom: 4 }}>{tr('Reminders')}</Text>
    {d.items.map((i: any, k: number) => <Pressable key={k} accessibilityRole="button" onPress={() => i.open === 'vendors' ? nav.navigate('Vendors') : open(i.open)} style={[s.row, { paddingVertical: 10, borderTopWidth: k ? 1 : 0, borderTopColor: C.line, gap: 8 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.tone === 'warn' ? C.warn : C.gold }} />
      <Text style={{ flex: 1, color: i.tone === 'warn' ? C.warn : C.ink, fontSize: 15 }}>{text(i)}</Text>
      <Icon name="chevron" size={16} color={C.faint} />
    </Pressable>)}
  </Card>;
}

const KINDS: [string, string][] = [['outfit', 'Outfit'], ['jewellery', 'Jewellery'], ['gift', 'Gift for family'], ['other', 'Other']];
// Shopping and trousseau: outfits, jewellery and lena-dena gifts, who is buying, and budget against spend.
export function Shopping() {
  const [list, load, busy] = useLoad<any[]>('/shopping', []);
  const blank = { item: '', kind: 'outfit', for_whom: '', buyer: '', budget: '', spent: '' };
  const [f, setF] = useState(blank); const [saving, setSaving] = useState(false); const [filter, setFilter] = useState('all');
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const body = (x: any, over: any = {}) => ({ item: x.item, kind: x.kind, for_whom: x.for_whom, buyer: x.buyer, budget_paise: x.budget_paise ?? null, spent_paise: x.spent_paise ?? null, bought: !!x.bought, ...over });
  const add = async () => {
    if (!f.item.trim()) return err(new Error(tr('Enter what to buy.')));
    setSaving(true);
    try { await api('/shopping', 'POST', { item: f.item.trim(), kind: f.kind, for_whom: f.for_whom.trim(), buyer: f.buyer.trim(), budget_paise: rupees(f.budget), spent_paise: rupees(f.spent) }); setF(blank); await load(); } catch (e) { err(e); } finally { setSaving(false); }
  };
  const toggle = async (x: any) => { try { await api(`/shopping/${x.id}`, 'PUT', body(x, { bought: !x.bought })); load(); } catch (e) { err(e); } };
  const budget = list.reduce((a, x) => a + (x.budget_paise || 0), 0); const spent = list.reduce((a, x) => a + (x.spent_paise || 0), 0);
  const shown = list.filter(x => filter === 'all' || (filter === 'todo' ? !x.bought : x.kind === filter));
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card><View style={{ flexDirection: 'row' }}>{[[`${list.filter(x => x.bought).length}/${list.length}`, tr('Bought')], [inr(spent), tr('Spent')], [inr(budget), tr('Planned')]].map(([v, l], i) =>
      <View key={i} style={{ flex: 1 }}><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, fontVariant: ['tabular-nums'] }}>{v}</Text><M>{l}</M></View>)}</View></Card>
    <Card>
      <Input label={tr('Item')} value={f.item} onChangeText={v => set('item', v)} placeholder={tr('e.g. Sangeet lehenga')} maxLength={160} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{KINDS.map(([k, n]) => <Chip key={k} label={tr(n)} on={f.kind === k} onPress={() => set('kind', k)} />)}</ScrollView>
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label={tr('For')} value={f.for_whom} onChangeText={v => set('for_whom', v)} placeholder={tr('Bride, Mama ji…')} /></View>
        <View style={{ flex: 1 }}><Input label={tr('Who is buying')} value={f.buyer} onChangeText={v => set('buyer', v)} /></View></View>
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label={tr('Budget (₹)')} value={f.budget} onChangeText={v => set('budget', v)} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Input label={tr('Spent (₹)')} value={f.spent} onChangeText={v => set('spent', v)} keyboardType="decimal-pad" /></View></View>
      <Btn icon="plus" title={tr('Add to list')} disabled={saving} onPress={add} />
    </Card>
    {list.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{[['all', 'All'], ['todo', 'To buy'], ...KINDS].map(([k, n]) => <Chip key={k} label={tr(n)} on={filter === k} onPress={() => setFilter(k)} />)}</ScrollView> : null}
    {!list.length && !busy ? <Empty icon="receipt" title={tr('Nothing on the list yet')} text={tr('Add outfits, jewellery and gifts for family, with who is buying each one.')} /> : null}
    {shown.map((x, i) => <Rise key={x.id} i={i}><Card style={{ paddingVertical: 16 }}><View style={s.row}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`${tr('Bought')}: ${x.item}`} accessibilityState={{ checked: !!x.bought }} onPress={() => toggle(x)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Check on={!!x.bought} />
        <View style={{ flex: 1 }}><Text style={{ color: x.bought ? C.mute : C.ink, fontSize: 15, fontWeight: '500', textDecorationLine: x.bought ? 'line-through' : 'none' }}>{x.item}</Text>
          <M>{[tr(KINDS.find(k => k[0] === x.kind)?.[1] || 'Other'), x.for_whom && `${tr('for')} ${x.for_whom}`, x.buyer && `${tr('by')} ${x.buyer}`].filter(Boolean).join(' · ')}</M>
          {x.budget_paise || x.spent_paise ? <M>{x.spent_paise ? `${tr('Spent')} ${inr(x.spent_paise)}` : ''}{x.spent_paise && x.budget_paise ? ' · ' : ''}{x.budget_paise ? `${tr('Budget')} ${inr(x.budget_paise)}` : ''}</M> : null}</View>
      </Pressable>
      <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/shopping/${x.id}`, x.item, load)} />
    </View></Card></Rise>)}
  </ScrollView>;
}

// One list for the day: booked vendors (their numbers unlock after booking), people paid outside the app, and anyone added.
export function DayContacts() {
  const [d, load, busy] = useLoad<any>('/day-contacts', { contacts: [], booked: [], outside: [] });
  const blank = { name: '', role: '', phone: '', arrival: '' }; const [f, setF] = useState(blank); const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!f.name.trim()) return err(new Error(tr('Enter a name.')));
    if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) return err(new Error(tr('Enter a 10-digit mobile number, or leave it empty.')));
    setSaving(true);
    try { await api('/day-contacts', 'POST', { ...f, name: f.name.trim() }); setF(blank); await load(); } catch (e) { err(e); } finally { setSaving(false); }
  };
  const row = (c: any, key: string, removable?: boolean) => <Card key={key} style={{ paddingVertical: 16 }}><View style={s.row}>
    <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{c.name}</Text>
      <M>{[c.source ? categoryLabel(c.role) : c.role, c.arrival && `${tr('arrives')} ${c.arrival}`].filter(Boolean).join(' · ')}</M>
      {c.source ? <M style={{ fontSize: 12 }}>{tr(c.source === 'booking' ? 'Booked on Shaadi OS' : 'Paid outside the app')}</M> : null}</View>
    {c.phone ? <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${tr('Call')} ${c.name}`} onPress={() => Linking.openURL('tel:+91' + c.phone).catch(err)} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={20} color={C.primary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`WhatsApp ${c.name}`} onPress={() => Linking.openURL('https://wa.me/91' + c.phone).catch(err)} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={20} color={C.primary} /></Pressable>
    </View> : null}
    {removable ? <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/day-contacts/${c.id}`, c.name, load)} /> : null}
  </View></Card>;
  const empty = !d.contacts.length && !d.booked.length && !d.outside.length;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <M style={{ marginBottom: 12 }}>{tr('Everyone you may need to call on the day. Booked vendors appear here on their own.')}</M>
    {d.booked.map((c: any, i: number) => row(c, 'b' + i))}
    {d.outside.map((c: any, i: number) => row(c, 'o' + i))}
    {d.contacts.map((c: any) => row(c, 'c' + c.id, true))}
    {empty && !busy ? <Empty icon="family" title={tr('No contacts yet')} text={tr('Add the decorator’s supervisor, the driver, the venue manager and anyone else you may need to call.')} /> : null}
    <Card>
      <Input label={tr('Name')} value={f.name} onChangeText={v => setF({ ...f, name: v })} maxLength={120} />
      <Input label={tr('Role')} value={f.role} onChangeText={v => setF({ ...f, role: v })} placeholder={tr('e.g. Driver, venue manager')} maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Input label={tr('Mobile')} value={f.phone} onChangeText={v => setF({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) })} keyboardType="number-pad" placeholder="10-digit mobile" /></View>
        <View style={{ flex: 1 }}><Input label={tr('Arrives')} value={f.arrival} onChangeText={v => setF({ ...f, arrival: v })} placeholder="4:00 pm" maxLength={80} /></View></View>
      <Btn icon="plus" title={tr('Add contact')} disabled={saving} onPress={add} />
    </Card>
  </ScrollView>;
}

// Marriage registration papers, pre-filled with the usual list; requirements differ by state.
export function Documents() {
  const [docs, load, busy] = useLoad<any[]>('/documents', []); const [title, setTitle] = useState('');
  const toggle = async (x: any) => { try { await api(`/documents/${x.id}`, 'PATCH', { done: !x.done }); load(); } catch (e) { err(e); } };
  const add = async () => { if (!title.trim()) return; try { await api('/documents', 'POST', { title: title.trim() }); setTitle(''); load(); } catch (e) { err(e); } };
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{tr('Marriage registration')}</Text>
      <M style={{ marginTop: 4 }}>{tr('The usual papers are listed below. Requirements differ by state, so confirm the list with your Sub-Registrar office before your appointment.')}</M>
      <M style={{ marginTop: 8, color: C.ink, fontVariant: ['tabular-nums'] }}>{docs.filter(d => d.done).length} {tr('of')} {docs.length} {tr('ready')}</M></Card>
    {busy && !docs.length ? null : docs.map(x => <Pressable key={x.id} accessibilityRole="checkbox" accessibilityState={{ checked: !!x.done }} onPress={() => toggle(x)}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Check on={!!x.done} /><Text style={{ flex: 1, color: x.done ? C.mute : C.ink, fontSize: 15 }}>{x.title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${tr('Remove')} ${x.title}`} onPress={() => remove(`/documents/${x.id}`, x.title, load)} hitSlop={12}><Text style={{ color: C.mute, fontSize: 13 }}>{tr('Remove')}</Text></Pressable>
    </Pressable>)}
    <View style={{ marginTop: 16 }}><Input label={tr('Add a document')} value={title} onChangeText={setTitle} placeholder={tr('e.g. Guest ID copies for the hotel')} maxLength={200} onSubmitEditing={add} returnKeyType="done" />
      <Btn kind="quiet" icon="plus" title={tr('Add')} disabled={!title.trim()} onPress={add} /></View>
  </ScrollView>;
}

// Seating per ceremony: tables with a seat count, guests assigned to one table each.
export function Seating() {
  const [events] = useLoad<any[]>('/events', []); const [guests] = useLoad<any[]>('/guests', []); const [d, load] = useLoad<any>('/seating', { tables: [], seats: [] });
  const [eventId, setEventId] = useState<number | null>(null); const [name, setName] = useState(''); const [seats, setSeats] = useState('8'); const [pickFor, setPickFor] = useState<number | null>(null);
  const current = eventId ?? events[0]?.id ?? null;
  const tables = d.tables.filter((t: any) => t.event_id === current);
  const seatedHere = (tableId: number) => d.seats.filter((x: any) => x.table_id === tableId).map((x: any) => guests.find(g => g.id === x.guest_id)).filter(Boolean);
  const seatedIds = new Set(d.seats.filter((x: any) => tables.some((t: any) => t.id === x.table_id)).map((x: any) => x.guest_id));
  const unseated = guests.filter(g => !seatedIds.has(g.id));
  const addTable = async () => { const n = Number(seats); if (!name.trim() || !(n >= 1 && n <= 50)) return err(new Error(tr('Enter a table name and 1 to 50 seats.')));
    try { await api('/seating/tables', 'POST', { event_id: current, name: name.trim(), seats: n }); setName(''); load(); } catch (e) { err(e); } };
  const seat = async (tableId: number, guestId: number, seated: boolean) => { try { await api(`/seating/tables/${tableId}/guests/${guestId}`, 'PUT', { seated }); load(); } catch (e) { err(e); } };
  if (!events.length) return <Empty icon="calendar" title={tr('Add your ceremonies first')} text={tr('Seating is planned per ceremony. Add them under More, then Events.')} />;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{events.map(e => <Chip key={e.id} label={e.name} on={current === e.id} onPress={() => { setEventId(e.id); setPickFor(null); }} />)}</ScrollView>
    <M style={{ marginBottom: 12 }}>{guests.length - unseated.length} {tr('of')} {guests.length} {tr('guests seated')}</M>
    {tables.map((t: any) => { const here = seatedHere(t.id); const over = here.length > t.seats; return <Card key={t.id}>
      <View style={s.row}><Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink, flex: 1 }}>{t.name}</Text>
        <Tag tone={over ? 'warn' : here.length === t.seats ? 'ok' : 'mute'} label={`${here.length}/${t.seats}${over ? ' · ' + tr('over') : ''}`} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{here.map((g: any) => <Chip key={g.id} icon="close" label={g.name} onPress={() => seat(t.id, g.id, false)} />)}</View>
      {pickFor === t.id ? <View style={{ marginTop: 4 }}><M style={{ marginBottom: 4 }}>{tr('Tap a guest to seat them here')}</M>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{unseated.length ? unseated.map(g => <Chip key={g.id} icon="plus" label={g.name} onPress={() => seat(t.id, g.id, true)} />) : <M>{tr('Everyone is seated.')}</M>}</View>
        <Btn small kind="quiet" title={tr('Done')} onPress={() => setPickFor(null)} /></View>
        : <View style={{ flexDirection: 'row', gap: 8 }}><Btn small kind="quiet" icon="plus" title={tr('Seat guests')} onPress={() => setPickFor(t.id)} /><Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/seating/tables/${t.id}`, t.name, load)} /></View>}
    </Card>; })}
    <Card>
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 2 }}><Input label={tr('Table name')} value={name} onChangeText={setName} placeholder={tr('e.g. Family table 1')} maxLength={60} /></View>
        <View style={{ flex: 1 }}><Input label={tr('Seats')} value={seats} onChangeText={v => setSeats(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" /></View></View>
      <Btn icon="plus" title={tr('Add table')} onPress={addTable} />
    </Card>
  </ScrollView>;
}
