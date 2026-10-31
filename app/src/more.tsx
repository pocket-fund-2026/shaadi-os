import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, Linking, Share, Pressable } from 'react-native';
import { api, getBase } from './api';
import { Btn, Card, Chip, H, Input, M, C, F, inr, err, s, Empty, Rise, Tag, confirm } from './ui';
import { Icon } from './icons';
import { tr } from './i18n';
import { useLoad } from './couple';

export function Events() {
  const [ev, load, busy] = useLoad<any[]>('/events', []); const [edit, setEdit] = useState<any>(null);
  const [name, setName] = useState(''); const [date, setDate] = useState(''); const [saving, setSaving] = useState(false);
  const gen = async () => { setSaving(true); try { await api('/events/generate', 'POST'); await load(); } catch (e) { err(e); } finally { setSaving(false); } };
  const add = async () => { setSaving(true); try { await api('/events', 'POST', { name: name.trim(), ...(date ? { date } : {}) }); setName(''); setDate(''); await load(); } catch (e) { err(e); } finally { setSaving(false); } };
  const save = async () => { setSaving(true); try { await api('/events/' + edit.id, 'PUT', { name: edit.name, date: edit.date || '', venue: edit.venue || '', dress: edit.dress || '' }); setEdit(null); await load(); } catch (e) { err(e); } finally { setSaving(false); } };
  const remove = async (id: number) => { if (!(await confirm(tr('Remove this celebration?'), tr('Its date and venue will be removed from your plan.'), tr('Remove'), true))) return; setSaving(true); try { await api('/events/' + id, 'DELETE'); setEdit(null); await load(); } catch (e) { err(e); } finally { setSaving(false); } };
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <Card style={{ backgroundColor: C.primaryDark, borderColor: C.primaryDark }}><M style={{ color: C.goldSoft, fontWeight: '500' }}>{tr('Your celebrations')}</M><Text style={{ fontFamily: F.display, fontSize: 28, color: '#fff', marginTop: 6 }}>{tr('Every event, one plan')}</Text><M style={{ color: '#F4DDE5', marginTop: 7 }}>{tr('Keep only the celebrations that fit your families. Add dates and places when you know them.')}</M></Card>
    {!ev.length && !busy && <Empty icon="calendar" title={tr('No ceremonies yet')} text={tr('Start with suggested celebrations for your community, or add your own.')} />}
    <Btn kind="quiet" icon="calendar" title={tr('Add suggested celebrations')} disabled={saving} onPress={gen} />
    {ev.map((e, i) => (<Rise key={e.id} i={i}><View style={{ flexDirection: 'row' }}>
      <View style={{ alignItems: 'center', width: 28, marginRight: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: e.date ? C.primary : C.chipBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: e.date ? '#fff' : C.mute, fontWeight: '600', fontSize: 12 }}>{i + 1}</Text></View>
        {i < ev.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: C.line, marginVertical: 2 }} /> : null}</View>
      <View style={{ flex: 1 }}><Card onPress={() => setEdit(edit?.id === e.id ? null : e)}>
        <View style={s.row}><Text style={{ fontWeight: '600', color: C.ink, fontSize: 15 }}>{e.name}</Text><Icon name="chevron" size={16} color={C.faint} /></View>
        <M style={{ marginTop: 2 }}>{e.date || tr('Date not set')}{e.venue ? ' · ' + e.venue : ''}{e.dress ? ' · ' + e.dress : ''}</M></Card>
        {edit?.id === e.id && <Rise><Card style={{ borderColor: C.primary }}>
          <Input label={tr('Celebration name')} value={edit.name || ''} onChangeText={v => setEdit({ ...edit, name: v })} maxLength={100} />
          <Input label={tr('Date (YYYY-MM-DD)')} value={edit.date || ''} onChangeText={v => setEdit({ ...edit, date: v })} placeholder="YYYY-MM-DD" />
          <Input label={tr('Venue')} value={edit.venue || ''} onChangeText={v => setEdit({ ...edit, venue: v })} placeholder={tr('Venue name')} />
          <Input label={tr('Dress code')} value={edit.dress || ''} onChangeText={v => setEdit({ ...edit, dress: v })} placeholder={tr('Colours or attire')} />
          <Btn small title={tr('Save')} disabled={saving || !edit.name?.trim()} onPress={save} /><Btn small kind="ghost" title={tr('Remove celebration')} disabled={saving} onPress={() => remove(e.id)} /></Card></Rise>}</View></View></Rise>))}
    <Card style={{ marginTop: 8 }}><H style={{ fontSize: 20, marginTop: 0 }}>{tr('Add your own celebration')}</H><Input label={tr('Celebration name')} value={name} onChangeText={setName} placeholder={tr('e.g. family dinner')} maxLength={100} /><Input label={tr('Date (optional)')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" maxLength={10} /><Btn icon="plus" title={tr('Add celebration')} disabled={saving || !name.trim()} onPress={add} /></Card>
  </ScrollView>);
}

const ROLES: [string, string, string][] = [['editor', 'Editor', 'Can change plans'], ['viewer', 'Viewer', 'Sees plans, no budget'], ['budget_viewer', 'Budget viewer', 'Sees plans and budget']];
export function Family() {
  const [d, load] = useLoad<any>('/members', { role: '', members: [] }); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [role, setRole] = useState('viewer');
  const add = async () => { if (!name.trim() || !/^[6-9]\d{9}$/.test(phone)) return err(new Error(tr('Enter a name and a 10-digit mobile number.'))); await api('/members', 'POST', { name, phone, role }).catch(err); setName(''); setPhone(''); load(); };
  const roleName = (r: string) => tr(ROLES.find(x => x[0] === r)?.[1] || r);
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <M style={{ marginBottom: 10 }}>{tr('Your access')}: {d.role === 'owner' ? tr('Owner') : roleName(d.role)}</M>
    <Input label={tr('Name')} placeholder="Family Member Name" value={name} onChangeText={setName} /><Input label={tr('Mobile')} placeholder="10-digit mobile" value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{ROLES.map(([k, n]) => <Chip key={k} label={tr(n)} on={role === k} onPress={() => setRole(k)} />)}</View>
    <M style={{ marginBottom: 4 }}>{tr(ROLES.find(r => r[0] === role)?.[2] || '')}</M>
    <Btn icon="plus" title={tr('Invite family member')} onPress={add} />
    {d.members.map((m: any, i: number) => <Rise key={m.id} i={i}><Card><View style={s.row}><View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ fontFamily: F.display, color: C.primary, fontSize: 16 }}>{(m.name || '?')[0].toUpperCase()}</Text></View>
      <View><Text style={{ fontWeight: '600', color: C.ink }}>{m.name}</Text><M>+91 {m.phone}</M></View></View><Tag label={roleName(m.role)} /></View></Card></Rise>)}</ScrollView>);
}

export function ShortlistTab({ navigation }: any) {
  const [l, load, busy] = useLoad<any[]>('/shortlist', []);
  const vote = async (id: number, v: number) => { await api(`/shortlist/${id}/vote`, 'POST', { vote: v }).catch(err); load(); };
  const share = (v: any) => Share.share({ message: `What do you think of ${v.name} (${v.category}, ${v.city}) from ${inr(v.start_paise)}? Vote in Shaadi OS.` }).catch(() => {});
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
    {!l.length && !busy && <Empty icon="heart" title={tr('Nothing shortlisted')} text={tr('Tap Shortlist on any vendor’s page. Everyone in your family workspace can then vote here.')} />}
    {l.map((v, i) => <Rise key={v.id} i={i}><Card>
      <Pressable onPress={() => navigation.navigate('Vendor', { id: v.vendor_id })} style={s.row}><View style={{ flex: 1 }}><Text style={{ fontWeight: '600', color: C.ink, fontSize: 15 }}>{v.name}</Text><M>{v.category} · {v.city} · {tr('from')} {inr(v.start_paise)}</M></View><Icon name="chevron" size={16} color={C.faint} /></Pressable>
      <View style={{ flexDirection: 'row', marginTop: 10, flexWrap: 'wrap' }}><Chip icon="up" label={String(v.up)} onPress={() => vote(v.id, 1)} /><Chip icon="down" label={String(v.down)} onPress={() => vote(v.id, -1)} /><Chip icon="share" label={tr('Ask family')} onPress={() => share(v)} /></View></Card></Rise>)}</ScrollView>);
}

const THEMES: [string, string, string][] = [['maroon', 'Maroon', '#7A1F3D'], ['emerald', 'Emerald', '#0B5D46'], ['royal', 'Royal', '#2B2A6F'], ['rose', 'Rose', '#B0475F']];
export function InviteTab({ title }: { title?: string }) {
  const [inv, load] = useLoad<any>('/invite', null); const [theme, setTheme] = useState('maroon'); const [msg, setMsg] = useState('We joyfully invite you to celebrate with us.'); const [saving, setSaving] = useState(false);
  useEffect(() => { if (inv) { setTheme(inv.theme); setMsg(inv.message || ''); } }, [inv]);
  const save = async () => { setSaving(true); await api('/invite', 'PUT', { theme, message: msg }).catch(err); await load(); setSaving(false); };
  const url = inv ? `${getBase()}/w/${inv.slug}` : '';
  const hex = THEMES.find(t => t[0] === theme)?.[2] || C.primary;
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <H style={{ marginTop: 0 }}>{tr('Wedding website')}</H><M>{tr('One shareable page with your ceremonies, dates and venues.')}</M>
    <View style={{ borderRadius: 14, overflow: 'hidden', marginVertical: 14, borderWidth: 1, borderColor: C.line }}>
      <View style={{ backgroundColor: hex, paddingVertical: 26, alignItems: 'center' }}><Text style={{ color: '#F4E9D2', fontSize: 11, letterSpacing: 2 }}>{tr('TOGETHER WITH THEIR FAMILIES')}</Text><Text style={{ fontFamily: F.display, color: '#fff', fontSize: 24, marginTop: 6 }}>{title || tr('Your names here')}</Text></View>
      <View style={{ backgroundColor: '#fff', padding: 14 }}><Text style={{ color: C.ink, textAlign: 'center', fontStyle: 'italic' }}>{msg || ' '}</Text></View></View>
    <Text style={s.label}>{tr('Colour')}</Text>
    <View style={{ flexDirection: 'row', marginBottom: 12 }}>{THEMES.map(([k, n, c]) => <Pressable key={k} accessibilityLabel={n} onPress={() => setTheme(k)} hitSlop={4} style={{ marginRight: 12, alignItems: 'center' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: theme === k ? C.gold : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{theme === k ? <Icon name="check" size={18} color="#fff" strokeWidth={2.4} /> : null}</View>
      <M style={{ marginTop: 4, fontSize: 11 }}>{tr(n)}</M></Pressable>)}</View>
    <Input label={tr('Message')} value={msg} onChangeText={setMsg} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
    <Btn title={saving ? tr('Publishing…') : inv ? tr('Save changes') : tr('Publish website')} disabled={saving} onPress={save} />
    {inv && <Rise><Card><View style={{ flexDirection: 'row', alignItems: 'center' }}><Tag tone="ok" icon="check" label={tr('Live')} /><M style={{ marginLeft: 8, flex: 1 }} >{url}</M></View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}><View style={{ flex: 1 }}><Btn small kind="ghost" icon="send" title="WhatsApp" onPress={() => Linking.openURL('https://wa.me/?text=' + encodeURIComponent('You are invited! ' + url)).catch(err)} /></View>
        <View style={{ flex: 1 }}><Btn small kind="ghost" icon="eye" title={tr('Preview')} onPress={() => Linking.openURL(url).catch(err)} /></View></View></Card></Rise>}</ScrollView>);
}

export function Business() {
  const [tab, setTab] = useState('store');
  const VendorProfile = require('./vendor').VendorProfile;
  return (<View style={{ flex: 1, backgroundColor: C.bg }}><View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 }}>{([['store', 'Storefront', 'store'], ['cal', 'Calendar', 'calendar'], ['crm', 'CRM', 'family']] as const).map(([k, n, ic]) => <Chip key={k} icon={ic} label={tr(n)} on={tab === k} onPress={() => setTab(k)} />)}</View>
    <Rise key={tab} style={{ flex: 1 }}>{tab === 'store' ? <VendorProfile /> : tab === 'cal' ? <VCalendar /> : <CRM />}</Rise></View>);
}

function VCalendar() {
  const [d, load] = useLoad<any>('/vendor/calendar', { blocked: [], booked: [] }); const [date, setDate] = useState('');
  const block = async () => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(new Error(tr('Enter the date as YYYY-MM-DD.'))); await api('/vendor/block', 'POST', { date, note: 'Blocked' }).catch(err); setDate(''); load(); };
  const unblock = async (x: string) => { if (!(await confirm(tr('Unblock this date?'), x, tr('Unblock')))) return; await api('/vendor/block/' + x, 'DELETE').catch(err); load(); };
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <M style={{ marginBottom: 10 }}>{tr('Couples see you as unavailable on blocked and booked dates when they enquire.')}</M>
    <Input label={tr('Block a date')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><Btn icon="lock" title={tr('Block date')} onPress={block} />
    <H style={{ fontSize: 18 }}>{tr('Booked')}</H>
    {d.booked.length ? d.booked.map((b: any, i: number) => <Rise key={i} i={i}><Card><View style={s.row}><Text style={{ fontWeight: '600', color: C.ink }}>{b.date}</Text><M>{b.client}</M></View></Card></Rise>) : <M>{tr('No booked dates yet.')}</M>}
    <H style={{ fontSize: 18, marginTop: 16 }}>{tr('Blocked')}</H>
    {d.blocked.length ? d.blocked.map((b: any, i: number) => <Rise key={b.id} i={i}><Card onPress={() => unblock(b.date)}><View style={s.row}><Text style={{ fontWeight: '600', color: C.ink }}>{b.date}</Text><M>{tr('Tap to unblock')}</M></View></Card></Rise>) : <M>{tr('No blocked dates.')}</M>}</ScrollView>);
}

const STAGES = ['lead', 'contacted', 'quoted', 'won', 'lost'];
function CRM() {
  const [l, load, busy] = useLoad<any[]>('/crm', []); const [client, setClient] = useState(''); const [note, setNote] = useState('');
  const add = async () => { if (!client.trim()) return; await api('/crm', 'POST', { client, note }).catch(err); setClient(''); setNote(''); load(); };
  const mv = async (id: number, stage: string) => { await api('/crm/' + id, 'PATCH', { stage }).catch(err); load(); };
  const cap = (x: string) => tr(x[0].toUpperCase() + x.slice(1));
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <M style={{ marginBottom: 10 }}>{tr('Track clients who reach you outside the app too. Free, and only you see it.')}</M>
    <Input label={tr('Client')} placeholder="Client Name" value={client} onChangeText={setClient} /><Input label={tr('Note')} placeholder={tr('Event, date, what they asked for')} value={note} onChangeText={setNote} /><Btn icon="plus" title={tr('Add client')} onPress={add} />
    {!l.length && !busy && <M style={{ marginTop: 12 }}>{tr('No clients tracked yet.')}</M>}
    {l.map((c, i) => <Rise key={c.id} i={i}><Card>
      <View style={s.row}><Text style={{ fontWeight: '600', color: C.ink, fontSize: 15 }}>{c.client}</Text><Tag tone={c.stage === 'won' ? 'ok' : c.stage === 'lost' ? 'warn' : 'gold'} label={cap(c.stage)} /></View>
      {c.note ? <M style={{ marginTop: 4 }}>{c.note}</M> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>{STAGES.map(st => <Chip key={st} label={cap(st)} on={c.stage === st} onPress={() => mv(c.id, st)} />)}</ScrollView></Card></Rise>)}</ScrollView>);
}

export function Privacy() {
  const [mkt, setMkt] = useState<boolean | null>(null);
  const exp = async () => { try { const d = await api('/my-data'); await Share.share({ message: JSON.stringify(d, null, 1) }); } catch (e) { err(e); } };
  const cons = async (g: boolean) => { await api('/consent', 'POST', { purpose: 'marketing', granted: g }).then(() => setMkt(g)).catch(err); };
  const del = async () => { if (await confirm(tr('Delete your account data?'), tr('This removes your profile, wedding plans and messages. Bookings with money in escrow are kept until they settle. This cannot be undone.'), tr('Delete'), true)) api('/my-data', 'DELETE').catch(err); };
  return (<Card style={{ marginTop: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="lock" size={18} color={C.primary} /><Text style={{ fontFamily: F.display, fontSize: 18, color: C.ink, marginLeft: 8 }}>{tr('Privacy')}</Text></View>
    <M style={{ marginTop: 4 }}>{tr('Under the DPDP Act you can export or delete your data. Every consent choice is logged.')}</M>
    <Text style={[s.label, { marginTop: 12 }]}>{tr('Marketing messages')}</Text>
    <View style={{ flexDirection: 'row' }}><Chip label={tr('Allow')} on={mkt === true} onPress={() => cons(true)} /><Chip label={tr('Don’t allow')} on={mkt === false} onPress={() => cons(false)} /></View>
    <Btn small kind="quiet" icon="share" title={tr('Export my data')} onPress={exp} />
    <Btn small kind="ghost" title={tr('Delete my account data')} onPress={del} />
    <M style={{ marginTop: 6 }}>{tr('Grievance officer')}: grievance@shaadios.example {tr('(placeholder, set before launch)')}</M></Card>);
}

export function Admin() {
  const [sum, setSum] = useState<any>(null); const [vs, setVs] = useState<any[]>([]);
  const load = async () => { try { setSum(await api('/admin/summary')); setVs(await api('/admin/vendors')); } catch { setSum(null); } };
  useEffect(() => { load(); }, []);
  if (!sum) return null;
  const verify = async (id: number) => { await api(`/admin/vendors/${id}/verify`, 'POST').catch(err); load(); };
  return (<Card style={{ marginTop: 16 }}><Text style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{tr('Admin')}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{[[tr('GMV'), inr(sum.gmv_paise)], [tr('Commission'), inr(sum.commission_paise)], [tr('Bookings'), sum.bookings], [tr('Open disputes'), sum.open_disputes]].map(([k, v], i) => (
      <View key={i} style={{ width: '50%', paddingVertical: 6 }}><M>{k}</M><Text style={{ fontWeight: '600', color: C.ink, fontSize: 16 }}>{v}</Text></View>))}</View>
    {vs.length ? <Text style={[s.label, { marginTop: 8 }]}>{tr('Vendors awaiting verification')}</Text> : null}
    {vs.map(v => <View key={v.id} style={[s.row, { marginTop: 6 }]}><Text style={{ flex: 1, color: C.ink }}>{v.name}</Text><Btn small icon="seal" title={tr('Verify')} onPress={() => verify(v.id)} /></View>)}</Card>);
}
