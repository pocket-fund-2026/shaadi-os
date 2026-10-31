import { z } from 'zod';
import { db, q, one, run } from './db.ts';
import { GUIDE, guideForWedding } from './planning-guide.ts';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a real calendar date');
const money = z.number().int().nonnegative().max(100_000_000_000);
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
// Vendor services tracked on the roadmap, in the order couples usually book them.
const ROADMAP_CATEGORIES = ['venue', 'caterer', 'photographer', 'decor', 'makeup', 'mehndi', 'dj', 'pandit'];

export function mountPlanner(app: any, auth: any, myWedding: (id: number) => any, wrap: any) {
  const wedding = (req: any) => {
    const w = myWedding(req.user.id);
    if (!w) throw fail(400, 'Create your wedding first');
    return w;
  };
  app.get('/api/planner/guide', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    res.json(guideForWedding(w.date, q('SELECT title FROM tasks WHERE wedding_id=?', w.id), new Date(), w.community));
  }));
  app.post('/api/planner/guide/:key', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    const item = guideForWedding(w.date, q('SELECT title FROM tasks WHERE wedding_id=?', w.id), new Date(), w.community).find(item => item.key === req.params.key);
    if (!item) throw fail(404, 'Suggestion not found');
    if (item.already_added) throw fail(409, 'Already in your checklist');
    run('INSERT INTO tasks(wedding_id,title,due) VALUES(?,?,?)', w.id, item.title, item.due);
    res.status(201).json({ ok: true, title: item.title, due: item.due });
  }));
  // One view of the whole wedding: where each vendor service stands, and a month-by-month timeline to the day.
  app.get('/api/planner/roadmap', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    const today = new Date().toISOString().slice(0, 10);
    const alloc: Record<string, number> = Object.fromEntries(q('SELECT category,allocated_paise FROM budget_items WHERE wedding_id=?', w.id).map((r: any) => [r.category, r.allocated_paise]));
    const booked = q(`SELECT v.category,v.name,b.total_paise FROM bookings b JOIN vendors v ON v.id=b.vendor_id WHERE b.wedding_id=? AND b.status!='cancelled' ORDER BY b.id`, w.id);
    const enquired = q(`SELECT v.category,v.name,e.id,(SELECT COUNT(*) FROM quotes x WHERE x.enquiry_id=e.id AND x.status='sent') quotes FROM enquiries e JOIN vendors v ON v.id=e.vendor_id WHERE e.wedding_id=? AND e.status!='booked' ORDER BY e.id DESC`, w.id);
    const shortlisted = q('SELECT v.category,COUNT(*) n FROM shortlist s JOIN vendors v ON v.id=s.vendor_id WHERE s.wedding_id=? GROUP BY v.category', w.id);
    // A service paid outside the app (cash to a local caterer, say) counts as booked too.
    const outside = q('SELECT category, payee, amount_paise FROM expenses WHERE wedding_id=? ORDER BY id', w.id);
    const vendors = ROADMAP_CATEGORIES.map(category => {
      const b = [...booked.filter((x: any) => x.category === category), ...outside.filter((x: any) => x.category === category).map((x: any) => ({ name: `${x.payee} (outside the app)`, total_paise: x.amount_paise }))]; const e = enquired.filter((x: any) => x.category === category);
      const sl = shortlisted.find((x: any) => x.category === category)?.n || 0;
      return { category, stage: b.length ? 'booked' : e.length ? 'enquired' : sl ? 'shortlisted' : 'not_started',
        allocated_paise: alloc[category] ?? null, booked_paise: b.reduce((sum: number, x: any) => sum + x.total_paise, 0), booked_vendor: b[0]?.name ?? null,
        enquiries: e.length, quotes: e.reduce((sum: number, x: any) => sum + x.quotes, 0), enquiry_id: e[0]?.id ?? null, enquiry_vendor: e[0]?.name ?? null, shortlisted: sl };
    });
    const tasks = q("SELECT id,title,due FROM tasks WHERE wedding_id=? AND done=0 ORDER BY COALESCE(due,'9999-12-31'),id", w.id);
    const events = q("SELECT id,name,date,venue FROM events WHERE wedding_id=? AND date IS NOT NULL AND date!='' AND date>=? ORDER BY date,sort", w.id, today);
    // Months run from now to the later of the wedding month and the last task's month, capped at three years.
    const now = today.slice(0, 7);
    const last = [w.date?.slice(0, 7), ...tasks.map((t: any) => t.due?.slice(0, 7)), ...events.map((e: any) => e.date.slice(0, 7))].filter(Boolean).sort().pop() || now;
    const months: any[] = [];
    for (let y = +now.slice(0, 4), m = +now.slice(5, 7); months.length < 36; m === 12 ? (y++, m = 1) : m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`; if (key > (last > now ? last : now)) break;
      months.push({ month: key, wedding: w.date?.slice(0, 7) === key ? w.date : null, tasks: [], events: [] });
    }
    for (const t of tasks) {
      if (!t.due) continue;
      const bucket = months.find(m => m.month === (t.due < today ? now : t.due.slice(0, 7)));
      bucket?.tasks.push({ ...t, overdue: t.due < today });
    }
    for (const e of events) months.find(m => m.month === e.date.slice(0, 7))?.events.push(e);
    res.json({ wedding: w, vendors, booked_count: vendors.filter(v => v.stage === 'booked').length, months, unscheduled: tasks.filter((t: any) => !t.due) });
  }));
  // Payments made outside the app, so the budget shows what is really spent.
  const expenseBody = z.object({ category: z.string().trim().min(1).max(40), payee: z.string().trim().min(1).max(120), amount_paise: money.positive(), paid: z.boolean().default(true), note: z.string().trim().max(300).optional() });
  app.get('/api/expenses', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM expenses WHERE wedding_id=? ORDER BY id DESC', wedding(req).id))));
  app.post('/api/expenses', auth, wrap((req: any, res: any) => {
    const w = wedding(req); const b = expenseBody.parse(req.body);
    if (!one('SELECT 1 x FROM budget_items WHERE wedding_id=? AND category=?', w.id, b.category)) throw fail(400, 'Choose one of your budget categories');
    res.status(201).json({ id: Number(run('INSERT INTO expenses(wedding_id,category,payee,amount_paise,paid,note) VALUES(?,?,?,?,?,?)', w.id, b.category, b.payee, b.amount_paise, b.paid ? 1 : 0, b.note || '').lastInsertRowid) });
  }));
  app.patch('/api/expenses/:id', auth, wrap((req: any, res: any) => {
    const { paid } = z.object({ paid: z.boolean() }).parse(req.body);
    if (!run('UPDATE expenses SET paid=? WHERE id=? AND wedding_id=?', paid ? 1 : 0, req.params.id, wedding(req).id).changes) throw fail(404, 'Expense not found'); res.json({ ok: true });
  }));
  app.delete('/api/expenses/:id', auth, wrap((req: any, res: any) => {
    if (!run('DELETE FROM expenses WHERE id=? AND wedding_id=?', req.params.id, wedding(req).id).changes) throw fail(404, 'Expense not found'); res.json({ ok: true });
  }));
  app.get('/api/planner/overview', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    const tasks = q('SELECT * FROM tasks WHERE wedding_id=? ORDER BY COALESCE(due,\'9999-12-31\'),id', w.id);
    const totals = one("SELECT COALESCE(SUM(b.total_paise),0) booked FROM bookings b WHERE wedding_id=? AND status!='cancelled'", w.id);
    const paid = one("SELECT COALESCE(SUM(m.amount_paise),0) amount FROM milestones m JOIN bookings b ON b.id=m.booking_id WHERE b.wedding_id=? AND b.status!='cancelled' AND m.status IN ('held','released')", w.id).amount;
    const guests = one("SELECT COUNT(*) invited,COALESCE(SUM(CASE WHEN rsvp='yes' THEN 1+plus_ones ELSE 0 END),0) attending,COALESCE(SUM(CASE WHEN rsvp='pending' THEN 1 ELSE 0 END),0) waiting FROM guests WHERE wedding_id=?", w.id);
    const today = new Date().toISOString().slice(0, 10);
    res.json({ wedding: w, days_left: Math.ceil((new Date(w.date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 864e5),
      tasks: { total: tasks.length, done: tasks.filter(t => t.done).length, overdue: tasks.filter(t => !t.done && t.due && t.due < today).length, upcoming: tasks.filter(t => !t.done).slice(0, 5) },
      budget: (() => { const out = one('SELECT COALESCE(SUM(amount_paise),0) committed, COALESCE(SUM(CASE WHEN paid=1 THEN amount_paise ELSE 0 END),0) paid FROM expenses WHERE wedding_id=?', w.id);
        return { total_paise: w.budget_paise, booked_paise: totals.booked + out.committed, paid_paise: paid + out.paid, remaining_paise: w.budget_paise - totals.booked - out.committed }; })(), guests,
      events: q('SELECT * FROM events WHERE wedding_id=? AND date>=? ORDER BY date,sort LIMIT 3', w.id, today),
      shortlisted: one('SELECT COUNT(*) count FROM shortlist WHERE wedding_id=?', w.id).count });
  }));
  app.patch('/api/wedding', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    const b = z.object({ title: z.string().trim().min(2).max(120), date: dateSchema.optional(), city: z.string().trim().min(1).max(80), guests_est: z.number().int().min(1).max(100000) }).parse(req.body);
    run('UPDATE weddings SET title=?,date=?,city=?,guests_est=? WHERE id=?', b.title, b.date || w.date, b.city, b.guests_est, w.id);
    res.json(myWedding(req.user.id));
  }));
  app.put('/api/budget', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    const b = z.object({ total_paise: money.positive(), rows: z.array(z.object({ category: z.string().min(1), allocated_paise: money })).min(1).max(30) }).parse(req.body);
    const categories = q('SELECT category FROM budget_items WHERE wedding_id=?', w.id).map(i => i.category);
    if (b.rows.length !== categories.length || new Set(b.rows.map(r => r.category)).size !== categories.length || b.rows.some(r => !categories.includes(r.category))) throw fail(400, 'Include each existing budget category once');
    if (b.rows.reduce((sum, row) => sum + row.allocated_paise, 0) > b.total_paise) throw fail(400, 'Allocations exceed your total budget');
    db.exec('BEGIN');
    try {
      run('UPDATE weddings SET budget_paise=? WHERE id=?', b.total_paise, w.id);
      for (const row of b.rows) run('UPDATE budget_items SET allocated_paise=? WHERE wedding_id=? AND category=?', row.allocated_paise, w.id, row.category);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.json({ ok: true });
  }));
  app.delete('/api/tasks/:id', auth, wrap((req: any, res: any) => {
    if (!run('DELETE FROM tasks WHERE id=? AND wedding_id=?', req.params.id, wedding(req).id).changes) throw fail(404, 'Task not found');
    res.json({ ok: true });
  }));
}
