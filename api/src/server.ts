import { mountPlanner, dateSchema } from './planner.ts';
import { readRuntimeConfig } from './config.ts';
import { mountCatalog, vendorCatalog } from './catalog.ts';
import express from 'express'; import cors from 'cors'; import jwt from 'jsonwebtoken'; import { z } from 'zod'; import { randomBytes } from 'node:crypto';
import { db, q, one, run } from './db.ts'; import { mountExtras, TEMPLATES } from './extras.ts'; import { seed } from './seed.ts'; import { mountSite, mountSiteEarly, spamGuard } from './site.ts';
const config = readRuntimeConfig();
const SECRET = process.env.JWT_SECRET || randomBytes(16).toString('hex');
const MOCK_OTP = '123456'; // MOCK: replace with SMS/WhatsApp provider (see providers.md)
if (config.seedDemoData) seed();
export const app = express(); mountSiteEarly(app); app.use(cors()); app.use(express.json({ limit: '1mb' }));
const wrap = (f: any) => (req: any, res: any) => { const report = (e: any) => res.status(e instanceof z.ZodError ? 400 : e.status || 500).json({ error: e instanceof z.ZodError ? e.issues[0].message : e.message }); try { return Promise.resolve(f(req, res)).catch(report); } catch (e) { return report(e); } };
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const auth = (req: any, _r: any, next: any) => { try { req.user = jwt.verify((req.headers.authorization || '').slice(7), SECRET); next(); } catch { next(fail(401, 'Login required')); } };
const myVendor = (uid: number) => one('SELECT * FROM vendors WHERE user_id=?', uid);
const myWedding = (uid: number) => one('SELECT * FROM weddings WHERE owner_id=? ORDER BY id LIMIT 1', uid);
const commissionBps = (cat: string) => (['venue', 'caterer'].includes(cat) ? 300 : 600);
const leak = (s: string) => /(\+?91[\s-]?)?[6-9]\d{9}|\b[\w.-]+@[a-z]{2,}\b/i.test(s.replace(/[\s-]/g, ' ').replace(/(\d)\s(?=\d)/g, '$1'));

// Auth (mock OTP, rate limited per phone)
const otpTries = new Map<string, number[]>();
app.post('/api/auth/otp', wrap((req: any, res: any) => {
  const { phone } = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number') }).parse(req.body);
  const now = Date.now(); const t = (otpTries.get(phone) || []).filter(x => now - x < 600000);
  if (t.length >= 5) throw fail(429, 'Too many OTP requests. Try later.'); otpTries.set(phone, [...t, now]);
  res.json({ ok: true, mock: true, hint: 'Demo OTP is 123456' });
}));
app.post('/api/auth/verify', wrap((req: any, res: any) => {
  const b = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/), otp: z.string(), role: z.enum(['couple', 'vendor']).optional(), name: z.string().min(1).max(80).optional() }).parse(req.body);
  if (b.otp !== MOCK_OTP) throw fail(401, 'Wrong OTP');
  let u = one('SELECT * FROM users WHERE phone=?', b.phone);
  if (!u) {
    if (!b.role) return res.json({ needsProfile: true });
    const r = run('INSERT INTO users(phone,name,role) VALUES(?,?,?)', b.phone, b.name || 'User', b.role); u = one('SELECT * FROM users WHERE id=?', Number(r.lastInsertRowid));
  }
  res.json({ token: jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '30d' }), user: u });
}));
app.get('/api/me', auth, wrap((req: any, res: any) => res.json({ user: one('SELECT * FROM users WHERE id=?', req.user.id), wedding: myWedding(req.user.id) || null, vendor: myVendor(req.user.id) || null })));

// Vendor profile
app.put('/api/vendor', auth, wrap((req: any, res: any) => {
  if (req.user.role !== 'vendor') throw fail(403, 'Vendors only');
  const b = z.object({ name: z.string().min(2), category: z.string(), city: z.string(), locality: z.string().optional(), start_paise: z.number().int().positive(), description: z.string().max(500).optional(), travels: z.number().optional() }).parse(req.body);
  const v = myVendor(req.user.id);
  if (v) run('UPDATE vendors SET name=?,category=?,city=?,locality=?,start_paise=?,description=?,travels=? WHERE id=?', b.name, b.category, b.city, b.locality || '', b.start_paise, b.description || '', b.travels || 0, v.id);
  else run('INSERT INTO vendors(user_id,name,category,city,locality,start_paise,description,travels,languages) VALUES(?,?,?,?,?,?,?,?,?)', req.user.id, b.name, b.category, b.city, b.locality || '', b.start_paise, b.description || '', b.travels || 0, 'en,hi');
  res.json(myVendor(req.user.id));
}));

// Discovery
const ratingSql = '(SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.vendor_id=v.id) rating,(SELECT COUNT(*) FROM reviews r WHERE r.vendor_id=v.id) reviews';
app.get('/api/vendors', wrap((req: any, res: any) => {
  const { city, category, q: text, max } = req.query; const w: string[] = ['1=1']; const a: any[] = [];
  if (city) { w.push('(city=? OR travels=1)'); a.push(city); } if (category) { w.push('category=?'); a.push(category); }
  if (max) { const maximum = z.coerce.number().finite().positive().max(Number.MAX_SAFE_INTEGER / 100).parse(max); w.push('start_paise<=?'); a.push(Math.round(maximum * 100)); }
  if (text) { w.push('(name LIKE ? OR description LIKE ? OR locality LIKE ?)'); a.push(...Array(3).fill(`%${text}%`)); }
  res.json(q(`SELECT v.*,${ratingSql},(SELECT url FROM vendor_photos p WHERE p.vendor_id=v.id ORDER BY p.id LIMIT 1) cover_url FROM vendors v WHERE ${w.join(' AND ')} ORDER BY sample ASC, unclaimed ASC, verified DESC, id LIMIT 200`, ...a));
}));
app.get('/api/vendors/:id', wrap((req: any, res: any) => {
  const v = one(`SELECT v.*,${ratingSql} FROM vendors v WHERE id=?`, req.params.id); if (!v) throw fail(404, 'Not found');
  res.json({ ...v, ...vendorCatalog(v.id), reviewList: q('SELECT r.rating,r.text,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE vendor_id=?', v.id) });
}));

// Wedding workspace
const CHECK = [['Set wedding date & budget', -365], ['Book venue', -300], ['Book photographer', -240], ['Book makeup artist', -180], ['Finalise guest list', -120], ['Send save-the-dates', -90], ['Book decor & mehndi', -75], ['Send invites with RSVP link', -45], ['Final vendor payments', -7], ['Day-of run-of-show shared', -1]] as const;
// Starter tasks are timed back from the wedding day. On a short engagement the ones whose ideal date has
// already passed are spread a week apart from today, in order, instead of all starting out overdue.
export function starterDates(weddingDate: string, now: Date): [string, string][] {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const today = day(now.getTime()); const wedding = new Date(weddingDate + 'T00:00:00Z').getTime();
  const lastUseful = day(Math.max(now.getTime(), wedding - 864e5));
  let catchUp = 0;
  return CHECK.map(([title, offset]) => {
    const ideal = day(wedding + (offset as number) * 864e5);
    if (ideal >= today || weddingDate < today) return [title as string, ideal];
    const spread = day(now.getTime() + 7 * 864e5 * catchUp++);
    return [title as string, spread < lastUseful ? spread : lastUseful];
  });
}
const SPLIT: Record<string, number> = { venue: 30, caterer: 25, photographer: 10, decor: 12, makeup: 5, mehndi: 3, dj: 5, other: 10 };
app.post('/api/wedding', auth, wrap((req: any, res: any) => {
  const b = z.object({ title: z.string().trim().min(2).max(120), date: dateSchema, city: z.string().trim().min(1).max(80), community: z.string().default('North Indian Hindu'), guests_est: z.number().int().positive().max(100000).default(200), budget_paise: z.number().int().positive() }).parse(req.body);
  const ex = myWedding(req.user.id); if (ex) return res.json(ex);
  const id = Number(run('INSERT INTO weddings(owner_id,title,date,city,community,guests_est,budget_paise) VALUES(?,?,?,?,?,?,?)', req.user.id, b.title, b.date, b.city, b.community, b.guests_est, b.budget_paise).lastInsertRowid);
  const d = new Date(b.date);
  // Creating the workspace sets the date and budget, so that starter task begins done.
  for (const [t, due] of starterDates(b.date, new Date())) run('INSERT INTO tasks(wedding_id,title,due,done) VALUES(?,?,?,?)', id, t, due, t === 'Set wedding date & budget' ? 1 : 0);
  for (const [c, p] of Object.entries(SPLIT)) run('INSERT INTO budget_items(wedding_id,category,allocated_paise) VALUES(?,?,?)', id, c, Math.round(b.budget_paise * p / 100));
  res.json(one('SELECT * FROM weddings WHERE id=?', id));
}));
const W = (req: any) => { const w = myWedding(req.user.id); if (!w) throw fail(400, 'Create your wedding first'); return w; };
app.get('/api/tasks', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM tasks WHERE wedding_id=? ORDER BY due', W(req).id))));
app.post('/api/tasks', auth, wrap((req: any, res: any) => { const b = z.object({ title: z.string().trim().min(1).max(200), due: dateSchema.optional() }).parse(req.body); run('INSERT INTO tasks(wedding_id,title,due) VALUES(?,?,?)', W(req).id, b.title, b.due || null); res.json({ ok: true }); }));
app.patch('/api/tasks/:id', auth, wrap((req: any, res: any) => {
  const b = z.object({ done: z.boolean().optional(), title: z.string().trim().min(1).max(200).optional(), due: dateSchema.nullable().optional() }).strict().refine(value => Object.keys(value).length > 0).parse(req.body);
  const w = W(req); const task = one('SELECT * FROM tasks WHERE id=? AND wedding_id=?', req.params.id, w.id);
  if (!task) throw fail(404, 'Task not found');
  run('UPDATE tasks SET done=?,title=?,due=? WHERE id=? AND wedding_id=?', b.done === undefined ? task.done : b.done ? 1 : 0, b.title ?? task.title, b.due === undefined ? task.due : b.due, task.id, w.id);
  res.json({ ok: true });
}));
app.get('/api/budget', auth, wrap((req: any, res: any) => {
  const w = W(req); const items = q('SELECT * FROM budget_items WHERE wedding_id=?', w.id);
  const rows = items.map(i => {
    const bk = q(`SELECT b.id,b.total_paise FROM bookings b JOIN vendors v ON v.id=b.vendor_id WHERE b.wedding_id=? AND v.category=? AND b.status!='cancelled'`, w.id, i.category);
    const booked = bk.reduce((s, x) => s + x.total_paise, 0);
    const paid = bk.reduce((s, x) => s + (one("SELECT COALESCE(SUM(amount_paise),0) s FROM milestones WHERE booking_id=? AND status IN ('held','released')", x.id).s), 0);
    return { category: i.category, allocated_paise: i.allocated_paise, booked_paise: booked, paid_paise: paid, due_paise: booked - paid };
  });
  res.json({ total_paise: w.budget_paise, rows });
}));
app.get('/api/guests', auth, wrap((req: any, res: any) => res.json(q('SELECT * FROM guests WHERE wedding_id=? ORDER BY id DESC', W(req).id))));
app.post('/api/guests', auth, wrap((req: any, res: any) => {
  const b = z.object({ name: z.string().min(1), phone: z.string().optional(), side: z.enum(['bride', 'groom']).default('bride') }).parse(req.body);
  run('INSERT INTO guests(wedding_id,name,phone,side,token) VALUES(?,?,?,?,?)', W(req).id, b.name, b.phone || '', b.side, randomBytes(6).toString('hex')); res.json({ ok: true });
}));
// public RSVP page (no login needed, opened from WhatsApp link)
const esc = (s: string) => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const dateText = (d?: string) => { const x = new Date(String(d) + 'T00:00:00Z'); return d && !isNaN(+x) ? x.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''; };
const rsvpPage = (title: string, body: string) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title><link rel=icon href="/favicon.png">
<style>body{margin:0;background:#FAF7F2;color:#2C2024;font:16px/1.5 system-ui,sans-serif}main{max-width:440px;margin:0 auto;padding:32px 20px}h1{font:600 28px/1.2 Georgia,serif;margin:0 0 4px;color:#74263F}.muted{color:#75656B;font-size:14px}fieldset{border:1px solid #EADCD3;border-radius:12px;background:#FFFEFC;padding:12px 16px;margin:12px 0}legend{font-weight:600;padding:0 4px}label{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin-right:16px}select,input[type=number]{font:inherit;padding:10px;border:1px solid #EADCD3;border-radius:10px;background:#FFFEFC;min-height:44px}button{font:600 15px system-ui,sans-serif;min-height:48px;padding:0 20px;border-radius:10px;border:1.3px solid #74263F;background:#74263F;color:#fff;cursor:pointer;margin:4px 8px 4px 0}button.ghost{background:transparent;color:#74263F}.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}a{color:#74263F}</style>
<main>${body}</main></html>`;
app.get('/rsvp/:token', wrap((req: any, res: any) => {
  const g = one('SELECT g.*,w.title,w.date,w.city FROM guests g JOIN weddings w ON w.id=g.wedding_id WHERE token=?', req.params.token); if (!g) return res.status(404).send(rsvpPage('Invalid link', '<h1>This invitation link is not valid</h1><p class="muted">Ask the couple to send it again.</p>'));
  const events = q("SELECT e.id,e.name,e.date,e.venue,ge.rsvp FROM guest_events ge JOIN events e ON e.id=ge.event_id WHERE ge.guest_id=? ORDER BY COALESCE(e.date,'9999-12-31'), e.sort, e.id", g.id);
  const meal = `<div class="row"><label for="meal">Meal</label><select id="meal" name="meal">${['Veg', 'Non-veg', 'Jain'].map(m => `<option${g.meal === m ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="row"><label for="plus">Others coming with you</label><input id="plus" type="number" name="plus" min="0" max="5" value="${Number(g.plus_ones) || 0}"></div>`;
  // Guests invited to specific ceremonies answer for each; others give one reply for the wedding.
  const form = events.length
    ? `${events.map((e: any) => `<fieldset><legend>${esc(e.name)}</legend><p class="muted" style="margin:0">${[dateText(e.date), e.venue].filter(Boolean).map(esc).join(' · ') || 'Date to be announced'}</p>
        <label><input type="radio" name="e${e.id}" value="yes"${e.rsvp !== 'no' ? ' checked' : ''}> Coming</label><label><input type="radio" name="e${e.id}" value="no"${e.rsvp === 'no' ? ' checked' : ''}> Can't come</label></fieldset>`).join('')}
       ${meal}<button name="rsvp" value="events">Send my reply</button>`
    : `${meal}<button name="rsvp" value="yes">Yes, I'll be there</button><button class="ghost" name="rsvp" value="no">Can't make it</button>`;
  res.send(rsvpPage(`RSVP · ${esc(g.title)}`, `<h1>${esc(g.title)}</h1><p class="muted">${esc(dateText(g.date))} · ${esc(g.city)}</p>
    <p>Namaste ${esc(g.name)}, ${events.length ? 'please tell us which ceremonies you can attend.' : 'will you join us?'}</p>
    <form method="post"><input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">${form}</form>
    <p class="muted" style="margin-top:40px">Planning your own wedding? <a href="/">Shaadi OS</a></p>`));
}));
app.post('/rsvp/:token', express.urlencoded({ extended: false }), spamGuard(), wrap((req: any, res: any) => {
  const b = z.object({ rsvp: z.enum(['yes', 'no', 'events']), meal: z.enum(['Veg', 'Non-veg', 'Jain']).default('Veg'), plus: z.coerce.number().int().min(0).max(5).default(0) }).safeParse(req.body);
  const g = one('SELECT id FROM guests WHERE token=?', req.params.token);
  if (!b.success || !g) return res.status(400).send(rsvpPage('Try again', "<h1>That reply didn't go through</h1><p>Please go back and try again.</p>"));
  let rsvp = b.data.rsvp;
  if (rsvp === 'events') {
    const invited = q('SELECT event_id FROM guest_events WHERE guest_id=?', g.id);
    const answers = invited.map((e: any) => [e.event_id, req.body['e' + e.event_id] === 'no' ? 'no' : 'yes'] as const);
    for (const [eventId, answer] of answers) run('UPDATE guest_events SET rsvp=? WHERE guest_id=? AND event_id=?', answer, g.id, eventId);
    rsvp = answers.some(([, a]) => a === 'yes') ? 'yes' : 'no';
  } else run('UPDATE guest_events SET rsvp=? WHERE guest_id=?', rsvp, g.id);
  run('UPDATE guests SET rsvp=?,meal=?,plus_ones=? WHERE id=?', rsvp, b.data.meal, b.data.plus, g.id);
  res.send(rsvpPage('Reply recorded', `<h1>Thank you</h1><p>Your reply is recorded. You can open this link again to change it.</p>`));
}));

// Enquiries / chat
const canSee = (e: any, u: any) => e && (e.couple_id === u.id || one('SELECT 1 x FROM vendors WHERE id=? AND user_id=?', e.vendor_id, u.id));
app.post('/api/enquiries', auth, wrap((req: any, res: any) => {
  const b = z.object({ vendor_id: z.number().int(), event_date: z.string(), guests: z.number().int().positive(), budget_paise: z.number().int().positive(), note: z.string().max(500).optional() }).parse(req.body);
  const w = W(req); const target = one('SELECT unclaimed FROM vendors WHERE id=?', b.vendor_id); if (!target) throw fail(404, 'Vendor not found');
  if (target.unclaimed) throw fail(409, 'This business has not joined Shaadi OS yet, so it cannot receive enquiries here. Use the link on its page to contact it directly.');
  res.json({ id: Number(run('INSERT INTO enquiries(wedding_id,couple_id,vendor_id,event_date,guests,budget_paise,note) VALUES(?,?,?,?,?,?,?)', w.id, req.user.id, b.vendor_id, b.event_date, b.guests, b.budget_paise, b.note || '').lastInsertRowid) });
}));
app.get('/api/enquiries', auth, wrap((req: any, res: any) => {
  const v = myVendor(req.user.id);
  const rows = req.user.role === 'vendor' && v ? q('SELECT e.*,u.name couple_name,(SELECT status FROM quotes WHERE enquiry_id=e.id ORDER BY version DESC LIMIT 1) quote_status FROM enquiries e JOIN users u ON u.id=e.couple_id WHERE vendor_id=? ORDER BY e.id DESC', v.id)
    : q('SELECT e.*,v.name vendor_name,v.category,(SELECT status FROM quotes WHERE enquiry_id=e.id ORDER BY version DESC LIMIT 1) quote_status FROM enquiries e JOIN vendors v ON v.id=e.vendor_id WHERE couple_id=? ORDER BY e.id DESC', req.user.id);
  res.json(rows);
}));
app.get('/api/enquiries/:id', auth, wrap((req: any, res: any) => {
  const e = one('SELECT * FROM enquiries WHERE id=?', req.params.id); if (!canSee(e, req.user)) throw fail(404, 'Not found');
  const booked = !!one('SELECT 1 x FROM bookings WHERE enquiry_id=?', e.id);
  res.json({ enquiry: e, booked, messages: q('SELECT * FROM messages WHERE enquiry_id=? ORDER BY id', e.id), quotes: q('SELECT * FROM quotes WHERE enquiry_id=? ORDER BY version DESC', e.id).map(x => ({ ...x, items: JSON.parse(x.items), milestones: JSON.parse(x.milestones) })), booking: one('SELECT * FROM bookings WHERE enquiry_id=?', e.id) || null });
}));
app.post('/api/enquiries/:id/messages', auth, wrap((req: any, res: any) => {
  const e = one('SELECT * FROM enquiries WHERE id=?', req.params.id); if (!canSee(e, req.user)) throw fail(404, 'Not found');
  const { body } = z.object({ body: z.string().min(1).max(1000) }).parse(req.body);
  const booked = !!one('SELECT 1 x FROM bookings WHERE enquiry_id=?', e.id); const flagged = !booked && leak(body);
  if (flagged) throw fail(422, 'For your protection, phone numbers and UPI IDs can be shared only after booking. Book in-app to get Booking Protection.');
  run('INSERT INTO messages(enquiry_id,sender_id,body) VALUES(?,?,?)', e.id, req.user.id, body); res.json({ ok: true });
}));

// Quotes & bookings
app.post('/api/enquiries/:id/quotes', auth, wrap((req: any, res: any) => {
  const e = one('SELECT * FROM enquiries WHERE id=?', req.params.id); const v = myVendor(req.user.id);
  if (!e || !v || e.vendor_id !== v.id) throw fail(403, 'Not your enquiry');
  if (e.status === 'booked') throw fail(409, 'Enquiry already booked');
  const b = z.object({ items: z.array(z.object({ label: z.string().min(1), amount_paise: z.number().int().positive() })).min(1), milestones: z.array(z.object({ label: z.string(), pct: z.number().int().positive() })).default([{ label: 'Token advance', pct: 20 }, { label: 'One week before event', pct: 50 }, { label: 'After event', pct: 30 }]) }).parse(req.body);
  if (b.milestones.reduce((s, m) => s + m.pct, 0) !== 100) throw fail(400, 'Milestones must total 100%');
  const total = b.items.reduce((s, i) => s + i.amount_paise, 0); const ver = (one('SELECT MAX(version) m FROM quotes WHERE enquiry_id=?', e.id).m || 0) + 1;
  run("UPDATE quotes SET status='superseded' WHERE enquiry_id=? AND status='sent'", e.id);
  run('INSERT INTO quotes(enquiry_id,version,items,total_paise,milestones) VALUES(?,?,?,?,?)', e.id, ver, JSON.stringify(b.items), total, JSON.stringify(b.milestones)); res.json({ version: ver, total_paise: total });
}));
app.post('/api/quotes/:id/accept', auth, wrap((req: any, res: any) => {
  const qt = one('SELECT * FROM quotes WHERE id=?', req.params.id); const e = qt && one('SELECT * FROM enquiries WHERE id=?', qt.enquiry_id);
  if (!e || e.couple_id !== req.user.id) throw fail(403, 'Not your quote'); if (one('SELECT 1 x FROM bookings WHERE enquiry_id=?', e.id)) throw fail(409, 'Enquiry already booked'); if (qt.status !== 'sent') throw fail(409, 'Quote no longer active');
  const v = one('SELECT * FROM vendors WHERE id=?', e.vendor_id); const bps = commissionBps(v.category);
  db.exec('BEGIN');
  try {
    run("UPDATE quotes SET status='accepted' WHERE id=?", qt.id);
    const bid = Number(run('INSERT INTO bookings(quote_id,enquiry_id,couple_id,vendor_id,wedding_id,total_paise,commission_bps) VALUES(?,?,?,?,?,?,?)', qt.id, e.id, e.couple_id, e.vendor_id, e.wedding_id, qt.total_paise, bps).lastInsertRowid);
    const milestones = JSON.parse(qt.milestones); let allocated = 0;
    milestones.forEach((m: any, index: number) => { const amount = index === milestones.length - 1 ? qt.total_paise - allocated : Math.floor(qt.total_paise * m.pct / 100); allocated += amount; run('INSERT INTO milestones(booking_id,label,pct,amount_paise) VALUES(?,?,?,?)', bid, m.label, m.pct, amount); });
    run("UPDATE enquiries SET status='booked' WHERE id=?", e.id); db.exec('COMMIT'); res.json({ booking_id: bid });
  } catch (x) { db.exec('ROLLBACK'); throw x; }
}));
const bookingView = (b: any) => ({ ...b, vendor_name: one('SELECT name FROM vendors WHERE id=?', b.vendor_id).name, couple_name: one('SELECT name FROM users WHERE id=?', b.couple_id).name, milestones: q('SELECT * FROM milestones WHERE booking_id=? ORDER BY id', b.id), reviewed: !!one('SELECT 1 x FROM reviews WHERE booking_id=?', b.id) });
app.get('/api/bookings', auth, wrap((req: any, res: any) => {
  const v = myVendor(req.user.id);
  res.json((req.user.role === 'vendor' && v ? q('SELECT * FROM bookings WHERE vendor_id=? ORDER BY id DESC', v.id) : q('SELECT * FROM bookings WHERE couple_id=? ORDER BY id DESC', req.user.id)).map(bookingView));
}));
// MOCK payment: marks milestone as held in escrow. Replace with PaymentProvider (Razorpay Route etc.)
app.post('/api/milestones/:id/pay', auth, wrap((req: any, res: any) => {
  const m = one('SELECT * FROM milestones WHERE id=?', req.params.id); const b = m && one('SELECT * FROM bookings WHERE id=?', m.booking_id);
  if (!b || b.couple_id !== req.user.id) throw fail(403, 'Not your booking'); if (b.status !== 'confirmed') throw fail(409, 'Booking is not active'); if (m.status !== 'pending') throw fail(409, 'Already paid');
  db.exec('BEGIN'); try { run("UPDATE milestones SET status='held' WHERE id=?", m.id); run('INSERT INTO ledger(booking_id,milestone_id,kind,amount_paise,idem) VALUES(?,?,?,?,?)', b.id, m.id, 'escrow_in', m.amount_paise, `in-${m.id}`); db.exec('COMMIT'); } catch (x) { db.exec('ROLLBACK'); throw x; }
  res.json({ ok: true, mock: true });
}));
app.post('/api/milestones/:id/release', auth, wrap((req: any, res: any) => {
  const m = one('SELECT * FROM milestones WHERE id=?', req.params.id); const b = m && one('SELECT * FROM bookings WHERE id=?', m.booking_id);
  if (!b || b.couple_id !== req.user.id) throw fail(403, 'Only the couple can release'); if (b.status !== 'confirmed') throw fail(409, 'Booking is not active'); if (m.status !== 'held') throw fail(409, 'Not in escrow');
  const fee = Math.round(m.amount_paise * b.commission_bps / 10000);
  db.exec('BEGIN'); try { run("UPDATE milestones SET status='released' WHERE id=?", m.id); run('INSERT INTO ledger(booking_id,milestone_id,kind,amount_paise,idem) VALUES(?,?,?,?,?)', b.id, m.id, 'payout', m.amount_paise - fee, `out-${m.id}`); run('INSERT INTO ledger(booking_id,milestone_id,kind,amount_paise,idem) VALUES(?,?,?,?,?)', b.id, m.id, 'commission', fee, `fee-${m.id}`);
    if (!one("SELECT 1 x FROM milestones WHERE booking_id=? AND status!='released'", b.id)) run("UPDATE bookings SET status='completed' WHERE id=?", b.id); db.exec('COMMIT'); } catch (x) { db.exec('ROLLBACK'); throw x; }
  res.json({ ok: true, payout_paise: m.amount_paise - fee, commission_paise: fee });
}));
app.get('/api/payouts', auth, wrap((req: any, res: any) => {
  const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only');
  const rows = q("SELECT l.* FROM ledger l JOIN bookings b ON b.id=l.booking_id WHERE b.vendor_id=? AND l.kind='payout' ORDER BY l.id DESC", v.id);
  const held = one("SELECT COALESCE(SUM(m.amount_paise),0) s FROM milestones m JOIN bookings b ON b.id=m.booking_id WHERE b.vendor_id=? AND m.status='held'", v.id).s;
  res.json({ released_paise: rows.reduce((s, r) => s + r.amount_paise, 0), in_escrow_paise: held, rows });
}));
app.post('/api/bookings/:id/review', auth, wrap((req: any, res: any) => {
  const b = one('SELECT * FROM bookings WHERE id=?', req.params.id); if (!b || b.couple_id !== req.user.id) throw fail(403, 'Not your booking');
  if (!one("SELECT 1 x FROM milestones WHERE booking_id=? AND status IN ('held','released')", b.id)) throw fail(403, 'Only paid, verified bookings can be reviewed');
  const r = z.object({ rating: z.number().int().min(1).max(5), text: z.string().max(500).default('') }).parse(req.body);
  if (one('SELECT 1 x FROM reviews WHERE booking_id=?', b.id)) throw fail(409, 'Already reviewed');
  run('INSERT INTO reviews(booking_id,vendor_id,user_id,rating,text) VALUES(?,?,?,?,?)', b.id, b.vendor_id, req.user.id, r.rating, r.text); res.json({ ok: true });
}));
mountCatalog(app, auth, wrap);
mountPlanner(app, auth, myWedding, wrap);
mountExtras(app, auth, myWedding, myVendor, () => []);
app.get('/health', (_q, r) => { r.json({ ok: true }); });
mountSite(app); // legal pages, SEO files, landing page and 404; must mount last so it doesn't shadow API/extras routes
app.use((e: any, _q: any, res: any, _n: any) => res.status(e.status || 500).json({ error: e.message }));
if (process.argv[1]?.endsWith('server.ts')) app.listen(Number(process.env.PORT) || 4600, '0.0.0.0', () => console.log('API on :4600'));
