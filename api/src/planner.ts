import { z } from 'zod';
import { db, q, one, run } from './db.ts';
import { GUIDE, guideForWedding } from './planning-guide.ts';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a real calendar date');
const money = z.number().int().nonnegative().max(100_000_000_000);
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

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
  app.get('/api/planner/overview', auth, wrap((req: any, res: any) => {
    const w = wedding(req);
    const tasks = q('SELECT * FROM tasks WHERE wedding_id=? ORDER BY COALESCE(due,\'9999-12-31\'),id', w.id);
    const totals = one("SELECT COALESCE(SUM(b.total_paise),0) booked FROM bookings b WHERE wedding_id=? AND status!='cancelled'", w.id);
    const paid = one("SELECT COALESCE(SUM(m.amount_paise),0) amount FROM milestones m JOIN bookings b ON b.id=m.booking_id WHERE b.wedding_id=? AND b.status!='cancelled' AND m.status IN ('held','released')", w.id).amount;
    const guests = one("SELECT COUNT(*) invited,COALESCE(SUM(CASE WHEN rsvp='yes' THEN 1+plus_ones ELSE 0 END),0) attending,COALESCE(SUM(CASE WHEN rsvp='pending' THEN 1 ELSE 0 END),0) waiting FROM guests WHERE wedding_id=?", w.id);
    const today = new Date().toISOString().slice(0, 10);
    res.json({ wedding: w, days_left: Math.ceil((new Date(w.date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 864e5),
      tasks: { total: tasks.length, done: tasks.filter(t => t.done).length, overdue: tasks.filter(t => !t.done && t.due && t.due < today).length, upcoming: tasks.filter(t => !t.done).slice(0, 5) },
      budget: { total_paise: w.budget_paise, booked_paise: totals.booked, paid_paise: paid, remaining_paise: w.budget_paise - totals.booked }, guests,
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
