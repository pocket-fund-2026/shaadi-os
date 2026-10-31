import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, RefreshControl } from 'react-native';
import { api } from './api';
import { tr } from './i18n';
import { Bar, Btn, C, Card, Chip, Empty, F, H, Input, M, Rise, Tag, confirm, err, inr, s, dateIN, DateField, todayISO } from './ui';
import { FloralArch } from './visuals';
import { Icon, IconName } from './icons';
import { categoryLabel } from './marketplace';

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

const STAGE: Record<string, { label: string; tone: 'ok' | 'gold' | 'mute'; icon: IconName }> = {
  booked: { label: 'Booked', tone: 'ok', icon: 'check' }, enquired: { label: 'Enquired', tone: 'gold', icon: 'chat' },
  shortlisted: { label: 'Shortlisted', tone: 'mute', icon: 'heart' }, not_started: { label: 'Not started', tone: 'mute', icon: 'plus' },
};
// Words in a task title that tie it to a vendor service, so "Book venue" can offer the right next step.
const TASK_SERVICE: [RegExp, string][] = [[/venue/i, 'venue'], [/cater/i, 'caterer'], [/photograph/i, 'photographer'], [/decor/i, 'decor'], [/makeup/i, 'makeup'], [/mehndi|mehendi/i, 'mehndi'], [/\bdj\b|music/i, 'dj'], [/pandit|priest/i, 'pandit']];
const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// The single most urgent open task (overdue first, then by date), with the action that moves it forward.
function UpNext({ roadmap, open, nav }: { roadmap: any; open: (tab: string) => void; nav: any }) {
  const tasks = roadmap.months.flatMap((m: any) => m.tasks).sort((a: any, b: any) => Number(!!b.overdue) - Number(!!a.overdue) || String(a.due).localeCompare(String(b.due)));
  const task = tasks[0];
  if (!task) return null;
  const service = TASK_SERVICE.find(([re]) => re.test(task.title))?.[1];
  const v = service ? roadmap.vendors.find((x: any) => x.category === service) : null;
  const label = categoryLabel(service || '').toLowerCase();
  const action = !v || v.stage === 'booked' ? { title: tr('Open checklist'), go: () => open('checklist') }
    : v.stage === 'enquired' && v.enquiry_id ? { title: tr('Open chat'), go: () => nav.navigate('Chat', { id: v.enquiry_id, title: v.enquiry_vendor }) }
    : v.stage === 'shortlisted' ? { title: `${tr('Compare')} ${v.shortlisted} ${tr('shortlisted')}`, go: () => open('shortlist') }
    : { title: `${tr('Find')} ${label}`, go: () => nav.navigate('Discover', { category: service, at: Date.now() }) };
  return <Card style={{ borderColor: task.overdue ? C.warn : C.line }}>
    <View style={s.row}><M>{tr('Up next')}</M>{task.overdue ? <Tag tone="warn" label={`${tr('Overdue since')} ${dateLabel(task.due)}`} /> : <Tag label={dateLabel(task.due)} />}</View>
    <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, marginTop: 4 }}>{task.title}</Text>
    {v && v.stage !== 'booked' ? <M style={{ marginTop: 2 }}>{categoryLabel(service!)}: {tr(STAGE[v.stage].label).toLowerCase()}</M> : null}
    <Btn title={action.title} onPress={action.go} />
  </Card>;
}

// The whole wedding on one screen: where each vendor service stands, then a month-by-month timeline to the day.
export function Overview({ open, nav }: { open: (tab: string) => void; nav: any }) {
  const { data: d, busy, error, load } = usePlanner<any>('/planner/overview');
  const { data: r, load: loadRoadmap, error: roadmapError } = usePlanner<any>('/planner/roadmap');
  const refresh = () => { load(); loadRoadmap(); };
  return <ScrollView contentContainerStyle={content} refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} tintColor={C.primary} />}>
    <Failure error={error || roadmapError} retry={refresh} />
    {!d ? <M>{tr('Loading your overview…')}</M> : <>
      <Card style={{ backgroundColor: C.primaryDark, borderColor: C.primaryDark, overflow: 'hidden', padding: 24 }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -36, top: -20, opacity: 0.25 }}><FloralArch size={180} /></View>
        <M style={{ color: '#F4DDE5' }}>{tr('Wedding countdown')}</M>
        <Text style={{ fontFamily: F.display, fontSize: 34, color: '#fff', marginVertical: 8 }}>{d.days_left > 0 ? `${d.days_left} ${tr('days to go')}` : d.days_left === 0 ? tr('Today is the day') : tr('Just married')}</Text>
        <M style={{ color: '#F4DDE5' }}>{dateLabel(d.wedding.date)} · {d.wedding.city} · {d.wedding.guests_est} {tr('guests')}</M>
        <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#A66B7E', paddingTop: 16 }}>
          <View style={s.row}><M style={{ color: '#F4DDE5' }}>{tr('Your planning progress')}</M><Text style={{ color: '#fff', fontWeight: '500', fontVariant: ['tabular-nums'] }}>{d.tasks.total ? Math.round(d.tasks.done / d.tasks.total * 100) : 0}%</Text></View>
          <View style={{ marginTop: 12 }}><Bar pct={d.tasks.total ? d.tasks.done / d.tasks.total * 100 : 0} color={C.goldSoft} /></View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[[`${d.tasks.done}/${d.tasks.total}`, tr('Tasks'), 'checklist', d.tasks.overdue ? `${d.tasks.overdue} ${tr('Overdue')}` : ''], [String(d.guests.attending), tr('Guests coming'), 'guests', ''], [inr(d.budget.remaining_paise), tr('Left to book'), 'budget', d.budget.remaining_paise < 0 ? tr('Over budget') : '']].map(([value, label, tab, warn]) =>
          <Card key={tab} onPress={() => open(tab)} style={{ flex: 1, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <M style={{ marginTop: 2 }}>{label}</M>{warn ? <M style={{ color: C.warn, marginTop: 2 }}>{warn}</M> : null}
          </Card>)}
      </View>

      {r ? <UpNext roadmap={r} open={open} nav={nav} /> : null}
      <View style={[s.row, { marginTop: 8 }]}><H style={{ marginVertical: 8 }}>{tr('Vendors')}</H>{r ? <M style={{ fontVariant: ['tabular-nums'] }}>{r.booked_count} {tr('of')} {r.vendors.length} {tr('booked')}</M> : null}</View>
      {r ? <Card style={{ paddingVertical: 4 }}>{r.vendors.map((v: any, i: number) => {
        const st = STAGE[v.stage];
        const action = v.stage === 'not_started' ? { title: tr('Find'), go: () => nav.navigate('Discover', { category: v.category, at: Date.now() }) }
          : v.stage === 'shortlisted' ? { title: tr('Compare'), go: () => open('shortlist') }
          : v.stage === 'enquired' && v.enquiry_id ? { title: tr('Open chat'), go: () => nav.navigate('Chat', { id: v.enquiry_id, title: v.enquiry_vendor }) } : null;
        const detail = v.stage === 'booked' ? `${v.booked_vendor}${v.allocated_paise ? ` · ${inr(v.booked_paise)} ${tr('of')} ${inr(v.allocated_paise)}` : ''}`
          : v.stage === 'enquired' ? `${v.enquiries} ${tr(v.enquiries === 1 ? 'enquiry' : 'enquiries')}${v.quotes ? ` · ${v.quotes} ${tr(v.quotes === 1 ? 'quote to review' : 'quotes to review')}` : ''}`
          : v.stage === 'shortlisted' ? `${v.shortlisted} ${tr('shortlisted')}` : v.allocated_paise ? `${tr('Budget')} ${inr(v.allocated_paise)}` : '';
        return <View key={v.category} style={[s.row, { paddingVertical: 12, gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{categoryLabel(v.category)}</Text><Tag tone={st.tone} icon={st.icon} label={tr(st.label)} /></View>
            {detail ? <M style={{ marginTop: 4 }} numberOfLines={2}>{detail}</M> : null}
          </View>
          {action ? <Btn small kind="quiet" title={action.title} onPress={action.go} /> : null}
        </View>; })}</Card> : <M>{tr('Loading your vendors…')}</M>}

      <H style={{ marginTop: 16 }}>{tr('Timeline')}</H>
      {r ? r.months.map((m: any, i: number) => <View key={m.month} style={{ flexDirection: 'row' }}>
        <View style={{ width: 24, alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 6, backgroundColor: i === 0 ? C.primary : m.wedding ? C.gold : C.card, borderWidth: 2, borderColor: i === 0 ? C.primary : m.wedding ? C.gold : C.line }} />
          {i < r.months.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: C.line, marginTop: 4 }} /> : null}
        </View>
        <View style={{ flex: 1, paddingLeft: 8, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>{monthLabel(m.month)}</Text>{i === 0 ? <Tag tone="gold" label={tr('This month')} /> : null}</View>
          {[...m.events.map((e: any) => ({ kind: 'event', date: e.date, e })), ...m.tasks.map((t: any) => ({ kind: 'task', date: t.overdue ? '' : t.due, t })), ...(m.wedding ? [{ kind: 'wedding', date: m.wedding + '~' }] : [])]
            .sort((x: any, y: any) => x.date.localeCompare(y.date)).map((item: any) => item.kind === 'wedding'
              ? <View key="wedding" style={{ flexDirection: 'row', gap: 8, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: C.goldSoft }}><Icon name="ring" size={18} color={C.gold} /><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500', flex: 1 }}>{tr('Wedding day')} · {dateIN(m.wedding)}</Text></View>
              : item.kind === 'event'
              ? <Pressable key={'e' + item.e.id} accessibilityRole="button" onPress={() => open('events')} style={{ flexDirection: 'row', gap: 8, marginTop: 8, minHeight: 32, alignItems: 'flex-start' }}>
                <Icon name="marigold" size={18} color={C.gold} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{item.e.name}</Text><M>{dateIN(item.e.date)}{item.e.venue ? ` · ${item.e.venue}` : ''}</M></View></Pressable>
              : <Pressable key={'t' + item.t.id} accessibilityRole="button" onPress={() => open('checklist')} style={{ flexDirection: 'row', gap: 8, marginTop: 8, minHeight: 32, alignItems: 'flex-start' }}>
                <Icon name="checklist" size={18} color={item.t.overdue ? C.warn : C.mute} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15 }}>{item.t.title}</Text><M style={{ color: item.t.overdue ? C.warn : C.mute }}>{item.t.overdue ? `${tr('Overdue')} · ${dateIN(item.t.due)}` : dateIN(item.t.due)}</M></View></Pressable>)}
          {!m.events.length && !m.tasks.length && !m.wedding ? <M style={{ marginTop: 4 }}>{tr('Nothing planned yet')}</M> : null}
        </View>
      </View>) : null}
      {r?.unscheduled.length ? <Btn kind="quiet" icon="calendar" title={`${r.unscheduled.length} ${tr('tasks without a date')}`} onPress={() => open('checklist')} /> : null}
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
  // The three most urgent ideas surface in the plan card itself: catch-up items first, then by suggested date.
  const nextUp = [...available].sort((a, b) => Number(!!b.is_catch_up) - Number(!!a.is_catch_up) || String(a.due || '9999').localeCompare(String(b.due || '9999'))).slice(0, 3);
  return <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} />}>
    <Failure error={error} retry={load} />
    <Card>
      <M>{tr('Checklist')}</M>
      <Text style={{ fontFamily: F.display, color: C.ink, fontSize: 24, marginTop: 4 }}>{done} {tr('of')} {tasks.length} {tr('tasks done')}</Text>
      <M style={{ marginTop: 4 }}>{tr('Suggested tasks are timed from your wedding date. Add your own at the bottom.')}</M>
      <View style={{ marginTop: 16 }}><View><Bar pct={tasks.length ? done / tasks.length * 100 : 0} /></View></View>
      {mode === 'mine' && nextUp.length > 0 && <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
        <Text style={{ color: C.ink, fontSize: 15, fontWeight: '500', marginBottom: 4 }}>{tr('Suggested next steps')}</Text>
        {nextUp.map(item => <View key={item.key} style={[s.row, { paddingVertical: 8, gap: 12 }]}>
          <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15 }}>{tr(item.title)}</Text><M style={{ marginTop: 2, color: item.is_catch_up ? C.warn : C.mute }}>{item.is_catch_up ? tr('Start now') : `${tr('Suggested by')} ${dateLabel(item.due)}`}</M></View>
          <Btn small kind="quiet" icon="plus" title={tr('Add')} disabled={saving} onPress={() => addIdea(item.key)} />
        </View>)}
        {available.length > nextUp.length && <Pressable accessibilityRole="button" onPress={() => setMode('ideas')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, minHeight: 32 }}>
          <Text style={{ color: C.primary, fontSize: 13, fontWeight: '500' }}>{tr('See all planning ideas')} ({available.length})</Text><Icon name="chevron" size={16} color={C.primary} />
        </Pressable>}
      </View>}
    </Card>
    <View style={{ flexDirection: 'row', marginBottom: 8 }}><Chip label={tr('My tasks')} on={mode === 'mine'} onPress={() => setMode('mine')} /><Chip label={tr('Planning ideas')} on={mode === 'ideas'} onPress={() => setMode('ideas')} /></View>
    {mode === 'mine' ? <>
      <View style={{ marginBottom: 8 }}><H style={{ marginVertical: 2 }}>{tr('Your checklist')}</H><M>{tr('Choose what matters and adjust any date.')}</M></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{[['pending', 'To do'], ['overdue', 'Overdue'], ['done', 'Done'], ['all', 'All']].map(([key, label]) => <Chip key={key} label={tr(label)} on={filter === key} onPress={() => setFilter(key)} />)}</ScrollView>
      {!busy && !visible.length && <Empty icon="checklist" title={tr('No tasks here')} text={tr('Add a task or choose another filter.')} />}
      {visible.map((t, index) => <Rise key={t.id} i={index}><Card style={{ paddingVertical: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: t.done ? C.mute : C.ink, fontSize: 15, fontWeight: '500', textDecorationLine: t.done ? 'line-through' : 'none' }}>{t.title}</Text><M style={{ marginTop: 4 }}>{dateLabel(t.due)}</M></View><Tag tone={t.done ? 'ok' : t.due && t.due < today ? 'warn' : 'mute'} label={t.done ? tr('Done') : t.due && t.due < today ? tr('Overdue') : t.due === today ? tr('Today') : tr('To do')} /></View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><View style={{ flex: 1 }}><Btn small kind="quiet" icon={t.done ? 'checklist' : 'check'} title={t.done ? tr('Reopen') : tr('Mark done')} disabled={saving} onPress={() => action(`/tasks/${t.id}`, 'PATCH', { done: !t.done })} /></View><View style={{ flex: 1 }}><Btn small kind="ghost" title={tr('Edit')} disabled={saving} onPress={() => { setEditing(editing === t.id ? null : t.id); setEditTitle(t.title); setEditDue(t.due || ''); }} /></View></View>
        {editing === t.id && <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 }}><Input label={tr('Task name')} value={editTitle} onChangeText={setEditTitle} maxLength={200} /><DateField label={tr('Due date (optional)')} value={editDue || ''} onChange={setEditDue} optional /><Btn small title={tr('Save task')} disabled={saving || !editTitle.trim()} onPress={saveEdit} /><Btn small kind="quiet" title={tr('Delete task')} disabled={saving} onPress={() => remove(t.id)} /></View>}
      </Card></Rise>)}
      <Card style={{ marginTop: 8 }}><H style={{ fontSize: 20, marginTop: 0 }}>{tr('Add your own')}</H><Input label={tr('Task name')} value={title} onChangeText={setTitle} placeholder={tr('What needs to be done?')} maxLength={200} /><DateField label={tr('Due date (optional)')} value={due} onChange={setDue} optional /><Btn title={tr('Add task')} disabled={saving || !title.trim()} onPress={add} /></Card>
    </> : <>
      <H style={{ marginBottom: 2 }}>{tr('Planning ideas')}</H><M style={{ marginBottom: 16 }}>{tr('Suggested timing follows your wedding date. Choose only what suits you.')}</M>
      <Failure error={guideError} retry={loadGuide} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{phases.map(key => <Chip key={key} label={tr(key)} on={phase === key} onPress={() => setPhase(key)} />)}</ScrollView>
      {suggestions.length ? suggestions.map((item, index) => <Rise key={item.key} i={index}><Card style={{ borderLeftWidth: 3, borderLeftColor: C.gold, paddingVertical: 16 }}><M style={{ color: C.gold, fontWeight: '500' }}>{tr(item.phase)}</M><Text style={{ color: C.ink, fontWeight: '500', fontSize: 17, marginTop: 4 }}>{tr(item.title)}</Text><View style={[s.row, { marginTop: 12 }]}><M>{item.is_catch_up ? tr('Start now') : `${tr('Suggested by')} ${dateLabel(item.due)}`}</M><View style={{ minWidth: 88 }}><Btn small kind="quiet" icon="plus" title={tr('Add')} disabled={saving} onPress={() => addIdea(item.key)} /></View></View></Card></Rise>) : <Empty icon="checklist" title={tr('All ideas added')} text={tr('Your checklist has every suggestion in this section.')} />}
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
  return <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.primary} />}>
    <Failure error={error} retry={load} />
    {!b ? <M>{tr('Loading your budget…')}</M> : <>
      <Card><M>{tr('Total budget')}</M><H style={{ fontSize: 28 }}>{inr(b.total_paise)}</H>
        <View style={s.row}><M>{tr('Booked')} {inr(booked)}</M><M>{tr('Paid')} {inr(paid)}</M></View>
        <View style={{ marginVertical: 12 }}><Bar pct={Math.min(100, booked / b.total_paise * 100)} color={booked > b.total_paise ? C.warn : C.primary} /></View>
        <M>{tr('Unallocated buffer')}: {inr(b.total_paise - allocated)}</M>
        {!editing && <Btn kind="quiet" title={tr('Edit allocations')} onPress={edit} />}
      </Card>
      {editing && <Input label={tr('Total budget (₹)')} value={total} onChangeText={setTotal} keyboardType="decimal-pad" />}
      {b.rows.map((r: any) => <Card key={r.category}><View style={s.row}><Text style={{ color: C.ink, fontWeight: '500' }}>{categoryLabel(r.category)}</Text><M>{inr(r.allocated_paise)}</M></View>
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
  return <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><H>{tr('Wedding details')}</H>
    <Input label={tr('Couple names')} value={title} onChangeText={setTitle} maxLength={120} /><DateField label={tr('Wedding date')} value={date} onChange={setDate} min={todayISO()} /><M style={{ marginBottom: 12 }}>{tr('Changing this date updates planning suggestions. Tasks already on your checklist keep their dates so you can adjust them yourself.')}</M><Input label={tr('City')} value={city} onChangeText={setCity} maxLength={80} />
    <Input label={tr('Estimated guests')} value={guests} onChangeText={setGuests} keyboardType="number-pad" />
    <Btn title={tr('Save details')} disabled={busy || !title.trim() || !city.trim()} onPress={save} />
  </ScrollView>;
}
