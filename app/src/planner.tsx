import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { api } from './api';
import { tr } from './i18n';
import { Bar, Btn, C, Card, Chip, Empty, F, H, Input, M, Rise, Tag, confirm, err, inr, s } from './ui';
import { FloralArch } from './visuals';
import { Icon } from './icons';

function usePlanner<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try { setData(await api<T>(path)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [path]);
  return { data, load, busy, error };
}
function Failure({ error, retry }: { error: string; retry: () => void }) {
  return error ? <Card><M style={{ color: C.warn }}>{error}</M><Btn kind="quiet" title={tr('Try again')} onPress={retry} /></Card> : null;
}
const content = { padding: 16, paddingBottom: 40, width: '100%' as const, maxWidth: 700, alignSelf: 'center' as const };
const dateLabel = (value?: string) => value ? new Date(value + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : tr('No due date');
const rupees = (value: string) => {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error(tr('Enter a valid amount with up to two decimal places.'));
  const [whole, decimal = ''] = value.trim().split('.');
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error(tr('Enter a valid amount with up to two decimal places.'));
  return amount;
};

export function Overview({ open }: { open: (tab: string) => void }) {
  const { data: d, busy, error, load } = usePlanner<any>('/planner/overview');
  return <ScrollView contentContainerStyle={content} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} />}>
    <Failure error={error} retry={load} />
    {!d ? <M>{tr('Loading your overview…')}</M> : <>
      <Card style={{ backgroundColor: C.primaryDark, borderColor: C.primaryDark, overflow: 'hidden', padding: 24 }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -36, top: -20, opacity: 0.25 }}><FloralArch size={180} /></View>
        <M style={{ color: '#F4DDE5' }}>{tr('Your celebration, coming together')}</M>
        <Text style={{ fontFamily: F.display, fontSize: 36, color: '#fff', marginVertical: 8 }}>{d.days_left > 0 ? `${d.days_left} ${tr('days to go')}` : d.days_left === 0 ? tr('Today is the day') : tr('Just married')}</Text>
        <M style={{ color: '#F4DDE5' }}>{dateLabel(d.wedding.date)} · {d.wedding.city} · {d.wedding.guests_est} {tr('guests')}</M>
        <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#A66B7E', paddingTop: 16 }}>
          <View style={s.row}><M style={{ color: '#F4DDE5' }}>{tr('Your planning progress')}</M><Text style={{ color: '#fff', fontWeight: '700' }}>{d.tasks.total ? Math.round(d.tasks.done / d.tasks.total * 100) : 0}%</Text></View>
          <View style={{ marginTop: 10 }}><Bar pct={d.tasks.total ? d.tasks.done / d.tasks.total * 100 : 0} color={C.goldSoft} /></View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={() => open('checklist')}><H>{d.tasks.done}/{d.tasks.total}</H><M>{tr('Tasks complete')}</M>{d.tasks.overdue > 0 && <Tag tone="warn" label={`${d.tasks.overdue} ${tr('Overdue')}`} />}</Card>
        <Card style={{ flex: 1 }} onPress={() => open('guests')}><H>{d.guests.attending}</H><M>{tr('Confirmed guests')}</M><M>{d.guests.waiting} {tr('Waiting')}</M></Card>
      </View>
      <Card onPress={() => open('budget')}>
        <View style={s.row}><H>{tr('Budget')}</H><Tag tone={d.budget.remaining_paise < 0 ? 'warn' : 'ok'} label={d.budget.remaining_paise < 0 ? tr('Over budget') : tr('On track')} /></View>
        <Text style={{ fontFamily: F.display, fontSize: 27, color: C.primary }}>{inr(d.budget.remaining_paise)}</Text><M>{tr('Remaining to book')}</M>
        <View style={{ marginVertical: 12 }}><Bar pct={Math.min(100, d.budget.booked_paise / d.budget.total_paise * 100)} /></View>
        <View style={s.row}><M>{tr('Booked')} {inr(d.budget.booked_paise)}</M><M>{tr('Paid')} {inr(d.budget.paid_paise)}</M></View>
      </Card>
      <View style={[s.row, { marginTop: 10 }]}><H>{tr('Next steps')}</H><Tag tone={d.tasks.overdue ? 'warn' : 'ok'} label={d.tasks.overdue ? `${d.tasks.overdue} ${tr('Overdue')}` : tr('On track')} /></View>
      {d.tasks.upcoming.length ? d.tasks.upcoming.slice(0, 3).map((task: any, index: number) => <Rise key={task.id} i={index}><Card onPress={() => open('checklist')} style={{ paddingVertical: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Icon name="checklist" size={18} color={C.primary} /></View><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: '600', fontSize: 15 }}>{task.title}</Text><M>{dateLabel(task.due)}</M></View><Icon name="chevron" size={16} color={C.faint} /></View></Card></Rise>) : <M>{tr('All tasks complete. Enjoy your celebration!')}</M>}
      <Btn kind="quiet" title={tr('Open planning checklist')} icon="checklist" onPress={() => open('checklist')} />
      <H>{tr('Upcoming ceremonies')}</H>
      {d.events.length ? d.events.map((event: any) => <Card key={event.id} onPress={() => open('events')}><Text style={{ fontWeight: '600', color: C.ink }}>{event.name}</Text><M>{event.date}{event.venue ? ` · ${event.venue}` : ''}</M></Card>) : <Btn kind="quiet" title={tr('Plan your ceremonies')} onPress={() => open('events')} />}
      <Btn kind="ghost" title={`${tr('Shortlist')} · ${d.shortlisted}`} onPress={() => open('shortlist')} />
    </>}
  </ScrollView>;
}

export function TaskManager() {
  const { data, busy, error, load } = usePlanner<any[]>('/tasks');
  const { data: guide, load: loadGuide, error: guideError } = usePlanner<any[]>('/planner/guide');
  const [title, setTitle] = useState(''); const [due, setDue] = useState(''); const [filter, setFilter] = useState('pending'); const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'mine' | 'ideas'>('mine'); const [phase, setPhase] = useState('All');
  const [editing, setEditing] = useState<number | null>(null); const [editTitle, setEditTitle] = useState(''); const [editDue, setEditDue] = useState('');
  const tasks = data || []; const today = new Date().toISOString().slice(0, 10); const done = tasks.filter(t => t.done).length;
  const action = async (path: string, method: string, body?: any) => {
    setSaving(true);
    try { await api(path, method, body); await load(); await loadGuide(); return true; } catch (e) { err(e); return false; } finally { setSaving(false); }
  };
  const add = async () => { if (await action('/tasks', 'POST', { title: title.trim(), ...(due ? { due } : {}) })) { setTitle(''); setDue(''); } };
  const saveEdit = async () => { if (editing !== null && await action(`/tasks/${editing}`, 'PATCH', { title: editTitle.trim(), due: editDue || null })) setEditing(null); };
  const addIdea = async (key: string) => action(`/planner/guide/${key}`, 'POST');
  const remove = async (id: number) => { if (await confirm(tr('Delete task?'), tr('This task will be removed from your checklist.'), tr('Delete'), true)) await action(`/tasks/${id}`, 'DELETE'); };
  const visible = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.done : filter === 'overdue' ? !t.done && t.due && t.due < today : !t.done));
  const available = (guide || []).filter(item => !item.already_added);
  const phases = ['All', ...new Set(available.map(item => item.phase))];
  const suggestions = available.filter(item => phase === 'All' || item.phase === phase);
  return <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} />}>
    <Failure error={error} retry={load} />
    <Card style={{ backgroundColor: C.primaryDark, borderColor: C.primaryDark, padding: 22 }}>
      <M style={{ color: '#F4DDE5', letterSpacing: 1, textTransform: 'uppercase' }}>{tr('OUR PLAN')}</M>
      <Text style={{ fontFamily: F.display, color: '#fff', fontSize: 29, marginTop: 6 }}>{tr('One step at a time')}</Text>
      <M style={{ color: '#F4DDE5', marginTop: 6 }}>{tr('A shared checklist for your celebration, on your schedule.')}</M>
      <View style={{ marginTop: 22 }}><View style={s.row}><M style={{ color: '#fff' }}>{done} {tr('of')} {tasks.length} {tr('done')}</M><M style={{ color: '#fff' }}>{tasks.length ? Math.round(done / tasks.length * 100) : 0}%</M></View><View style={{ marginTop: 8 }}><Bar pct={tasks.length ? done / tasks.length * 100 : 0} color={C.goldSoft} /></View></View>
    </Card>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}><View style={{ flex: 1 }}><Btn kind={mode === 'mine' ? 'primary' : 'quiet'} title={tr('My tasks')} onPress={() => setMode('mine')} /></View><View style={{ flex: 1 }}><Btn kind={mode === 'ideas' ? 'primary' : 'quiet'} title={tr('Planning ideas')} onPress={() => setMode('ideas')} /></View></View>
    {mode === 'mine' ? <>
      <View style={{ marginBottom: 6 }}><H style={{ marginVertical: 2 }}>{tr('Your checklist')}</H><M>{tr('Choose what matters and adjust any date.')}</M></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>{[['pending', 'To do'], ['overdue', 'Overdue'], ['done', 'Done'], ['all', 'All']].map(([key, label]) => <Chip key={key} label={tr(label)} on={filter === key} onPress={() => setFilter(key)} />)}</ScrollView>
      {!busy && !visible.length && <Empty icon="checklist" title={tr('No tasks here')} text={tr('Add a task or choose another filter.')} />}
      {visible.map((t, index) => <Rise key={t.id} i={index}><Card style={{ paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: t.done ? C.mute : C.ink, fontSize: 15, fontWeight: '600', textDecorationLine: t.done ? 'line-through' : 'none' }}>{t.title}</Text><M style={{ marginTop: 5 }}>{dateLabel(t.due)}</M></View><Tag tone={t.done ? 'ok' : t.due && t.due < today ? 'warn' : 'mute'} label={t.done ? tr('Done') : t.due && t.due < today ? tr('Overdue') : t.due === today ? tr('Today') : tr('To do')} /></View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><View style={{ flex: 1 }}><Btn small kind={t.done ? 'quiet' : 'primary'} icon={t.done ? 'checklist' : 'check'} title={t.done ? tr('Reopen') : tr('Mark done')} disabled={saving} onPress={() => action(`/tasks/${t.id}`, 'PATCH', { done: !t.done })} /></View><View style={{ flex: 1 }}><Btn small kind="ghost" title={tr('Edit')} disabled={saving} onPress={() => { setEditing(editing === t.id ? null : t.id); setEditTitle(t.title); setEditDue(t.due || ''); }} /></View></View>
        {editing === t.id && <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 }}><Input label={tr('Task name')} value={editTitle} onChangeText={setEditTitle} maxLength={200} /><Input label={tr('Due date (optional)')} value={editDue} onChangeText={setEditDue} placeholder="YYYY-MM-DD" maxLength={10} /><Btn small title={tr('Save task')} disabled={saving || !editTitle.trim()} onPress={saveEdit} /><Btn small kind="quiet" title={tr('Delete task')} disabled={saving} onPress={() => remove(t.id)} /></View>}
      </Card></Rise>)}
      <Card style={{ marginTop: 8 }}><H style={{ fontSize: 20, marginTop: 0 }}>{tr('Add your own')}</H><Input label={tr('Task name')} value={title} onChangeText={setTitle} placeholder={tr('What needs to be done?')} maxLength={200} /><Input label={tr('Due date (optional)')} value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" maxLength={10} /><Btn title={tr('Add task')} disabled={saving || !title.trim()} onPress={add} /></Card>
    </> : <>
      <H style={{ marginBottom: 2 }}>{tr('Planning ideas')}</H><M style={{ marginBottom: 14 }}>{tr('Suggested timing follows your wedding date. Choose only what suits you.')}</M>
      <Failure error={guideError} retry={loadGuide} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{phases.map(key => <Chip key={key} label={tr(key)} on={phase === key} onPress={() => setPhase(key)} />)}</ScrollView>
      {suggestions.length ? suggestions.map((item, index) => <Rise key={item.key} i={index}><Card style={{ borderLeftWidth: 3, borderLeftColor: C.gold, paddingVertical: 14 }}><M style={{ color: C.gold, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 }}>{tr(item.phase)}</M><Text style={{ color: C.ink, fontWeight: '600', fontSize: 16, marginTop: 5 }}>{tr(item.title)}</Text><View style={[s.row, { marginTop: 10 }]}><M>{item.is_catch_up ? tr('Start now') : `${tr('Suggested by')} ${dateLabel(item.due)}`}</M><View style={{ minWidth: 88 }}><Btn small kind="quiet" icon="plus" title={tr('Add')} disabled={saving} onPress={() => addIdea(item.key)} /></View></View></Card></Rise>) : <Empty icon="checklist" title={tr('All ideas added')} text={tr('Your checklist has every suggestion in this section.')} />}
      <M style={{ marginTop: 4 }}>{tr('Inspired by the Brides wedding-planning timeline; adapted for flexible, multi-event celebrations.')}</M>
    </>}
  </ScrollView>;
}

export function BudgetManager() {
  const { data: b, busy, error, load } = usePlanner<any>('/budget');
  const [editing, setEditing] = useState(false); const [total, setTotal] = useState(''); const [amounts, setAmounts] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false);
  const edit = () => { setTotal(String(b.total_paise / 100)); setAmounts(Object.fromEntries(b.rows.map((r: any) => [r.category, String(r.allocated_paise / 100)]))); setEditing(true); };
  const save = async () => { setSaving(true); try { await api('/budget', 'PUT', { total_paise: rupees(total), rows: b.rows.map((r: any) => ({ category: r.category, allocated_paise: rupees(amounts[r.category]) })) }); setEditing(false); await load(); } catch (e) { err(e); } finally { setSaving(false); } };
  const booked = b?.rows.reduce((sum: number, r: any) => sum + r.booked_paise, 0) || 0;
  const paid = b?.rows.reduce((sum: number, r: any) => sum + r.paid_paise, 0) || 0;
  const allocated = b?.rows.reduce((sum: number, r: any) => sum + r.allocated_paise, 0) || 0;
  return <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} />}>
    <Failure error={error} retry={load} />
    {!b ? <M>{tr('Loading your budget…')}</M> : <>
      <Card><M>{tr('Total budget')}</M><H style={{ fontSize: 30 }}>{inr(b.total_paise)}</H>
        <View style={s.row}><M>{tr('Booked')} {inr(booked)}</M><M>{tr('Paid')} {inr(paid)}</M></View>
        <View style={{ marginVertical: 12 }}><Bar pct={Math.min(100, booked / b.total_paise * 100)} color={booked > b.total_paise ? C.warn : C.primary} /></View>
        <M>{tr('Unallocated buffer')}: {inr(b.total_paise - allocated)}</M>
        {!editing && <Btn kind="quiet" title={tr('Edit allocations')} onPress={edit} />}
      </Card>
      {editing && <Input label={tr('Total budget (₹)')} value={total} onChangeText={setTotal} keyboardType="decimal-pad" />}
      {b.rows.map((r: any) => <Card key={r.category}><View style={s.row}><Text style={{ color: C.ink, fontWeight: '700' }}>{tr(r.category)}</Text><M>{inr(r.allocated_paise)}</M></View>
        {editing ? <Input label={tr('Allocation (₹)')} value={amounts[r.category]} onChangeText={value => setAmounts({ ...amounts, [r.category]: value })} keyboardType="decimal-pad" /> : <>
          <View style={{ marginVertical: 12 }}><Bar pct={r.allocated_paise ? Math.min(100, r.booked_paise / r.allocated_paise * 100) : r.booked_paise ? 100 : 0} color={r.booked_paise > r.allocated_paise ? C.warn : C.primary} /></View>
          <View style={s.row}><M>{tr('Booked')} {inr(r.booked_paise)}</M><M>{tr('Due')} {inr(r.due_paise)}</M></View>
          {r.booked_paise > r.allocated_paise && <Tag tone="warn" label={tr('Over budget')} />}
        </>}
      </Card>)}
      {editing && <><Btn title={tr('Save budget')} disabled={saving} onPress={save} /><Btn kind="ghost" title={tr('Cancel')} disabled={saving} onPress={() => setEditing(false)} /></>}
    </>}
  </ScrollView>;
}

export function WeddingSettings({ wedding, onSaved }: { wedding: any; onSaved: () => void }) {
  const [title, setTitle] = useState(wedding.title); const [date, setDate] = useState(wedding.date); const [city, setCity] = useState(wedding.city); const [guests, setGuests] = useState(String(wedding.guests_est)); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api('/wedding', 'PATCH', { title, date, city, guests_est: Number(guests) }); onSaved(); } catch (e) { err(e); } finally { setBusy(false); } };
  return <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled"><H>{tr('Wedding details')}</H>
    <Input label={tr('Couple names')} value={title} onChangeText={setTitle} maxLength={120} /><Input label={tr('Wedding date (YYYY-MM-DD)')} value={date} onChangeText={setDate} maxLength={10} placeholder="YYYY-MM-DD" /><M style={{ marginBottom: 12 }}>{tr('Changing this date updates planning suggestions. Tasks already on your checklist keep their dates so you can adjust them yourself.')}</M><Input label={tr('City')} value={city} onChangeText={setCity} maxLength={80} />
    <Input label={tr('Estimated guests')} value={guests} onChangeText={setGuests} keyboardType="number-pad" />
    <Btn title={tr('Save details')} disabled={busy || !title.trim() || !city.trim()} onPress={save} />
  </ScrollView>;
}
