// Wedding organiser tools: reminders, shopping and trousseau list, day-of contacts, documents and seating.
import { z } from 'zod';
import { db, q, one, run } from './db.ts';

db.exec(`
CREATE TABLE IF NOT EXISTS shopping(id INTEGER PRIMARY KEY, wedding_id INT, item TEXT, kind TEXT, for_whom TEXT, buyer TEXT, budget_paise INT, spent_paise INT, bought INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS day_contacts(id INTEGER PRIMARY KEY, wedding_id INT, name TEXT, role TEXT, phone TEXT, arrival TEXT);
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY, wedding_id INT, title TEXT, done INT DEFAULT 0, sort INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS seating_tables(id INTEGER PRIMARY KEY, wedding_id INT, event_id INT, name TEXT, seats INT);
CREATE TABLE IF NOT EXISTS seat_assignments(table_id INT, guest_id INT, PRIMARY KEY(table_id, guest_id));
`);

// Typical papers for registering a Hindu or Special Marriage Act marriage. Requirements vary by state, so the app says so.
const DOCUMENTS = ['Registration application form', 'Age proof for both (birth certificate, school certificate or passport)', 'Address proof for both (Aadhaar, passport or voter ID)',
  'Passport-size photos of both', 'Wedding invitation card', 'Photo from the wedding ceremony', 'Affidavits: date of birth, marital status and nationality',
  'ID proof of witnesses', 'Registration fee receipt'];
export const ORGANISER_TABLES = ['shopping', 'day_contacts', 'documents', 'seating_tables'];

const money = z.number().int().nonnegative().max(100_000_000_000);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number').or(z.literal(''));

export function mountOrganiser(app: any, auth: any, wrap: any, ctx: { W: (req: any) => any; canEdit: (req: any, w: any) => boolean; seesMoney: (req: any, w: any) => boolean; fail: (s: number, m: string) => Error }) {
  const { W, canEdit, seesMoney, fail } = ctx;
  const editable = (req: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); return w; };
  const owned = (table: string, id: any, w: any) => { if (!one(`SELECT 1 x FROM ${table} WHERE id=? AND wedding_id=?`, id, w.id)) throw fail(404, 'Not found'); };

  // Reminders: what needs attention now, worked out from the plan itself.
  app.get('/api/reminders', auth, wrap((req: any, res: any) => {
    const w = W(req); const today = new Date().toISOString().slice(0, 10);
    const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const daysLeft = Math.ceil((new Date(w.date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 864e5);
    const items: any[] = [];
    for (const t of q("SELECT id,title,due FROM tasks WHERE wedding_id=? AND done=0 AND due IS NOT NULL AND due<=? ORDER BY due LIMIT 5", w.id, inDays(7)))
      items.push({ kind: 'task', tone: t.due < today ? 'warn' : 'gold', title: t.title, detail: t.due < today ? 'overdue' : 'due', date: t.due, open: 'checklist' });
    if (seesMoney(req, w)) {
      const due = one('SELECT COUNT(*) n, COALESCE(SUM(amount_paise),0) total FROM expenses WHERE wedding_id=? AND paid=0', w.id);
      if (due.n) items.push({ kind: 'payment', tone: 'gold', title: 'Payments still due', detail: 'payments', count: due.n, amount_paise: due.total, open: 'budget' });
    }
    const arriving = q('SELECT guest_name, check_in FROM stays WHERE wedding_id=? AND pickup=1 AND check_in BETWEEN ? AND ? ORDER BY check_in', w.id, today, inDays(7));
    if (arriving.length) items.push({ kind: 'pickup', tone: 'gold', title: 'Pickups this week', detail: 'pickups', count: arriving.length, date: arriving[0].check_in, open: 'stays' });
    const waiting = one("SELECT COUNT(*) n FROM guests WHERE wedding_id=? AND rsvp='pending'", w.id).n;
    if (waiting && daysLeft >= 0 && daysLeft <= 30) items.push({ kind: 'rsvp', tone: 'gold', title: 'Guests yet to reply', detail: 'rsvps', count: waiting, open: 'guests' });
    res.json({ days_left: daysLeft, items });
  }));

  // Shopping and trousseau: outfits, jewellery and gifts for family, with budget against spend.
  const shopBody = z.object({ item: z.string().trim().min(1).max(160), kind: z.enum(['outfit', 'jewellery', 'gift', 'other']).default('other'), for_whom: z.string().trim().max(80).optional(), buyer: z.string().trim().max(80).optional(), budget_paise: money.nullable().optional(), spent_paise: money.nullable().optional(), bought: z.boolean().default(false) });
  const shopArgs = (b: any) => [b.item, b.kind, b.for_whom || '', b.buyer || '', b.budget_paise ?? null, b.spent_paise ?? null, b.bought ? 1 : 0];
  app.get('/api/shopping', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM shopping WHERE wedding_id=? ORDER BY bought, id DESC', W(req).id))));
  app.post('/api/shopping', auth, wrap((req: any, res: any) => { const w = editable(req);
    res.status(201).json({ id: Number(run('INSERT INTO shopping(item,kind,for_whom,buyer,budget_paise,spent_paise,bought,wedding_id) VALUES(?,?,?,?,?,?,?,?)', ...shopArgs(shopBody.parse(req.body)), w.id).lastInsertRowid) }); }));
  app.put('/api/shopping/:id', auth, wrap((req: any, res: any) => { const w = editable(req); owned('shopping', req.params.id, w);
    run('UPDATE shopping SET item=?,kind=?,for_whom=?,buyer=?,budget_paise=?,spent_paise=?,bought=? WHERE id=?', ...shopArgs(shopBody.parse(req.body)), req.params.id); res.json({ ok: true }); }));

  // Day-of contacts: booked vendors (phone shared once booked), outside payees and people the couple adds.
  app.get('/api/day-contacts', auth, wrap((req: any, res: any) => {
    const w = W(req);
    const booked = q("SELECT v.name, v.category role, u.phone FROM bookings b JOIN vendors v ON v.id=b.vendor_id LEFT JOIN users u ON u.id=v.user_id WHERE b.wedding_id=? AND b.status!='cancelled'", w.id)
      .map((x: any) => ({ ...x, source: 'booking', phone: /^[6-9]\d{9}$/.test(x.phone || '') ? x.phone : '' }));
    const outside = q('SELECT DISTINCT payee name, category role FROM expenses WHERE wedding_id=?', w.id).map((x: any) => ({ ...x, phone: '', source: 'payment' }));
    res.json({ contacts: q('SELECT * FROM day_contacts WHERE wedding_id=? ORDER BY arrival, id', w.id), booked, outside });
  }));
  const contactBody = z.object({ name: z.string().trim().min(1).max(120), role: z.string().trim().max(80).optional(), phone: phone.optional(), arrival: z.string().trim().max(80).optional() });
  app.post('/api/day-contacts', auth, wrap((req: any, res: any) => { const w = editable(req); const b = contactBody.parse(req.body);
    res.status(201).json({ id: Number(run('INSERT INTO day_contacts(wedding_id,name,role,phone,arrival) VALUES(?,?,?,?,?)', w.id, b.name, b.role || '', b.phone || '', b.arrival || '').lastInsertRowid) }); }));

  // Documents for marriage registration, seeded once per wedding.
  app.get('/api/documents', auth, wrap((req: any, res: any) => {
    const w = W(req);
    if (!one('SELECT 1 x FROM documents WHERE wedding_id=?', w.id)) DOCUMENTS.forEach((title, i) => run('INSERT INTO documents(wedding_id,title,sort) VALUES(?,?,?)', w.id, title, i));
    res.json(q('SELECT * FROM documents WHERE wedding_id=? ORDER BY sort, id', w.id));
  }));
  app.post('/api/documents', auth, wrap((req: any, res: any) => { const w = editable(req); const { title } = z.object({ title: z.string().trim().min(1).max(200) }).parse(req.body);
    res.status(201).json({ id: Number(run('INSERT INTO documents(wedding_id,title,sort) VALUES(?,?,1000)', w.id, title).lastInsertRowid) }); }));
  app.patch('/api/documents/:id', auth, wrap((req: any, res: any) => { const w = editable(req); owned('documents', req.params.id, w);
    run('UPDATE documents SET done=? WHERE id=?', z.object({ done: z.boolean() }).parse(req.body).done ? 1 : 0, req.params.id); res.json({ ok: true }); }));

  // Seating: tables per ceremony; a guest sits at one table per ceremony.
  app.get('/api/seating', auth, wrap((req: any, res: any) => { const w = W(req);
    res.json({ tables: q('SELECT * FROM seating_tables WHERE wedding_id=? ORDER BY event_id, id', w.id),
      seats: q('SELECT sa.table_id, sa.guest_id FROM seat_assignments sa JOIN seating_tables t ON t.id=sa.table_id WHERE t.wedding_id=?', w.id) }); }));
  app.post('/api/seating/tables', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ event_id: z.number().int(), name: z.string().trim().min(1).max(60), seats: z.number().int().min(1).max(50) }).parse(req.body);
    if (!one('SELECT 1 x FROM events WHERE id=? AND wedding_id=?', b.event_id, w.id)) throw fail(404, 'Ceremony not found');
    res.status(201).json({ id: Number(run('INSERT INTO seating_tables(wedding_id,event_id,name,seats) VALUES(?,?,?,?)', w.id, b.event_id, b.name, b.seats).lastInsertRowid) }); }));
  app.put('/api/seating/tables/:id/guests/:guestId', auth, wrap((req: any, res: any) => { const w = editable(req);
    const t = one('SELECT * FROM seating_tables WHERE id=? AND wedding_id=?', req.params.id, w.id); if (!t) throw fail(404, 'Table not found');
    if (!one('SELECT 1 x FROM guests WHERE id=? AND wedding_id=?', req.params.guestId, w.id)) throw fail(404, 'Guest not found');
    const { seated } = z.object({ seated: z.boolean() }).parse(req.body);
    run('DELETE FROM seat_assignments WHERE guest_id=? AND table_id IN (SELECT id FROM seating_tables WHERE event_id=? AND wedding_id=?)', req.params.guestId, t.event_id, w.id);
    if (seated) run('INSERT INTO seat_assignments(table_id,guest_id) VALUES(?,?)', t.id, req.params.guestId);
    res.json({ ok: true }); }));

  // Removing any organiser item.
  for (const [route, table] of [['shopping', 'shopping'], ['day-contacts', 'day_contacts'], ['documents', 'documents'], ['seating/tables', 'seating_tables']]) {
    app.delete(`/api/${route}/:id`, auth, wrap((req: any, res: any) => { const w = editable(req); owned(table, req.params.id, w);
      if (table === 'seating_tables') run('DELETE FROM seat_assignments WHERE table_id=?', req.params.id);
      run(`DELETE FROM ${table} WHERE id=?`, req.params.id); res.json({ ok: true }); }));
  }
}

// DPDP: everything above belongs to the wedding and goes with it.
export function organiserExport(weddingId: number) {
  return { shopping: q('SELECT * FROM shopping WHERE wedding_id=?', weddingId), day_contacts: q('SELECT * FROM day_contacts WHERE wedding_id=?', weddingId),
    documents: q('SELECT * FROM documents WHERE wedding_id=?', weddingId), seating: q('SELECT * FROM seating_tables WHERE wedding_id=?', weddingId) };
}
export function organiserDelete(weddingId: number) {
  run('DELETE FROM seat_assignments WHERE table_id IN (SELECT id FROM seating_tables WHERE wedding_id=?)', weddingId);
  for (const table of ORGANISER_TABLES) run(`DELETE FROM ${table} WHERE wedding_id=?`, weddingId);
}
