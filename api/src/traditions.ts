// Family and tradition planning: households and invitation cards, muhurat options, transport and baraat,
// gifts the family gives, menus and tastings, who pays for what, sangeet practice, ideas and after-wedding tasks.
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { db, q, one, run } from './db.ts';
import { UPLOAD_DIR, imageType } from './catalog.ts';
import { dateSchema } from './planner.ts';

db.exec(`
CREATE TABLE IF NOT EXISTS muhurats(id INTEGER PRIMARY KEY, wedding_id INT, date TEXT, time TEXT, source TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS vehicles(id INTEGER PRIMARY KEY, wedding_id INT, event_id INT, label TEXT, kind TEXT, seats INT, driver TEXT, driver_phone TEXT, pickup_time TEXT, from_place TEXT, to_place TEXT, passengers TEXT);
CREATE TABLE IF NOT EXISTS gifts_out(id INTEGER PRIMARY KEY, wedding_id INT, recipient TEXT, occasion TEXT, item TEXT, qty INT DEFAULT 1, cost_paise INT, ready INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS menu_items(id INTEGER PRIMARY KEY, wedding_id INT, event_id INT, course TEXT, dish TEXT, diet TEXT);
CREATE TABLE IF NOT EXISTS tastings(id INTEGER PRIMARY KEY, wedding_id INT, caterer TEXT, date TEXT, time TEXT, notes TEXT, done INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS practices(id INTEGER PRIMARY KEY, wedding_id INT, date TEXT, time TEXT, place TEXT, item TEXT, people TEXT);
CREATE TABLE IF NOT EXISTS shortlist(id INTEGER PRIMARY KEY, wedding_id INT, vendor_id INT, UNIQUE(wedding_id,vendor_id));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, wedding_id INT, name TEXT, date TEXT, venue TEXT, dress TEXT, sort INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS ideas(id INTEGER PRIMARY KEY, wedding_id INT, kind TEXT, url TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const addColumns = (table: string, cols: [string, string][]) => { const have = q(`PRAGMA table_info(${table})`).map((c: any) => c.name);
  for (const [c, t] of cols) if (!have.includes(c)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${c} ${t}`); };
// A guest row can be a whole household ("Sharma family", 4 people); the card columns track the physical invitation.
addColumns('guests', [['party', 'INT DEFAULT 1'], ['card_given', 'INT DEFAULT 0'], ['card_by', 'TEXT'], ['card_on', 'TEXT']]);
addColumns('budget_items', [['paid_by', "TEXT DEFAULT 'shared'"]]);
addColumns('weddings', [['after_tasks', 'INT DEFAULT 0']]);
// A shortlisted vendor the couple booked directly (by phone, outside the app), with the price they agreed.
addColumns('shortlist', [['chosen', 'INT DEFAULT 0'], ['agreed_paise', 'INT']]);

// Automation when a vendor is booked or chosen: tick the matching "Book …" task (a combined task waits for
// every service it names) and, for a venue, fill it in on ceremonies that have no venue yet.
const TASK_WORDS: Record<string, RegExp> = { venue: /venue/i, photographer: /photograph/i, makeup: /makeup/i, decor: /decor/i, mehndi: /mehndi|mehendi/i, caterer: /cater/i, dj: /\bdj\b|music/i, pandit: /pandit/i };
const decided = (weddingId: number) => new Set(q(`SELECT v.category FROM bookings b JOIN vendors v ON v.id=b.vendor_id WHERE b.wedding_id=? AND b.status!='cancelled'
  UNION SELECT v.category FROM shortlist s JOIN vendors v ON v.id=s.vendor_id WHERE s.wedding_id=? AND s.chosen=1`, weddingId, weddingId).map((r: any) => r.category));
export function vendorDecided(weddingId: number, vendorId: number) {
  const v = one('SELECT name, category FROM vendors WHERE id=?', vendorId); if (!v) return;
  const done = decided(weddingId);
  for (const t of q("SELECT id, title FROM tasks WHERE wedding_id=? AND done=0 AND title LIKE 'Book %'", weddingId)) {
    const named = Object.entries(TASK_WORDS).filter(([, re]) => re.test(t.title)).map(([c]) => c);
    if (named.includes(v.category) && named.every(c => done.has(c))) run('UPDATE tasks SET done=1 WHERE id=?', t.id);
  }
  if (v.category === 'venue') run("UPDATE events SET venue=? WHERE wedding_id=? AND (venue IS NULL OR venue='')", v.name, weddingId);
}
// When the wedding date moves, ceremonies keep their spacing around it.
export function shiftCeremonies(weddingId: number, from: string, to: string) {
  const days = Math.round((+new Date(to + 'T00:00:00Z') - +new Date(from + 'T00:00:00Z')) / 864e5); if (!days) return;
  for (const e of q("SELECT id, date FROM events WHERE wedding_id=? AND date LIKE '____-__-__'", weddingId)) run('UPDATE events SET date=? WHERE id=?', day(e.date, days), e.id);
}

// Days after the wedding; added to every wedding once.
export const AFTER_TASKS: [string, number][] = [['Return rented outfits and jewellery', 3], ['Send thank-you messages to family and guests', 10],
  ['Leave reviews for your vendors', 14], ['Register the marriage', 30], ['Collect final photos and video', 45], ['Update name and address on documents (if needed)', 60]];
const day = (iso: string, add: number) => new Date(+new Date(iso + 'T00:00:00Z') + add * 864e5).toISOString().slice(0, 10);
export function addAfterTasks(weddingId: number, date: string) {
  for (const [title, offset] of AFTER_TASKS) run('INSERT INTO tasks(wedding_id,title,due) VALUES(?,?,?)', weddingId, title, day(date, offset));
  run('UPDATE weddings SET after_tasks=1 WHERE id=?', weddingId);
}
for (const w of q("SELECT id, date FROM weddings WHERE after_tasks=0 AND date LIKE '____-__-__'")) addAfterTasks(w.id, w.date);

export const TRADITION_TABLES = ['muhurats', 'vehicles', 'gifts_out', 'menu_items', 'tastings', 'practices', 'ideas'];
const money = z.number().int().nonnegative().max(100_000_000_000);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number').or(z.literal(''));
const text = (max: number) => z.string().trim().max(max).optional();
const OCCASIONS = ['milni', 'vidaai', 'return_gift', 'in_laws', 'other'] as const;
const COURSES = ['welcome', 'starter', 'main', 'dessert', 'drinks'] as const;
const DIETS = ['Veg', 'Jain', 'Non-veg', 'Vegan'] as const;
const IDEA_KINDS = ['decor', 'outfit', 'mehendi', 'makeup', 'other'] as const;

export function mountTraditions(app: any, auth: any, wrap: any, ctx: { W: (req: any) => any; canEdit: (req: any, w: any) => boolean; seesMoney: (req: any, w: any) => boolean; fail: (s: number, m: string) => Error }) {
  const { W, canEdit, fail } = ctx;
  const editable = (req: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); return w; };
  const owned = (table: string, id: any, w: any) => { const row = one(`SELECT * FROM ${table} WHERE id=? AND wedding_id=?`, id, w.id); if (!row) throw fail(404, 'Not found'); return row; };
  const ceremony = (eventId: any, w: any) => { if (eventId != null && !one('SELECT 1 x FROM events WHERE id=? AND wedding_id=?', eventId, w.id)) throw fail(404, 'Ceremony not found'); };
  const created = (res: any, r: any) => res.status(201).json({ id: Number(r.lastInsertRowid) });

  // Guests: edit a household, its food preference and whether the card has been given.
  const guestPatch = z.object({ name: z.string().trim().min(1).max(120).optional(), phone: phone.optional(), side: z.enum(['bride', 'groom']).optional(),
    party: z.number().int().min(1).max(50).optional(), meal: z.enum(DIETS).nullable().optional(), card_given: z.boolean().optional(), card_by: text(80) });
  app.patch('/api/guests/:id', auth, wrap((req: any, res: any) => { const w = editable(req); const g = owned('guests', req.params.id, w); const b = guestPatch.parse(req.body);
    const given = b.card_given ?? !!g.card_given;
    run('UPDATE guests SET name=?,phone=?,side=?,party=?,meal=?,card_given=?,card_by=?,card_on=? WHERE id=?', b.name ?? g.name, b.phone ?? g.phone, b.side ?? g.side, b.party ?? g.party ?? 1,
      b.meal === undefined ? g.meal : b.meal, given ? 1 : 0, given ? (b.card_by ?? g.card_by ?? '') : '', given ? (g.card_given ? g.card_on : new Date().toISOString().slice(0, 10)) : null, g.id);
    res.json(one('SELECT * FROM guests WHERE id=?', g.id)); }));
  app.delete('/api/guests/:id', auth, wrap((req: any, res: any) => { const w = editable(req); owned('guests', req.params.id, w);
    for (const t of ['guest_events', 'seat_assignments']) run(`DELETE FROM ${t} WHERE guest_id=?`, req.params.id);
    run('DELETE FROM guests WHERE id=?', req.params.id); res.json({ ok: true }); }));

  // Muhurat: dates the family pandit suggests, each checked against booked and shortlisted vendors' calendars.
  app.get('/api/muhurats', auth, wrap((req: any, res: any) => { const w = W(req);
    const vendors = q(`SELECT DISTINCT v.id, v.name, CASE WHEN b.id IS NULL THEN 'shortlisted' ELSE 'booked' END status FROM vendors v
      LEFT JOIN bookings b ON b.vendor_id=v.id AND b.wedding_id=? AND b.status!='cancelled'
      WHERE v.id IN (SELECT vendor_id FROM bookings WHERE wedding_id=? AND status!='cancelled' UNION SELECT vendor_id FROM shortlist WHERE wedding_id=?)`, w.id, w.id, w.id);
    const busyOn = (date: string) => vendors.filter((v: any) => one('SELECT 1 x FROM blocked_dates WHERE vendor_id=? AND date=?', v.id, date)
      || one("SELECT 1 x FROM bookings b JOIN enquiries e ON e.id=b.enquiry_id WHERE b.vendor_id=? AND e.event_date=? AND b.wedding_id!=? AND b.status!='cancelled'", v.id, date, w.id)).map((v: any) => ({ name: v.name, status: v.status }));
    res.json({ wedding_date: w.date, vendors: vendors.length, options: q('SELECT * FROM muhurats WHERE wedding_id=? ORDER BY date, time', w.id).map((m: any) => ({ ...m, chosen: m.date === w.date, busy: busyOn(m.date) })) }); }));
  app.post('/api/muhurats', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ date: dateSchema, time: text(40), source: text(80), note: text(300) }).parse(req.body);
    created(res, run('INSERT INTO muhurats(wedding_id,date,time,source,note) VALUES(?,?,?,?,?)', w.id, b.date, b.time || '', b.source || '', b.note || '')); }));
  app.post('/api/muhurats/:id/choose', auth, wrap((req: any, res: any) => { const w = editable(req); const m = owned('muhurats', req.params.id, w);
    run('UPDATE weddings SET date=? WHERE id=?', m.date, w.id); shiftCeremonies(w.id, w.date, m.date); res.json({ ok: true, date: m.date }); }));

  // Mark a vendor as booked directly (common for venues and local businesses not on the app).
  app.post('/api/shortlist/choose', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ vendor_id: z.number().int(), chosen: z.boolean(), agreed_paise: money.nullable().optional() }).parse(req.body);
    if (!one('SELECT 1 x FROM vendors WHERE id=?', b.vendor_id)) throw fail(404, 'Vendor not found');
    run('INSERT OR IGNORE INTO shortlist(wedding_id,vendor_id) VALUES(?,?)', w.id, b.vendor_id);
    run('UPDATE shortlist SET chosen=?, agreed_paise=? WHERE wedding_id=? AND vendor_id=?', b.chosen ? 1 : 0, b.chosen ? b.agreed_paise ?? null : null, w.id, b.vendor_id);
    if (b.chosen) vendorDecided(w.id, b.vendor_id);
    res.json({ ok: true }); }));
  // Every vendor the couple is working with, for pickers such as a ceremony's venue.
  app.get('/api/my-vendors', auth, wrap((req: any, res: any) => { const w = W(req);
    res.json(q(`SELECT v.id vendor_id, v.name, v.category, v.city, 'booked' status, b.total_paise amount_paise FROM bookings b JOIN vendors v ON v.id=b.vendor_id WHERE b.wedding_id=? AND b.status!='cancelled'
      UNION ALL SELECT v.id, v.name, v.category, v.city, CASE WHEN s.chosen=1 THEN 'chosen' ELSE 'shortlisted' END, s.agreed_paise FROM shortlist s JOIN vendors v ON v.id=s.vendor_id
        WHERE s.wedding_id=? AND v.id NOT IN (SELECT vendor_id FROM bookings WHERE wedding_id=? AND status!='cancelled') ORDER BY 5, 2`, w.id, w.id, w.id)); }));

  // Transport and baraat: cars and buses for each ceremony, with driver, timing, route and who rides in each.
  const vehicleBody = z.object({ event_id: z.number().int().nullable().optional(), label: z.string().trim().min(1).max(80), kind: z.enum(['car', 'bus', 'tempo', 'horse', 'other']).default('car'),
    seats: z.number().int().min(1).max(80).nullable().optional(), driver: text(80), driver_phone: phone.optional(), pickup_time: text(40), from_place: text(120), to_place: text(120), passengers: text(600) });
  const vehicleArgs = (b: any) => [b.event_id ?? null, b.label, b.kind, b.seats ?? null, b.driver || '', b.driver_phone || '', b.pickup_time || '', b.from_place || '', b.to_place || '', b.passengers || ''];
  app.get('/api/vehicles', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM vehicles WHERE wedding_id=? ORDER BY event_id, pickup_time, id', W(req).id))));
  app.post('/api/vehicles', auth, wrap((req: any, res: any) => { const w = editable(req); const b = vehicleBody.parse(req.body); ceremony(b.event_id, w);
    created(res, run('INSERT INTO vehicles(event_id,label,kind,seats,driver,driver_phone,pickup_time,from_place,to_place,passengers,wedding_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)', ...vehicleArgs(b), w.id)); }));
  app.put('/api/vehicles/:id', auth, wrap((req: any, res: any) => { const w = editable(req); owned('vehicles', req.params.id, w); const b = vehicleBody.parse(req.body); ceremony(b.event_id, w);
    run('UPDATE vehicles SET event_id=?,label=?,kind=?,seats=?,driver=?,driver_phone=?,pickup_time=?,from_place=?,to_place=?,passengers=? WHERE id=?', ...vehicleArgs(b), req.params.id); res.json({ ok: true }); }));

  // Gifts the family gives: milni, vidaai, return gifts for guests and gifts for the in-laws.
  app.get('/api/gifts-out', auth, wrap((req: any, res: any) => { const w = W(req);
    res.json({ items: q('SELECT * FROM gifts_out WHERE wedding_id=? ORDER BY ready, id DESC', w.id), households: one('SELECT COUNT(*) n FROM guests WHERE wedding_id=?', w.id).n }); }));
  app.post('/api/gifts-out', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ recipient: z.string().trim().min(1).max(120), occasion: z.enum(OCCASIONS).default('other'), item: text(160), qty: z.number().int().min(1).max(5000).default(1), cost_paise: money.nullable().optional() }).parse(req.body);
    created(res, run('INSERT INTO gifts_out(wedding_id,recipient,occasion,item,qty,cost_paise) VALUES(?,?,?,?,?,?)', w.id, b.recipient, b.occasion, b.item || '', b.qty, b.cost_paise ?? null)); }));
  app.patch('/api/gifts-out/:id', auth, wrap((req: any, res: any) => { const w = editable(req); owned('gifts_out', req.params.id, w);
    run('UPDATE gifts_out SET ready=? WHERE id=?', z.object({ ready: z.boolean() }).parse(req.body).ready ? 1 : 0, req.params.id); res.json({ ok: true }); }));

  // Menu for each ceremony and tasting appointments with the caterer.
  app.get('/api/menu', auth, wrap((req: any, res: any) => { const w = W(req);
    res.json({ items: q('SELECT * FROM menu_items WHERE wedding_id=? ORDER BY event_id, id', w.id), tastings: q('SELECT * FROM tastings WHERE wedding_id=? ORDER BY done, date, id', w.id) }); }));
  app.post('/api/menu/items', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ event_id: z.number().int().nullable().optional(), course: z.enum(COURSES).default('main'), dish: z.string().trim().min(1).max(120), diet: z.enum(DIETS).default('Veg') }).parse(req.body); ceremony(b.event_id, w);
    created(res, run('INSERT INTO menu_items(wedding_id,event_id,course,dish,diet) VALUES(?,?,?,?,?)', w.id, b.event_id ?? null, b.course, b.dish, b.diet)); }));
  app.post('/api/menu/tastings', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ caterer: z.string().trim().min(1).max(120), date: dateSchema, time: text(40), notes: text(500) }).parse(req.body);
    created(res, run('INSERT INTO tastings(wedding_id,caterer,date,time,notes) VALUES(?,?,?,?,?)', w.id, b.caterer, b.date, b.time || '', b.notes || '')); }));
  app.patch('/api/menu/tastings/:id', auth, wrap((req: any, res: any) => { const w = editable(req); const t = owned('tastings', req.params.id, w);
    const b = z.object({ done: z.boolean().optional(), notes: text(500) }).parse(req.body);
    run('UPDATE tastings SET done=?, notes=? WHERE id=?', b.done === undefined ? t.done : b.done ? 1 : 0, b.notes ?? t.notes, t.id); res.json({ ok: true }); }));

  // Who pays for what: each budget category belongs to both families together, or to one side.
  app.patch('/api/budget/paid-by', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ category: z.string().min(1).max(40), paid_by: z.enum(['shared', 'bride', 'groom']) }).parse(req.body);
    if (!run('UPDATE budget_items SET paid_by=? WHERE wedding_id=? AND category=?', b.paid_by, w.id, b.category).changes) throw fail(404, 'Budget category not found');
    res.json({ ok: true }); }));

  // Sangeet practice: rehearsals with the song, place and who needs to come.
  app.get('/api/practices', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM practices WHERE wedding_id=? ORDER BY date, time, id', W(req).id))));
  app.post('/api/practices', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ date: dateSchema, time: text(40), place: text(120), item: z.string().trim().min(1).max(160), people: text(400) }).parse(req.body);
    created(res, run('INSERT INTO practices(wedding_id,date,time,place,item,people) VALUES(?,?,?,?,?,?)', w.id, b.date, b.time || '', b.place || '', b.item, b.people || '')); }));

  // Ideas: photos and links for decor, outfits and mehendi to show family and vendors.
  app.get('/api/ideas', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM ideas WHERE wedding_id=? ORDER BY id DESC', W(req).id))));
  app.post('/api/ideas', auth, wrap((req: any, res: any) => { const w = editable(req);
    const b = z.object({ kind: z.enum(IDEA_KINDS).default('other'), url: z.string().trim().url().max(2000).refine(u => /^https:\/\//.test(u), 'Use an https:// link').optional(), data: z.string().min(16).max(12 * 1024 * 1024).optional(), note: text(300) }).parse(req.body);
    if (!b.url && !b.data && !b.note) throw fail(400, 'Add a photo, a link or a note');
    if (one('SELECT COUNT(*) n FROM ideas WHERE wedding_id=?', w.id).n >= 200) throw fail(400, 'You can save up to 200 ideas.');
    let url = b.url || '';
    if (b.data) {
      const bytes = Buffer.from(b.data.replace(/^data:[^,]*,/, ''), 'base64');
      if (bytes.length > 8 * 1024 * 1024) throw fail(413, 'Photos must be 8 MB or smaller.');
      const ext = imageType(bytes); if (!ext) throw fail(400, 'Upload a JPEG, PNG or WebP photo.');
      const name = `${randomBytes(12).toString('hex')}.${ext}`; writeFileSync(`${UPLOAD_DIR}/${name}`, bytes); url = `/uploads/${name}`;
    }
    created(res, run('INSERT INTO ideas(wedding_id,kind,url,note) VALUES(?,?,?,?)', w.id, b.kind, url, b.note || '')); }));

  for (const [route, table] of [['muhurats', 'muhurats'], ['vehicles', 'vehicles'], ['gifts-out', 'gifts_out'], ['menu/items', 'menu_items'], ['menu/tastings', 'tastings'], ['practices', 'practices'], ['ideas', 'ideas']]) {
    app.delete(`/api/${route}/:id`, auth, wrap((req: any, res: any) => { const w = editable(req); const row = owned(table, req.params.id, w);
      if (table === 'ideas') removeUpload(row.url);
      run(`DELETE FROM ${table} WHERE id=?`, req.params.id); res.json({ ok: true }); }));
  }
}

const removeUpload = (url: string) => { if (/^\/uploads\/[0-9a-f]{24}\.(jpg|png|webp)$/.test(url || '')) { try { unlinkSync(`${UPLOAD_DIR}/${url.slice(9)}`); } catch { /* already gone */ } } };
// DPDP: these belong to the wedding and go with it.
export function traditionsExport(weddingId: number) { return Object.fromEntries(TRADITION_TABLES.map(t => [t, q(`SELECT * FROM ${t} WHERE wedding_id=?`, weddingId)])); }
export function traditionsDelete(weddingId: number) {
  for (const i of q('SELECT url FROM ideas WHERE wedding_id=?', weddingId)) removeUpload(i.url);
  for (const t of TRADITION_TABLES) run(`DELETE FROM ${t} WHERE wedding_id=?`, weddingId);
}
