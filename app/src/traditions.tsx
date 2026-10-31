import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getBase } from './api';
import { tr } from './i18n';
import { Btn, C, Card, Check, Chip, ContactButtons, DateField, Empty, F, Input, M, Rise, Tag, confirm, dateIN, err, inr, s, todayISO } from './ui';
import { Icon } from './icons';
import { useLoad } from './couple';

const rupees = (v: string) => { const n = Number(String(v).replace(/,/g, '')); return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; };
const remove = async (path: string, label: string, reload: () => void) => { if (await confirm(tr('Remove this?'), label, tr('Remove'), true)) { try { await api(path, 'DELETE'); reload(); } catch (e) { err(e); } } };
const Row = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', gap: 12 }}>{React.Children.map(children, c => <View style={{ flex: 1 }}>{c}</View>)}</View>;
const Label = ({ children }: { children: string }) => <Text style={s.label}>{children}</Text>;
const Chips = ({ options, value, onChange }: { options: [string, string][]; value: any; onChange: (v: any) => void }) =>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{options.map(([k, n]) => <Chip key={k} label={tr(n)} on={String(value) === k} onPress={() => onChange(k)} />)}</ScrollView>;
const Stats = ({ items }: { items: [string | number, string][] }) => <Card><View style={{ flexDirection: 'row' }}>{items.map(([v, l], i) =>
  <View key={i} style={{ flex: 1 }}><Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, fontVariant: ['tabular-nums'] }}>{v}</Text><M>{l}</M></View>)}</View></Card>;
const Section = ({ title, hint }: { title: string; hint?: string }) => <View style={{ marginTop: 16, marginBottom: 8 }}>
  <Text accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{title}</Text>{hint ? <M>{hint}</M> : null}</View>;
const page = { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 700, alignSelf: 'center' } as const;

// ---------- Guests: households, food preference and invitation cards ----------
export const DIETS: [string, string][] = [['Veg', 'Veg'], ['Jain', 'Jain'], ['Non-veg', 'Non-veg'], ['Vegan', 'Vegan']];
const PARTY: [string, string][] = ['1', '2', '3', '4', '5', '6', '8', '10'].map(n => [n, n]);
const GUEST_FILTERS: [string, string][] = [['all', 'All'], ['nocard', 'Card not given'], ['waiting', 'Yet to reply'], ['bride', 'Bride side'], ['groom', 'Groom side']];
const peopleIn = (g: any) => Math.max(1, Number(g.party) || 1);
const familyLabel = (n: number) => n > 1 ? `${tr('Family of')} ${n}` : tr('1 person');

export function Guests() {
  const [list, load] = useLoad<any[]>('/guests', []); const [events] = useLoad<any[]>('/events', []);
  const [invites, loadInvites] = useLoad<any[]>('/guest-events', []); const [counts, loadCounts] = useLoad<any[]>('/events/headcount', []);
  const blank = { name: '', phone: '', side: 'bride', party: '1', meal: 'Veg' };
  const [f, setF] = useState(blank); const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false); const [open, setOpen] = useState<number | null>(null); const [filter, setFilter] = useState('all');
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const reload = () => Promise.all([load(), loadCounts()]);
  const add = async () => {
    if (!f.name.trim()) return err(new Error(tr('Enter the guest or family name.')));
    if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) return err(new Error(tr('Enter a 10-digit mobile number, or leave it empty.')));
    try { await api('/guests', 'POST', { name: f.name.trim(), phone: f.phone, side: f.side, party: +f.party || 1, meal: f.meal }); setF({ ...blank, side: f.side }); setAdding(false); reload(); } catch (e) { err(e); }
  };
  const patch = async (g: any, body: any) => { try { await api(`/guests/${g.id}`, 'PATCH', body); await reload(); } catch (e) { err(e); } };
  const share = (g: any) => Linking.openURL(`https://wa.me/91${g.phone}?text=${encodeURIComponent(`Namaste ${g.name}, you're invited. Please reply here: ${getBase()}/rsvp/${g.token}`)}`).catch(err);
  // Tapping a ceremony chip invites or uninvites the household for that ceremony.
  const invite = async (guestId: number, eventId: number, invited: boolean) => {
    if (busy) return; setBusy(true);
    try { await api(`/guests/${guestId}/events/${eventId}`, 'PUT', { invited }); await Promise.all([loadInvites(), loadCounts()]); } catch (e) { err(e); } finally { setBusy(false); }
  };
  const replyFor = (guestId: number, eventId: number) => invites.find(x => x.guest_id === guestId && x.event_id === eventId)?.rsvp;
  const veg = (c: any) => Math.max(0, c.coming - c.jain - c.nonveg - (c.vegan || 0));
  const foodLine = (c: any) => [veg(c) && `${veg(c)} ${tr('veg')}`, c.jain && `${c.jain} Jain`, c.nonveg && `${c.nonveg} ${tr('non-veg')}`, c.vegan && `${c.vegan} ${tr('vegan')}`].filter(Boolean).join(' · ');
  // Plain-text headcount the couple can forward to a caterer or venue.
  const shareHeadcount = () => Share.share({ message: counts.filter(c => c.invited).map(c => `${c.name}${c.date ? ` (${dateIN(c.date)})` : ''}: ${c.coming} ${tr('coming')}, ${c.waiting} ${tr('yet to reply')}${c.coming ? ` (${foodLine(c)})` : ''}`).join('\n') }).catch(() => {});
  const people = list.reduce((a, g) => a + peopleIn(g), 0); const coming = list.filter(g => g.rsvp === 'yes').reduce((a, g) => a + 1 + (g.plus_ones || 0), 0);
  const cards = list.filter(g => g.card_given).length; const waiting = list.filter(g => g.rsvp === 'pending').length;
  const shown = list.filter(g => filter === 'all' || (filter === 'nocard' ? !g.card_given : filter === 'waiting' ? g.rsvp === 'pending' : g.side === filter));
  return (<ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Stats items={[[people, `${tr('Invited')}\n${list.length} ${tr(list.length === 1 ? 'family' : 'families')}`], [coming, tr('Coming')], [waiting, tr('Yet to reply')], [`${cards}/${list.length}`, tr('Cards given')]]} />
    {counts.some(c => c.invited) ? <Card>
      <View style={s.row}><Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>{tr('Headcount by ceremony')}</Text><Btn small kind="quiet" icon="share" title={tr('Share')} onPress={shareHeadcount} /></View>
      {counts.filter(c => c.invited).map((c, i) => <View key={c.id} style={[s.row, { paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }]}>
        <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{c.name}</Text><M>{c.date ? dateIN(c.date) + ' · ' : ''}{c.invited} {tr('invited')}{c.coming ? ` · ${foodLine(c)}` : ''}</M></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: C.ok, fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{c.coming}</Text><M>{c.waiting} {tr('waiting')}</M></View>
      </View>)}
    </Card> : null}
    {adding || !list.length ? <Card>
      <Input label={tr('Guest or family name')} placeholder={tr('e.g. Sharma family or Meera Iyer')} value={f.name} onChangeText={v => set('name', v)} autoFocus={adding} maxLength={120} />
      <Label>{tr('People in this invitation')}</Label><Chips options={PARTY} value={f.party} onChange={v => set('party', v)} />
      <Label>{tr('Food')}</Label><Chips options={DIETS} value={f.meal} onChange={v => set('meal', v)} />
      <Input label={tr('WhatsApp number (optional)')} placeholder="10-digit mobile" value={f.phone} onChangeText={v => set('phone', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} />
      <View style={{ flexDirection: 'row' }}><Chip label={tr('Bride side')} on={f.side === 'bride'} onPress={() => set('side', 'bride')} /><Chip label={tr('Groom side')} on={f.side === 'groom'} onPress={() => set('side', 'groom')} /></View>
      <Btn icon="plus" title={tr('Add to guest list')} onPress={add} />{list.length ? <Btn kind="ghost" title={tr('Done')} onPress={() => setAdding(false)} /> : null}
    </Card> : <Btn kind="quiet" icon="plus" title={tr('Add a guest or family')} onPress={() => setAdding(true)} />}
    {list.length ? <Chips options={GUEST_FILTERS} value={filter} onChange={setFilter} /> : null}
    {list.length && !events.length ? <M style={{ marginVertical: 8 }}>{tr('Add your ceremonies under Tools, then Ceremonies, to invite guests to each one separately.')}</M> : null}
    {!list.length && <Empty icon="family" title={tr('No guests yet')} text={tr('Add each family once with how many people are invited, then send one RSVP link on WhatsApp.')} />}
    {shown.map((g, i) => (<Rise key={g.id} i={i}><Card>
      <Pressable accessibilityRole="button" accessibilityLabel={`${tr('Edit')} ${g.name}`} onPress={() => setOpen(open === g.id ? null : g.id)} style={s.row}>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '500', color: C.ink, fontSize: 15 }}>{g.name}</Text>
          <M>{[familyLabel(peopleIn(g)), g.side === 'bride' ? tr('Bride side') : tr('Groom side'), g.meal && tr(g.meal)].filter(Boolean).join(' · ')}</M>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            <Tag tone={g.rsvp === 'yes' ? 'ok' : g.rsvp === 'no' ? 'warn' : 'mute'} label={g.rsvp === 'yes' ? `${tr('Coming')} · ${1 + (g.plus_ones || 0)}` : g.rsvp === 'no' ? tr('Declined') : tr('Waiting')} />
            {g.card_given ? <Tag tone="gold" icon="check" label={g.card_by ? `${tr('Card given by')} ${g.card_by}` : tr('Card given')} /> : null}
          </View></View>
        <Icon name="chevron" size={16} color={C.faint} />
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {g.phone ? <Btn small kind="quiet" icon="send" title="WhatsApp" onPress={() => share(g)} /> : null}
        {!g.card_given ? <Btn small kind="quiet" icon="check" title={tr('Card given')} onPress={() => patch(g, { card_given: true })} /> : null}
      </View>
      {open === g.id ? <GuestEditor g={g} patch={body => patch(g, body)} onRemove={() => remove(`/guests/${g.id}`, g.name, reload)} /> : null}
      {events.length ? <View style={{ marginTop: 8 }}><M style={{ marginBottom: 4 }}>{tr('Invited to')}</M><ScrollView horizontal showsHorizontalScrollIndicator={false}>{events.map(e => {
        const reply = replyFor(g.id, e.id);
        return <Chip key={e.id} label={e.name} on={!!reply} icon={reply === 'yes' ? 'check' : reply === 'no' ? 'close' : undefined} onPress={() => invite(g.id, e.id, !reply)} />;
      })}</ScrollView></View> : null}
    </Card></Rise>))}</ScrollView>);
}
function GuestEditor({ g, patch, onRemove }: { g: any; patch: (b: any) => void; onRemove: () => void }) {
  const [by, setBy] = useState(g.card_by || '');
  return <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
    <Label>{tr('People in this invitation')}</Label><Chips options={PARTY} value={String(peopleIn(g))} onChange={v => patch({ party: +v })} />
    <Label>{tr('Food')}</Label><Chips options={DIETS} value={g.meal || ''} onChange={v => patch({ meal: v })} />
    <Label>{tr('Invitation card')}</Label>
    <View style={{ flexDirection: 'row' }}><Chip label={tr('Not given yet')} on={!g.card_given} onPress={() => patch({ card_given: false })} /><Chip label={tr('Given')} on={!!g.card_given} onPress={() => patch({ card_given: true, card_by: by })} /></View>
    {g.card_given ? <><Row><Input label={tr('Given by')} value={by} onChangeText={setBy} placeholder={tr('e.g. Papa, Mama ji')} maxLength={80} /><View style={{ paddingTop: 22 }}><Btn small kind="quiet" title={tr('Save')} onPress={() => patch({ card_given: true, card_by: by.trim() })} /></View></Row>
      {g.card_on ? <M style={{ marginTop: -8, marginBottom: 8 }}>{tr('Marked on')} {dateIN(g.card_on)}</M> : null}</> : null}
    <Btn small kind="quiet" title={tr('Remove from guest list')} onPress={onRemove} />
  </View>;
}

// ---------- Muhurat: dates from the pandit, checked against vendors' calendars ----------
export function Muhurat({ onDateChange }: { onDateChange: () => void }) {
  const [d, load] = useLoad<any>('/muhurats', null);
  const blank = { date: '', time: '', source: '', note: '' }; const [f, setF] = useState(blank); const [adding, setAdding] = useState(false); const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const add = async () => {
    if (!f.date) return err(new Error(tr('Choose a date.')));
    setSaving(true); try { await api('/muhurats', 'POST', f); setF(blank); setAdding(false); await load(); } catch (e) { err(e); } finally { setSaving(false); }
  };
  const choose = async (m: any) => {
    if (!(await confirm(tr('Make this the wedding date?'), `${dateIN(m.date)}${m.time ? ` · ${m.time}` : ''}`, tr('Set date')))) return;
    try { await api(`/muhurats/${m.id}/choose`, 'POST', {}); await load(); onDateChange(); } catch (e) { err(e); }
  };
  const options = d?.options || [];
  return <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <M style={{ marginBottom: 12 }}>{tr('Note the auspicious dates your family pandit suggests. Each one is checked against the vendors you have booked or shortlisted.')}</M>
    {adding || (!options.length && d) ? <Card>
      <DateField label={tr('Muhurat date')} value={f.date} onChange={v => set('date', v)} min={todayISO()} />
      <Row><Input label={tr('Time (optional)')} value={f.time} onChangeText={v => set('time', v)} placeholder={tr('e.g. 7:15 pm')} maxLength={40} /><Input label={tr('Suggested by')} value={f.source} onChangeText={v => set('source', v)} placeholder={tr('e.g. Pandit ji')} maxLength={80} /></Row>
      <Input label={tr('Note (optional)')} value={f.note} onChangeText={v => set('note', v)} placeholder={tr('e.g. Godhuli lagna, avoid Saturday')} maxLength={300} />
      <Btn icon="plus" title={tr('Add date')} disabled={saving} onPress={add} />{options.length ? <Btn kind="ghost" title={tr('Cancel')} onPress={() => setAdding(false)} /> : null}
    </Card> : <Btn kind="quiet" icon="plus" title={tr('Add a muhurat date')} onPress={() => setAdding(true)} />}
    {options.map((m: any, i: number) => <Rise key={m.id} i={i}><Card style={m.chosen ? { borderColor: C.primary, borderWidth: 2 } : undefined}>
      <View style={s.row}><View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{dateIN(m.date)}{m.time ? ` · ${m.time}` : ''}</Text>
        {m.source || m.note ? <M>{[m.source && `${tr('Suggested by')} ${m.source}`, m.note].filter(Boolean).join(' · ')}</M> : null}
      </View>{m.chosen ? <Tag tone="ok" icon="check" label={tr('Wedding date')} /> : null}</View>
      {m.busy.length ? <Text style={{ color: C.warn, fontSize: 13, marginTop: 8 }}>{`${m.busy.length} ${tr(m.busy.length === 1 ? 'of your vendors is busy' : 'of your vendors are busy')}: ${m.busy.map((b: any) => b.name).join(', ')}`}</Text>
        : d.vendors ? <Text style={{ color: C.ok, fontSize: 13, marginTop: 8 }}>{`${tr('All your vendors are free')} (${d.vendors})`}</Text>
        : <M style={{ marginTop: 8 }}>{tr('Shortlist or book vendors to check their availability.')}</M>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {!m.chosen ? <Btn small kind="quiet" icon="calendar" title={tr('Make this the wedding date')} onPress={() => choose(m)} /> : null}
        <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/muhurats/${m.id}`, dateIN(m.date), load)} />
      </View>
    </Card></Rise>)}
  </ScrollView>;
}

// ---------- Transport and baraat ----------
const VEHICLE_KINDS: [string, string][] = [['car', 'Car'], ['bus', 'Bus'], ['tempo', 'Tempo traveller'], ['horse', 'Ghodi / baggi'], ['other', 'Other']];
export function Transport() {
  const [list, load] = useLoad<any[]>('/vehicles', []); const [events] = useLoad<any[]>('/events', []); const [counts] = useLoad<any[]>('/events/headcount', []);
  const blank = { label: '', kind: 'car', event_id: '', seats: '', pickup_time: '', from_place: '', to_place: '', driver: '', driver_phone: '', passengers: '' };
  const [f, setF] = useState(blank); const [adding, setAdding] = useState(false); const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const add = async () => {
    if (!f.label.trim()) return err(new Error(tr('Give the vehicle a name, like Baraat bus or Car 1.')));
    if (f.driver_phone && !/^[6-9]\d{9}$/.test(f.driver_phone)) return err(new Error(tr('Enter a 10-digit mobile number, or leave it empty.')));
    setSaving(true);
    try { await api('/vehicles', 'POST', { ...f, label: f.label.trim(), event_id: f.event_id ? +f.event_id : null, seats: +f.seats || null }); setF({ ...blank, event_id: f.event_id }); setAdding(false); await load(); } catch (e) { err(e); } finally { setSaving(false); }
  };
  const groups = [...events.map(e => ({ id: e.id, name: e.name, date: e.date })), { id: null, name: tr('Any ceremony'), date: null }]
    .map(g => ({ ...g, items: list.filter(v => (v.event_id ?? null) === g.id) })).filter(g => g.items.length);
  return <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <M style={{ marginBottom: 12 }}>{tr('Cars, buses and the baraat for each ceremony: who drives, when they leave and who rides in each.')}</M>
    {adding || !list.length ? <Card>
      <Input label={tr('Vehicle')} value={f.label} onChangeText={v => set('label', v)} placeholder={tr('e.g. Baraat bus, Dulha car, Innova 1')} maxLength={80} />
      <Chips options={VEHICLE_KINDS} value={f.kind} onChange={v => set('kind', v)} />
      {events.length ? <><Label>{tr('Ceremony')}</Label><Chips options={[['', 'Any'], ...events.map(e => [String(e.id), e.name] as [string, string])]} value={f.event_id} onChange={v => set('event_id', v)} /></> : null}
      <Row><Input label={tr('Seats')} value={f.seats} onChangeText={v => set('seats', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} /><Input label={tr('Leaves at')} value={f.pickup_time} onChangeText={v => set('pickup_time', v)} placeholder={tr('e.g. 5:30 pm')} maxLength={40} /></Row>
      <Row><Input label={tr('From')} value={f.from_place} onChangeText={v => set('from_place', v)} placeholder={tr('e.g. Hotel Panchavati')} maxLength={120} /><Input label={tr('To')} value={f.to_place} onChangeText={v => set('to_place', v)} placeholder={tr('e.g. Lawns')} maxLength={120} /></Row>
      <Row><Input label={tr('Driver')} value={f.driver} onChangeText={v => set('driver', v)} maxLength={80} /><Input label={tr('Driver’s mobile')} value={f.driver_phone} onChangeText={v => set('driver_phone', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} /></Row>
      <Input label={tr('Who rides in it')} value={f.passengers} onChangeText={v => set('passengers', v)} placeholder={tr('e.g. Dulha, Mama ji, cousins')} multiline style={{ minHeight: 72, textAlignVertical: 'top' }} maxLength={600} />
      <Btn icon="plus" title={tr('Add vehicle')} disabled={saving} onPress={add} />{list.length ? <Btn kind="ghost" title={tr('Cancel')} onPress={() => setAdding(false)} /> : null}
    </Card> : <Btn kind="quiet" icon="plus" title={tr('Add a vehicle')} onPress={() => setAdding(true)} />}
    {groups.map(g => { const seats = g.items.reduce((a: number, v: any) => a + (v.seats || 0), 0); const coming = counts.find(c => c.id === g.id)?.coming;
      return <View key={String(g.id)}>
        <Section title={g.name} hint={[g.date && dateIN(g.date), seats && `${seats} ${tr('seats')}`, coming && `${coming} ${tr('coming')}`].filter(Boolean).join(' · ')} />
        {g.items.map((v: any) => <Card key={v.id}>
          <View style={s.row}><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{v.label}</Text>
            <M>{[tr(VEHICLE_KINDS.find(k => k[0] === v.kind)?.[1] || 'Other'), v.seats && `${v.seats} ${tr('seats')}`, v.pickup_time && `${tr('leaves')} ${v.pickup_time}`].filter(Boolean).join(' · ')}</M>
            {v.from_place || v.to_place ? <M>{[v.from_place, v.to_place].filter(Boolean).join(' → ')}</M> : null}
            {v.passengers ? <M style={{ color: C.ink, marginTop: 4 }}>{v.passengers}</M> : null}
            {v.driver ? <M style={{ marginTop: 4 }}>{tr('Driver')}: {v.driver}</M> : null}</View>
            <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/vehicles/${v.id}`, v.label, load)} /></View>
          {v.driver_phone ? <ContactButtons phone={v.driver_phone} whatsapp={v.driver_phone} /> : null}
        </Card>)}
      </View>; })}
  </ScrollView>;
}

// ---------- Gifts the family gives ----------
const OCCASIONS: [string, string][] = [['milni', 'Milni'], ['vidaai', 'Vidaai'], ['return_gift', 'Return gifts for guests'], ['in_laws', 'For the in-laws'], ['other', 'Other']];
export function GiftsToGive() {
  const [d, load] = useLoad<any>('/gifts-out', { items: [], households: 0 });
  const blank = { occasion: 'milni', recipient: '', item: '', qty: '1', cost: '' }; const [f, setF] = useState(blank); const [adding, setAdding] = useState(false); const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const add = async () => {
    const recipient = f.recipient.trim() || (f.occasion === 'return_gift' ? tr('All guests') : '');
    if (!recipient) return err(new Error(tr('Enter who the gift is for.')));
    setSaving(true);
    try { await api('/gifts-out', 'POST', { occasion: f.occasion, recipient, item: f.item.trim(), qty: +f.qty || 1, cost_paise: rupees(f.cost) }); setF({ ...blank, occasion: f.occasion }); setAdding(false); await load(); } catch (e) { err(e); } finally { setSaving(false); }
  };
  const toggle = async (x: any) => { try { await api(`/gifts-out/${x.id}`, 'PATCH', { ready: !x.ready }); load(); } catch (e) { err(e); } };
  const items = d.items; const cost = items.reduce((a: number, x: any) => a + (x.cost_paise || 0), 0);
  return <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Stats items={[[`${items.filter((x: any) => x.ready).length}/${items.length}`, tr('Ready')], [inr(cost), tr('Total cost')], [d.households, tr('Families invited')]]} />
    {adding || !items.length ? <Card>
      <Chips options={OCCASIONS} value={f.occasion} onChange={v => set('occasion', v)} />
      <Input label={tr('For')} value={f.recipient} onChangeText={v => set('recipient', v)} placeholder={f.occasion === 'return_gift' ? tr('All guests') : f.occasion === 'milni' ? tr('e.g. Groom’s Mama ji') : tr('e.g. Saasu maa')} maxLength={120} />
      <Input label={tr('Gift')} value={f.item} onChangeText={v => set('item', v)} placeholder={tr('e.g. Silver coin, shawl, envelope ₹1,100')} maxLength={160} />
      <Row><Input label={tr('How many')} value={f.qty} onChangeText={v => set('qty', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} /><Input label={tr('Total cost (₹)')} value={f.cost} onChangeText={v => set('cost', v)} keyboardType="decimal-pad" /></Row>
      {f.occasion === 'return_gift' && d.households ? <Btn small kind="quiet" title={`${tr('One per family')} (${d.households})`} onPress={() => set('qty', String(d.households))} /> : null}
      <Btn icon="plus" title={tr('Add gift')} disabled={saving} onPress={add} />{items.length ? <Btn kind="ghost" title={tr('Cancel')} onPress={() => setAdding(false)} /> : null}
    </Card> : <Btn kind="quiet" icon="plus" title={tr('Add a gift')} onPress={() => setAdding(true)} />}
    {OCCASIONS.map(([k, n]) => { const rows = items.filter((x: any) => x.occasion === k); return rows.length ? <View key={k}>
      <Section title={tr(n)} />
      {rows.map((x: any) => <Card key={x.id} style={{ paddingVertical: 16 }}><View style={s.row}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!x.ready }} accessibilityLabel={`${tr('Ready')}: ${x.recipient}`} onPress={() => toggle(x)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Check on={!!x.ready} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{x.recipient}</Text>
            <M>{[x.item, x.qty > 1 && `× ${x.qty}`, x.cost_paise && inr(x.cost_paise)].filter(Boolean).join(' · ')}</M></View>
        </Pressable>
        <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/gifts-out/${x.id}`, x.recipient, load)} />
      </View></Card>)}
    </View> : null; })}
  </ScrollView>;
}

// ---------- Menu for each ceremony, and food tastings ----------
const COURSES: [string, string][] = [['welcome', 'Welcome drinks'], ['starter', 'Starters'], ['main', 'Main course'], ['dessert', 'Desserts'], ['drinks', 'Drinks']];
const dietColor = (d: string) => d === 'Non-veg' ? C.warn : d === 'Jain' ? C.gold : C.ok;
export function Menu() {
  const [d, load] = useLoad<any>('/menu', { items: [], tastings: [] }); const [events] = useLoad<any[]>('/events', []); const [counts] = useLoad<any[]>('/events/headcount', []);
  const [f, setF] = useState({ event_id: '', course: 'main', dish: '', diet: 'Veg' }); const [t, setT] = useState({ caterer: '', date: '', time: '', notes: '' }); const [addingT, setAddingT] = useState(false);
  const event = f.event_id || (events[0] ? String(events[0].id) : '');
  const addDish = async () => {
    if (!f.dish.trim()) return err(new Error(tr('Enter a dish.')));
    try { await api('/menu/items', 'POST', { event_id: event ? +event : null, course: f.course, dish: f.dish.trim(), diet: f.diet }); setF({ ...f, dish: '' }); load(); } catch (e) { err(e); }
  };
  const addTasting = async () => {
    if (!t.caterer.trim() || !t.date) return err(new Error(tr('Enter the caterer and a date.')));
    try { await api('/menu/tastings', 'POST', { ...t, caterer: t.caterer.trim() }); setT({ caterer: '', date: '', time: '', notes: '' }); setAddingT(false); load(); } catch (e) { err(e); }
  };
  const done = async (x: any) => { try { await api(`/menu/tastings/${x.id}`, 'PATCH', { done: !x.done }); load(); } catch (e) { err(e); } };
  const groups = [...events.map(e => ({ id: e.id, name: e.name })), { id: null, name: tr('Any ceremony') }].map(g => ({ ...g, items: d.items.filter((x: any) => (x.event_id ?? null) === g.id) })).filter(g => g.items.length);
  const food = (c: any) => c ? `${c.coming} ${tr('coming')}${c.coming ? ` · ${c.jain} Jain · ${c.nonveg} ${tr('non-veg')}` : ''}` : '';
  return <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card>
      {events.length ? <><Label>{tr('Ceremony')}</Label><Chips options={events.map(e => [String(e.id), e.name] as [string, string])} value={event} onChange={v => setF({ ...f, event_id: v })} /></> : null}
      <Chips options={COURSES} value={f.course} onChange={v => setF({ ...f, course: v })} />
      <Input label={tr('Dish')} value={f.dish} onChangeText={v => setF({ ...f, dish: v })} placeholder={tr('e.g. Paneer tikka, Puran poli')} maxLength={120} returnKeyType="done" onSubmitEditing={addDish} />
      <Chips options={DIETS} value={f.diet} onChange={v => setF({ ...f, diet: v })} />
      <Btn icon="plus" title={tr('Add to menu')} onPress={addDish} />
    </Card>
    {!d.items.length ? <Empty icon="cloche" title={tr('No dishes yet')} text={tr('Plan the menu for each ceremony. Headcount and Jain or non-veg numbers from RSVPs show beside it, ready for the caterer.')} /> : null}
    {groups.map(g => <View key={String(g.id)}>
      <Section title={g.name} hint={food(counts.find(c => c.id === g.id))} />
      <Card style={{ paddingVertical: 8 }}>{COURSES.map(([k, n]) => { const rows = g.items.filter((x: any) => x.course === k); return rows.length ? <View key={k} style={{ paddingVertical: 8 }}>
        <M style={{ marginBottom: 4 }}>{tr(n)}</M>
        {rows.map((x: any) => <View key={x.id} style={[s.row, { minHeight: 36 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}><View style={{ width: 10, height: 10, borderRadius: 2, borderWidth: 1.5, borderColor: dietColor(x.diet), alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dietColor(x.diet) }} /></View>
            <Text style={{ color: C.ink, fontSize: 15, flex: 1 }}>{x.dish}{x.diet !== 'Veg' ? <Text style={{ color: C.mute, fontSize: 13 }}> · {tr(x.diet)}</Text> : null}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${tr('Remove')} ${x.dish}`} hitSlop={10} onPress={() => remove(`/menu/items/${x.id}`, x.dish, load)}><Icon name="close" size={16} color={C.faint} /></Pressable>
        </View>)}
      </View> : null; })}</Card>
    </View>)}
    <Section title={tr('Food tastings')} hint={tr('Tasting appointments with caterers and what you decided.')} />
    {addingT ? <Card>
      <Input label={tr('Caterer')} value={t.caterer} onChangeText={v => setT({ ...t, caterer: v })} maxLength={120} />
      <Row><DateField label={tr('Date')} value={t.date} onChange={v => setT({ ...t, date: v })} min={todayISO()} /><Input label={tr('Time')} value={t.time} onChangeText={v => setT({ ...t, time: v })} placeholder={tr('e.g. 1 pm')} maxLength={40} /></Row>
      <Input label={tr('Notes')} value={t.notes} onChangeText={v => setT({ ...t, notes: v })} placeholder={tr('Who is coming, dishes to try')} multiline style={{ minHeight: 72, textAlignVertical: 'top' }} maxLength={500} />
      <Btn icon="plus" title={tr('Add tasting')} onPress={addTasting} /><Btn kind="ghost" title={tr('Cancel')} onPress={() => setAddingT(false)} />
    </Card> : <Btn kind="quiet" icon="plus" title={tr('Add a tasting')} onPress={() => setAddingT(true)} />}
    {d.tastings.map((x: any) => <Card key={x.id} style={{ paddingVertical: 16 }}><View style={s.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!x.done }} accessibilityLabel={`${tr('Done')}: ${x.caterer}`} onPress={() => done(x)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Check on={!!x.done} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{x.caterer}</Text><M>{dateIN(x.date)}{x.time ? ` · ${x.time}` : ''}</M>{x.notes ? <M style={{ color: C.ink }}>{x.notes}</M> : null}</View>
      </Pressable>
      <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/menu/tastings/${x.id}`, x.caterer, load)} />
    </View></Card>)}
  </ScrollView>;
}

// ---------- Sangeet practice ----------
export function Practice() {
  const [list, load] = useLoad<any[]>('/practices', []);
  const blank = { date: '', time: '', place: '', item: '', people: '' }; const [f, setF] = useState(blank); const [adding, setAdding] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const add = async () => {
    if (!f.date || !f.item.trim()) return err(new Error(tr('Enter the date and the song or dance.')));
    try { await api('/practices', 'POST', { ...f, item: f.item.trim() }); setF(blank); setAdding(false); load(); } catch (e) { err(e); }
  };
  const today = todayISO(); const upcoming = list.filter(x => x.date >= today); const past = list.filter(x => x.date < today);
  const shareAll = () => Share.share({ message: `${tr('Sangeet practice')}\n` + upcoming.map(x => `${dateIN(x.date)}${x.time ? ` ${x.time}` : ''}${x.place ? `, ${x.place}` : ''}: ${x.item}${x.people ? ` (${x.people})` : ''}`).join('\n') }).catch(() => {});
  const card = (x: any) => <Card key={x.id} style={{ paddingVertical: 16 }}><View style={s.row}><View style={{ flex: 1 }}>
    <Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{x.item}</Text>
    <M>{[dateIN(x.date), x.time, x.place].filter(Boolean).join(' · ')}</M>{x.people ? <M style={{ color: C.ink }}>{x.people}</M> : null}</View>
    <Btn small kind="quiet" title={tr('Remove')} onPress={() => remove(`/practices/${x.id}`, x.item, load)} /></View></Card>;
  return <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <M style={{ marginBottom: 12 }}>{tr('Rehearsals for the sangeet: which song, where, and who needs to come. Share the schedule on the family WhatsApp group.')}</M>
    {adding || !list.length ? <Card>
      <Input label={tr('Song or dance')} value={f.item} onChangeText={v => set('item', v)} placeholder={tr('e.g. Couple dance, cousins’ medley')} maxLength={160} />
      <Row><DateField label={tr('Date')} value={f.date} onChange={v => set('date', v)} min={today} /><Input label={tr('Time')} value={f.time} onChangeText={v => set('time', v)} placeholder={tr('e.g. 7 pm')} maxLength={40} /></Row>
      <Input label={tr('Place')} value={f.place} onChangeText={v => set('place', v)} placeholder={tr('e.g. Bua ji’s terrace')} maxLength={120} />
      <Input label={tr('Who needs to come')} value={f.people} onChangeText={v => set('people', v)} placeholder={tr('e.g. All cousins, choreographer')} maxLength={400} />
      <Btn icon="plus" title={tr('Add practice')} onPress={add} />{list.length ? <Btn kind="ghost" title={tr('Cancel')} onPress={() => setAdding(false)} /> : null}
    </Card> : <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Btn kind="quiet" icon="plus" title={tr('Add practice')} onPress={() => setAdding(true)} /></View>
      {upcoming.length ? <View style={{ flex: 1 }}><Btn kind="quiet" icon="share" title={tr('Share schedule')} onPress={shareAll} /></View> : null}</View>}
    {upcoming.map(card)}
    {past.length ? <><Section title={tr('Done')} />{past.map(card)}</> : null}
  </ScrollView>;
}

// ---------- Ideas: photos and links to show family and vendors ----------
const IDEA_KINDS: [string, string][] = [['decor', 'Decor'], ['outfit', 'Outfits'], ['mehendi', 'Mehendi'], ['makeup', 'Makeup'], ['other', 'Other']];
const isImage = (url: string) => url.startsWith('/uploads/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
export function Ideas() {
  const [list, load] = useLoad<any[]>('/ideas', []);
  const [kind, setKind] = useState('decor'); const [filter, setFilter] = useState('all'); const [link, setLink] = useState(''); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false);
  const save = async (body: any) => { setSaving(true); try { await api('/ideas', 'POST', { kind, note: note.trim(), ...body }); setLink(''); setNote(''); await load(); } catch (e) { err(e); } finally { setSaving(false); } };
  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }).catch(e => { err(e); return null; });
    const asset = picked && !picked.canceled ? picked.assets[0] : null; if (!asset) return;
    const data = asset.base64 || (asset.uri.startsWith('data:') ? asset.uri : '');
    if (!data) return err(new Error(tr('That photo could not be read. Try another one.')));
    save({ data });
  };
  const addLink = () => { const url = link.trim(); if (!url && !note.trim()) return err(new Error(tr('Paste a link or write a note.'))); if (url && !/^https:\/\//.test(url)) return err(new Error(tr('Links must start with https://'))); save(url ? { url } : {}); };
  const shown = list.filter(x => filter === 'all' || x.kind === filter);
  return <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Card>
      <Chips options={IDEA_KINDS} value={kind} onChange={setKind} />
      <Input label={tr('Note (optional)')} value={note} onChangeText={setNote} placeholder={tr('e.g. Pastel marigold mandap for the pheras')} maxLength={300} />
      <Btn icon="camera" title={saving ? tr('Saving…') : tr('Add a photo')} disabled={saving} onPress={pick} />
      <Input label={tr('Or paste a link')} value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="https://www.instagram.com/p/…" />
      <Btn kind="quiet" title={tr('Save link or note')} disabled={saving} onPress={addLink} />
    </Card>
    {list.length ? <Chips options={[['all', 'All'], ...IDEA_KINDS]} value={filter} onChange={setFilter} /> : <Empty icon="camera" title={tr('No ideas saved yet')} text={tr('Save photos and links for decor, outfits and mehendi to show your family and vendors.')} />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{shown.map(x => <View key={x.id} style={{ width: '47%', flexGrow: 1, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, overflow: 'hidden' }}>
      {x.url && isImage(x.url) ? <Image source={{ uri: x.url.startsWith('/') ? getBase() + x.url : x.url }} accessibilityLabel={x.note || tr('Saved idea')} resizeMode="cover" style={{ width: '100%', aspectRatio: 1, backgroundColor: C.tint }} />
        : x.url ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(x.url).catch(err)} style={{ aspectRatio: 1.6, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12 }}>
          <Icon name="globe" size={22} color={C.primary} /><Text style={{ color: C.primary, fontSize: 13 }} numberOfLines={1}>{x.url.replace(/^https:\/\/(www\.)?/, '').split('/')[0]}</Text></Pressable> : null}
      <View style={{ padding: 12 }}>
        <M>{tr(IDEA_KINDS.find(k => k[0] === x.kind)?.[1] || 'Other')}</M>
        {x.note ? <Text style={{ color: C.ink, fontSize: 13, marginTop: 2 }}>{x.note}</Text> : null}
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => remove(`/ideas/${x.id}`, x.note || tr('this idea'), load)} style={{ marginTop: 8 }}><Text style={{ color: C.mute, fontSize: 13, textDecorationLine: 'underline' }}>{tr('Remove')}</Text></Pressable>
      </View>
    </View>)}</View>
  </ScrollView>;
}

// ---------- Choosing a vendor booked directly (phone call, visit) ----------
// Most venues and local businesses are booked offline; marking them here ticks the task, fills ceremony venues and counts them on the plan.
export function ChooseVendor({ vendor }: { vendor: any }) {
  // Quiet load: vendors and couples without a wedding yet simply don't see this card.
  const [mine, setMine] = useState<any[] | null>(null); const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { try { setMine(await api('/my-vendors')); } catch { setMine(null); } };
  useEffect(() => { load(); }, [vendor.id]);
  const row = mine?.find(m => m.vendor_id === vendor.id); const label = categoryName(vendor.category);
  if (!mine || row?.status === 'booked') return null;
  const set = async (chosen: boolean) => {
    setBusy(true);
    try { await api('/shortlist/choose', 'POST', { vendor_id: vendor.id, chosen, agreed_paise: chosen ? rupees(amount) : null }); await load(); } catch (e) { err(e); } finally { setBusy(false); }
  };
  return <Card style={{ marginTop: 12, marginBottom: 12 }}>
    {row?.status === 'chosen' ? <>
      <View style={s.row}><Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink, flex: 1 }}>{`${tr('Your')} ${label.toLowerCase()}`}</Text><Tag tone="ok" icon="check" label={tr('Booked')} /></View>
      <M style={{ marginTop: 4 }}>{row.amount_paise ? `${tr('Agreed price')} ${inr(row.amount_paise)} · ` : ''}{tr('It’s on your plan and checklist.')}</M>
      <Btn small kind="quiet" title={tr('Undo')} disabled={busy} onPress={() => set(false)} />
    </> : <>
      <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>{tr('Booked them already?')}</Text>
      <M style={{ marginTop: 4, marginBottom: 12 }}>{`${tr('Mark them as your')} ${label.toLowerCase()}. ${tr('We tick the task, add them to your plan and day contacts')}${vendor.category === 'venue' ? ` ${tr('and set the venue on your ceremonies')}` : ''}.`}</M>
      <Input label={tr('Agreed price (₹, optional)')} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Btn icon="check" title={busy ? tr('Saving…') : `${tr('Mark as our')} ${label.toLowerCase()}`} disabled={busy} onPress={() => set(true)} />
    </>}
  </Card>;
}
const CATEGORY_NAMES: Record<string, string> = { venue: 'Venue', caterer: 'Caterer', photographer: 'Photographer', decor: 'Decorator', makeup: 'Makeup artist', mehndi: 'Mehendi artist', dj: 'DJ', pandit: 'Pandit' };
const categoryName = (c: string) => tr(CATEGORY_NAMES[c] || 'Vendor');

// Venue picker for a ceremony: the couple's booked, chosen and shortlisted venues as one-tap options.
export function VenueOptions({ value, onPick }: { value: string; onPick: (name: string) => void }) {
  const [mine] = useLoad<any[]>('/my-vendors', []);
  const venues = mine.filter(m => m.category === 'venue');
  if (!venues.length) return <M style={{ marginTop: -8, marginBottom: 12 }}>{tr('Tip: shortlist or book venues in Discover to pick them here.')}</M>;
  return <View style={{ marginTop: -8, marginBottom: 12 }}><M style={{ marginBottom: 4 }}>{tr('Your venues')}</M>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>{venues.map(v => <Chip key={v.vendor_id} label={v.name} icon={v.status !== 'shortlisted' ? 'check' : undefined} on={value === v.name} onPress={() => onPick(v.name)} />)}</ScrollView></View>;
}
