import express from 'express'; import { z } from 'zod'; import { randomBytes } from 'node:crypto';
import { db, q, one, run } from './db.ts';
import { dateSchema } from './planner.ts';
import { UPLOAD_DIR } from './catalog.ts';
import { unlinkSync } from 'node:fs';
db.exec(`
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, wedding_id INT, name TEXT, date TEXT, venue TEXT, dress TEXT, sort INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS guest_events(guest_id INT, event_id INT, rsvp TEXT DEFAULT 'pending', PRIMARY KEY(guest_id, event_id));
CREATE TABLE IF NOT EXISTS gifts(id INTEGER PRIMARY KEY, wedding_id INT, giver TEXT, event_id INT, kind TEXT, amount_paise INT, description TEXT, thanked INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stays(id INTEGER PRIMARY KEY, wedding_id INT, guest_name TEXT, people INT DEFAULT 1, hotel TEXT, room TEXT, check_in TEXT, check_out TEXT, arrival TEXT, pickup INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY, wedding_id INT, phone TEXT, name TEXT, role TEXT, UNIQUE(wedding_id,phone));
CREATE TABLE IF NOT EXISTS shortlist(id INTEGER PRIMARY KEY, wedding_id INT, vendor_id INT, UNIQUE(wedding_id,vendor_id));
CREATE TABLE IF NOT EXISTS votes(id INTEGER PRIMARY KEY, shortlist_id INT, user_id INT, vote INT, comment TEXT, UNIQUE(shortlist_id,user_id));
CREATE TABLE IF NOT EXISTS disputes(id INTEGER PRIMARY KEY, booking_id INT, raised_by INT, reason TEXT, status TEXT DEFAULT 'open', resolution TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS blocked_dates(id INTEGER PRIMARY KEY, vendor_id INT, date TEXT, note TEXT, UNIQUE(vendor_id,date));
CREATE TABLE IF NOT EXISTS crm_notes(id INTEGER PRIMARY KEY, vendor_id INT, client TEXT, stage TEXT DEFAULT 'lead', note TEXT, follow_up TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invites(wedding_id INTEGER PRIMARY KEY, theme TEXT DEFAULT 'maroon', message TEXT, slug TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS consents(id INTEGER PRIMARY KEY, user_id INT, purpose TEXT, granted INT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor INT, action TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const wrap = (f: any) => (req: any, res: any) => { const report = (e: any) => res.status(e instanceof z.ZodError ? 400 : e.status || 500).json({ error: e instanceof z.ZodError ? e.issues[0].message : e.message }); try { return Promise.resolve(f(req, res)).catch(report); } catch (e) { return report(e); } };
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const TEMPLATES: Record<string, string[]> = {
  'North Indian Hindu': ['Roka', 'Sagai', 'Haldi', 'Mehndi', 'Sangeet', 'Pheras', 'Reception'],
  'South Indian': ['Nischayathartham', 'Mehndi', 'Muhurtham', 'Reception'],
  'Bengali': ['Aiburobhat', 'Gaye Holud', 'Biye', 'Bou Bhaat'],
  'Gujarati': ['Griha Shanti', 'Mameru', 'Sangeet', 'Pheras', 'Reception'],
  'Marathi': ['Sakhar Puda', 'Halad', 'Mangal Snan', 'Lagna', 'Reception'],
  'Punjabi/Sikh': ['Roka', 'Mehndi', 'Sangeet', 'Anand Karaj', 'Reception'],
  'Muslim': ['Mangni', 'Mehndi', 'Nikah', 'Walima'],
  'Christian': ['Engagement', 'Church Wedding', 'Reception'],
  'Jain': ['Sagai', 'Mehndi', 'Pheras', 'Reception'],
  'Inter-faith': ['Court Registration', 'Cocktail', 'Reception'],
};
export function mountExtras(app: any, auth: any, myWedding: (u: number) => any, myVendor: (u: number) => any, adminIds: () => number[]) {
  const W = (req: any) => { const w = myWedding(req.user.id) || one('SELECT w.* FROM weddings w JOIN members m ON m.wedding_id=w.id JOIN users u ON u.phone=m.phone WHERE u.id=?', req.user.id); if (!w) throw fail(400, 'Create your wedding first'); return w; };
  const role = (req: any, w: any) => w.owner_id === req.user.id ? 'owner' : (one('SELECT m.role FROM members m JOIN users u ON u.phone=m.phone WHERE m.wedding_id=? AND u.id=?', w.id, req.user.id)?.role || 'none');
  const canEdit = (req: any, w: any) => ['owner', 'editor'].includes(role(req, w));
  const audit = (a: number, action: string, d: any) => run('INSERT INTO audit(actor,action,detail) VALUES(?,?,?)', a, action, JSON.stringify(d));

  app.get('/api/templates', (_q: any, r: any) => r.json(Object.keys(TEMPLATES)));
  // multi-event timeline
  app.post('/api/events/generate', auth, wrap((req: any, res: any) => {
    const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only');
    const names = TEMPLATES[w.community] || TEMPLATES['North Indian Hindu']; const d = new Date(w.date);
    const existing = new Set(q('SELECT name FROM events WHERE wedding_id=?', w.id).map(event => String(event.name).toLocaleLowerCase()));
    names.forEach((n, i) => { if (!existing.has(n.toLocaleLowerCase())) run('INSERT INTO events(wedding_id,name,date,sort) VALUES(?,?,?,?)', w.id, n, new Date(d.getTime() - (names.length - 1 - i) * 864e5).toISOString().slice(0, 10), i); }); res.json({ ok: true });
  }));
  app.get('/api/events', auth, wrap((req: any, res: any) => res.json(q("SELECT * FROM events WHERE wedding_id=? ORDER BY COALESCE(date,'9999-12-31'),sort,id", W(req).id))));
  app.post('/api/events', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); const b = z.object({ name: z.string().trim().min(2).max(100), date: dateSchema.optional(), venue: z.string().trim().max(120).optional() }).parse(req.body); if (one('SELECT id FROM events WHERE wedding_id=? AND lower(name)=lower(?)', w.id, b.name)) throw fail(409, 'This celebration is already in your plan'); const sort = one('SELECT COALESCE(MAX(sort),-1)+1 next FROM events WHERE wedding_id=?', w.id).next; const id = Number(run('INSERT INTO events(wedding_id,name,date,venue,sort) VALUES(?,?,?,?,?)', w.id, b.name, b.date || null, b.venue || '', sort).lastInsertRowid); res.status(201).json(one('SELECT * FROM events WHERE id=?', id)); }));
  app.put('/api/events/:id', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); const b = z.object({ name: z.string().trim().min(2).max(100).optional(), date: z.union([dateSchema, z.literal('')]).optional(), venue: z.string().trim().max(120).optional(), dress: z.string().trim().max(80).optional() }).parse(req.body); const event = one('SELECT * FROM events WHERE id=? AND wedding_id=?', req.params.id, w.id); if (!event) throw fail(404, 'Celebration not found'); if (b.name && b.name !== event.name && one('SELECT id FROM events WHERE wedding_id=? AND lower(name)=lower(?) AND id!=?', w.id, b.name, event.id)) throw fail(409, 'This celebration is already in your plan'); run('UPDATE events SET name=?,date=?,venue=?,dress=? WHERE id=? AND wedding_id=?', b.name ?? event.name, b.date === undefined ? event.date : b.date || null, b.venue ?? event.venue, b.dress ?? event.dress, event.id, w.id); res.json({ ok: true }); }));
  app.delete('/api/events/:id', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); run('DELETE FROM guest_events WHERE event_id IN (SELECT id FROM events WHERE id=? AND wedding_id=?)', req.params.id, w.id); if (!run('DELETE FROM events WHERE id=? AND wedding_id=?', req.params.id, w.id).changes) throw fail(404, 'Celebration not found'); res.json({ ok: true }); }));
  // Shagun and gift register. Amounts are budget information, so plain viewers don't see it.
  const seesMoney = (req: any, w: any) => ['owner', 'editor', 'budget_viewer'].includes(role(req, w));
  const giftBody = z.object({ giver: z.string().trim().min(1).max(120), event_id: z.number().int().nullable().optional(), kind: z.enum(['cash', 'gift']), amount_paise: z.number().int().positive().max(100_000_000_000).nullable().optional(), description: z.string().trim().max(300).optional() });
  app.get('/api/gifts', auth, wrap((req: any, res: any) => { const w = W(req); if (!seesMoney(req, w)) throw fail(403, 'Only people who can see the budget can see gifts');
    res.json(q('SELECT g.*, e.name event_name FROM gifts g LEFT JOIN events e ON e.id=g.event_id WHERE g.wedding_id=? ORDER BY g.id DESC', w.id)); }));
  app.post('/api/gifts', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); const b = giftBody.parse(req.body);
    if (b.event_id && !one('SELECT 1 x FROM events WHERE id=? AND wedding_id=?', b.event_id, w.id)) throw fail(404, 'Ceremony not found');
    if (b.kind === 'cash' && !b.amount_paise) throw fail(400, 'Enter the amount');
    res.json({ id: Number(run('INSERT INTO gifts(wedding_id,giver,event_id,kind,amount_paise,description) VALUES(?,?,?,?,?,?)', w.id, b.giver, b.event_id || null, b.kind, b.kind === 'cash' ? b.amount_paise : null, b.description || '').lastInsertRowid) }); }));
  app.patch('/api/gifts/:id', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); const { thanked } = z.object({ thanked: z.boolean() }).parse(req.body);
    if (!run('UPDATE gifts SET thanked=? WHERE id=? AND wedding_id=?', thanked ? 1 : 0, req.params.id, w.id).changes) throw fail(404, 'Gift not found'); res.json({ ok: true }); }));
  app.delete('/api/gifts/:id', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only');
    if (!run('DELETE FROM gifts WHERE id=? AND wedding_id=?', req.params.id, w.id).changes) throw fail(404, 'Gift not found'); res.json({ ok: true }); }));

  // Outstation guests: where they stay, when they arrive and whether someone must pick them up.
  const stayBody = z.object({ guest_name: z.string().trim().min(1).max(120), people: z.number().int().min(1).max(50).default(1), hotel: z.string().trim().max(120).optional(), room: z.string().trim().max(40).optional(),
    check_in: dateSchema.nullable().optional(), check_out: dateSchema.nullable().optional(), arrival: z.string().trim().max(160).optional(), pickup: z.boolean().default(false) })
    .refine(b => !b.check_in || !b.check_out || b.check_out >= b.check_in, 'Check-out must be on or after check-in');
  const stayArgs = (b: any) => [b.guest_name, b.people, b.hotel || '', b.room || '', b.check_in || null, b.check_out || null, b.arrival || '', b.pickup ? 1 : 0];
  app.get('/api/stays', auth, wrap((req: any, res: any) => { const w = W(req); res.json(q("SELECT * FROM stays WHERE wedding_id=? ORDER BY COALESCE(check_in,'9999-12-31'), id", w.id)); }));
  app.post('/api/stays', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only');
    res.json({ id: Number(run('INSERT INTO stays(guest_name,people,hotel,room,check_in,check_out,arrival,pickup,wedding_id) VALUES(?,?,?,?,?,?,?,?,?)', ...stayArgs(stayBody.parse(req.body)), w.id).lastInsertRowid) }); }));
  app.put('/api/stays/:id', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only');
    if (!run('UPDATE stays SET guest_name=?,people=?,hotel=?,room=?,check_in=?,check_out=?,arrival=?,pickup=? WHERE id=? AND wedding_id=?', ...stayArgs(stayBody.parse(req.body)), req.params.id, w.id).changes) throw fail(404, 'Stay not found'); res.json({ ok: true }); }));
  app.delete('/api/stays/:id', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only');
    if (!run('DELETE FROM stays WHERE id=? AND wedding_id=?', req.params.id, w.id).changes) throw fail(404, 'Stay not found'); res.json({ ok: true }); }));

  // Guests per ceremony: who is invited to which event, each with their own reply, and headcounts for caterers.
  app.get('/api/guest-events', auth, wrap((req: any, res: any) => { const w = W(req);
    res.json(q('SELECT ge.guest_id, ge.event_id, ge.rsvp FROM guest_events ge JOIN guests g ON g.id=ge.guest_id WHERE g.wedding_id=?', w.id)); }));
  app.put('/api/guests/:id/events/:eventId', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only');
    const { invited } = z.object({ invited: z.boolean() }).parse(req.body);
    if (!one('SELECT 1 x FROM guests WHERE id=? AND wedding_id=?', req.params.id, w.id) || !one('SELECT 1 x FROM events WHERE id=? AND wedding_id=?', req.params.eventId, w.id)) throw fail(404, 'Guest or ceremony not found');
    if (invited) run('INSERT OR IGNORE INTO guest_events(guest_id, event_id) VALUES(?,?)', req.params.id, req.params.eventId);
    else run('DELETE FROM guest_events WHERE guest_id=? AND event_id=?', req.params.id, req.params.eventId);
    res.json({ ok: true }); }));
  app.get('/api/events/headcount', auth, wrap((req: any, res: any) => { const w = W(req);
    res.json(q(`SELECT e.id, e.name, e.date, COUNT(ge.guest_id) invited,
      COALESCE(SUM(CASE WHEN ge.rsvp='yes' THEN 1 + g.plus_ones ELSE 0 END),0) coming,
      COALESCE(SUM(CASE WHEN ge.rsvp='no' THEN 1 ELSE 0 END),0) declined,
      COALESCE(SUM(CASE WHEN ge.rsvp='pending' THEN 1 ELSE 0 END),0) waiting,
      COALESCE(SUM(CASE WHEN ge.rsvp='yes' AND g.meal='Jain' THEN 1 ELSE 0 END),0) jain,
      COALESCE(SUM(CASE WHEN ge.rsvp='yes' AND g.meal='Non-veg' THEN 1 ELSE 0 END),0) nonveg
      FROM events e LEFT JOIN guest_events ge ON ge.event_id=e.id LEFT JOIN guests g ON g.id=ge.guest_id
      WHERE e.wedding_id=? GROUP BY e.id ORDER BY COALESCE(e.date,'9999-12-31'), e.sort, e.id`, w.id)); }));
  // family collaboration
  app.get('/api/members', auth, wrap((req: any, res: any) => res.json({ role: role(req, W(req)), members: q('SELECT * FROM members WHERE wedding_id=?', W(req).id) })));
  app.post('/api/members', auth, wrap((req: any, res: any) => { const w = W(req); if (w.owner_id !== req.user.id) throw fail(403, 'Only the owner can invite'); const b = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/), name: z.string().min(1), role: z.enum(['editor', 'viewer', 'budget_viewer']) }).parse(req.body); run('INSERT OR REPLACE INTO members(wedding_id,phone,name,role) VALUES(?,?,?,?)', w.id, b.phone, b.name, b.role); res.json({ ok: true }); }));
  // shortlist + family voting
  app.post('/api/shortlist', auth, wrap((req: any, res: any) => { const w = W(req); const { vendor_id } = z.object({ vendor_id: z.number().int() }).parse(req.body); run('INSERT OR IGNORE INTO shortlist(wedding_id,vendor_id) VALUES(?,?)', w.id, vendor_id); res.json({ ok: true }); }));
  app.get('/api/shortlist', auth, wrap((req: any, res: any) => res.json(q(`SELECT s.id,v.id vendor_id,v.name,v.category,v.city,v.start_paise,(SELECT COUNT(*) FROM votes WHERE shortlist_id=s.id AND vote=1) up,(SELECT COUNT(*) FROM votes WHERE shortlist_id=s.id AND vote=-1) down FROM shortlist s JOIN vendors v ON v.id=s.vendor_id WHERE s.wedding_id=?`, W(req).id))));
  app.post('/api/shortlist/:id/vote', auth, wrap((req: any, res: any) => { const w = W(req); if (!one('SELECT 1 x FROM shortlist WHERE id=? AND wedding_id=?', req.params.id, w.id)) throw fail(404, 'Not found'); const b = z.object({ vote: z.number().refine(v => v === 1 || v === -1), comment: z.string().max(200).optional() }).parse(req.body); run('INSERT OR REPLACE INTO votes(shortlist_id,user_id,vote,comment) VALUES(?,?,?,?)', req.params.id, req.user.id, b.vote, b.comment || ''); res.json({ ok: true }); }));
  // vendor calendar + availability
  app.post('/api/vendor/block', auth, wrap((req: any, res: any) => { const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only'); const b = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(80).optional() }).parse(req.body); run('INSERT OR REPLACE INTO blocked_dates(vendor_id,date,note) VALUES(?,?,?)', v.id, b.date, b.note || ''); res.json({ ok: true }); }));
  app.delete('/api/vendor/block/:date', auth, wrap((req: any, res: any) => { const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only'); run('DELETE FROM blocked_dates WHERE vendor_id=? AND date=?', v.id, req.params.date); res.json({ ok: true }); }));
  app.get('/api/vendor/calendar', auth, wrap((req: any, res: any) => { const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only'); res.json({ blocked: q('SELECT * FROM blocked_dates WHERE vendor_id=? ORDER BY date', v.id), booked: q("SELECT e.event_date date,u.name client FROM bookings b JOIN enquiries e ON e.id=b.enquiry_id JOIN users u ON u.id=b.couple_id WHERE b.vendor_id=? AND b.status!='cancelled'", v.id) }); }));
  app.get('/api/vendors/:id/availability', wrap((req: any, res: any) => { const d = String(req.query.date || ''); const v = req.params.id; const busy = one('SELECT 1 x FROM blocked_dates WHERE vendor_id=? AND date=?', v, d) || one("SELECT 1 x FROM bookings b JOIN enquiries e ON e.id=b.enquiry_id WHERE b.vendor_id=? AND e.event_date=? AND b.status!='cancelled'", v, d); res.json({ available: !busy }); }));
  // CRM
  app.get('/api/crm', auth, wrap((req: any, res: any) => { const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only'); res.json(q('SELECT * FROM crm_notes WHERE vendor_id=? ORDER BY id DESC', v.id)); }));
  app.post('/api/crm', auth, wrap((req: any, res: any) => { const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only'); const b = z.object({ client: z.string().min(1), stage: z.enum(['lead', 'contacted', 'quoted', 'won', 'lost']).default('lead'), note: z.string().max(300).optional(), follow_up: z.string().optional() }).parse(req.body); run('INSERT INTO crm_notes(vendor_id,client,stage,note,follow_up) VALUES(?,?,?,?,?)', v.id, b.client, b.stage, b.note || '', b.follow_up || null); res.json({ ok: true }); }));
  app.patch('/api/crm/:id', auth, wrap((req: any, res: any) => { const v = myVendor(req.user.id); if (!v) throw fail(403, 'Vendors only'); const { stage } = z.object({ stage: z.enum(['lead', 'contacted', 'quoted', 'won', 'lost']) }).parse(req.body); run('UPDATE crm_notes SET stage=? WHERE id=? AND vendor_id=?', stage, req.params.id, v.id); res.json({ ok: true }); }));
  // GST invoice for platform commission (18% on commission), printable HTML. FLAG: CA review needed.
  app.get('/api/bookings/:id/invoice', auth, wrap((req: any, res: any) => {
    const b = one('SELECT * FROM bookings WHERE id=?', req.params.id); const v = b && myVendor(req.user.id); if (!b || !v || v.id !== b.vendor_id) throw fail(403, 'Not yours');
    const fee = Math.round(b.total_paise * b.commission_bps / 10000), gst = Math.round(fee * 0.18);
    res.json({ invoice_no: `SOS-${String(b.id).padStart(6, '0')}`, booking_id: b.id, sac: '998599', commission_paise: fee, gst_paise: gst, total_paise: fee + gst, note: 'Draft for CA review. TCS/TDS not applied.' });
  }));
  // disputes (48h window is a policy, enforced by ops)
  app.post('/api/bookings/:id/dispute', auth, wrap((req: any, res: any) => { const b = one('SELECT * FROM bookings WHERE id=?', req.params.id); const v = myVendor(req.user.id); if (!b || (b.couple_id !== req.user.id && v?.id !== b.vendor_id)) throw fail(403, 'Not yours'); const { reason } = z.object({ reason: z.string().min(10).max(500) }).parse(req.body); run("UPDATE bookings SET status='disputed' WHERE id=?", b.id); run('INSERT INTO disputes(booking_id,raised_by,reason) VALUES(?,?,?)', b.id, req.user.id, reason); res.json({ ok: true }); }));
  // admin (ADMIN_PHONES env, comma-separated). Verification, dispute resolution, audit log.
  const admin = (req: any, _r: any, next: any) => { const u = one('SELECT phone FROM users WHERE id=?', req.user.id); if (!(process.env.ADMIN_PHONES || '9999999999').split(',').includes(u?.phone)) return next(fail(403, 'Admins only')); next(); };
  app.get('/api/admin/summary', auth, admin, wrap((_q: any, r: any) => r.json({ vendors: one('SELECT COUNT(*) n FROM vendors').n, unverified: one('SELECT COUNT(*) n FROM vendors WHERE verified=0').n, bookings: one('SELECT COUNT(*) n FROM bookings').n, gmv_paise: one('SELECT COALESCE(SUM(total_paise),0) s FROM bookings').s, commission_paise: one("SELECT COALESCE(SUM(amount_paise),0) s FROM ledger WHERE kind='commission'").s, open_disputes: one("SELECT COUNT(*) n FROM disputes WHERE status='open'").n })));
  app.get('/api/admin/vendors', auth, admin, wrap((_q: any, r: any) => r.json(q('SELECT * FROM vendors WHERE verified=0 AND sample=0 AND unclaimed=0'))));
  app.post('/api/admin/vendors/:id/verify', auth, admin, wrap((req: any, res: any) => { // Only businesses that joined with their own account can be verified; samples and unclaimed listings cannot.
    const v = one('SELECT sample, unclaimed FROM vendors WHERE id=?', req.params.id); if (!v) throw Object.assign(new Error('Vendor not found'), { status: 404 }); if (v.sample || v.unclaimed) throw Object.assign(new Error('Sample and unclaimed listings cannot be verified'), { status: 409 });
    run('UPDATE vendors SET verified=1 WHERE id=?', req.params.id); audit(req.user.id, 'verify_vendor', { id: req.params.id }); res.json({ ok: true }); }));
  app.get('/api/admin/disputes', auth, admin, wrap((_q: any, r: any) => r.json(q("SELECT * FROM disputes WHERE status='open'"))));
  app.post('/api/admin/disputes/:id/resolve', auth, admin, wrap((req: any, res: any) => { const b = z.object({ resolution: z.string().min(3), booking_status: z.enum(['confirmed', 'cancelled', 'completed']) }).parse(req.body); const d = one('SELECT * FROM disputes WHERE id=?', req.params.id); if (!d) throw fail(404, 'Not found'); run("UPDATE disputes SET status='resolved',resolution=? WHERE id=?", b.resolution, d.id); run('UPDATE bookings SET status=? WHERE id=?', b.booking_status, d.booking_id); audit(req.user.id, 'resolve_dispute', { id: d.id }); res.json({ ok: true }); }));
  app.get('/api/admin/audit', auth, admin, wrap((_q: any, r: any) => r.json(q('SELECT * FROM audit ORDER BY id DESC LIMIT 100'))));
  // DPDP: consent log, data export, deletion
  app.post('/api/consent', auth, wrap((req: any, res: any) => { const b = z.object({ purpose: z.enum(['marketing', 'contacts', 'face_grouping']), granted: z.boolean() }).parse(req.body); run('INSERT INTO consents(user_id,purpose,granted) VALUES(?,?,?)', req.user.id, b.purpose, b.granted ? 1 : 0); res.json({ ok: true }); }));
  // DPDP export: everything this account created, including the wedding it owns.
  app.get('/api/my-data', auth, wrap((req: any, res: any) => {
    const w = myWedding(req.user.id); const id = w?.id ?? -1;
    res.json({ user: one('SELECT * FROM users WHERE id=?', req.user.id), consents: q('SELECT * FROM consents WHERE user_id=?', req.user.id), wedding: w || null,
      tasks: q('SELECT * FROM tasks WHERE wedding_id=?', id), budget: q('SELECT * FROM budget_items WHERE wedding_id=?', id), events: q('SELECT * FROM events WHERE wedding_id=?', id),
      guests: q('SELECT * FROM guests WHERE wedding_id=?', id), guest_events: q('SELECT ge.* FROM guest_events ge JOIN guests g ON g.id=ge.guest_id WHERE g.wedding_id=?', id),
      family: q('SELECT * FROM members WHERE wedding_id=?', id), shortlist: q('SELECT * FROM shortlist WHERE wedding_id=?', id), invite: one('SELECT * FROM invites WHERE wedding_id=?', id) || null,
      gifts: q('SELECT * FROM gifts WHERE wedding_id=?', id), stays: q('SELECT * FROM stays WHERE wedding_id=?', id),
      enquiries: q('SELECT * FROM enquiries WHERE couple_id=?', req.user.id), messages: q('SELECT * FROM messages WHERE sender_id=?', req.user.id),
      bookings: q('SELECT * FROM bookings WHERE couple_id=?', req.user.id), reviews: q('SELECT * FROM reviews WHERE user_id=?', req.user.id) });
  }));
  // DPDP deletion: removes the profile and the wedding it owns. Bookings with money still held or due are kept,
  // with their chat, until they settle; the account row stays anonymised so those records remain consistent.
  app.delete('/api/my-data', auth, wrap((req: any, res: any) => {
    const uid = req.user.id; const phone = one('SELECT phone FROM users WHERE id=?', uid)?.phone; const w = myWedding(uid);
    db.exec('BEGIN');
    try {
      if (w) {
        const open = q("SELECT DISTINCT b.enquiry_id FROM bookings b JOIN milestones m ON m.booking_id=b.id WHERE b.wedding_id=? AND b.status!='cancelled' AND m.status IN ('pending','held')", w.id).map((r: any) => r.enquiry_id);
        const keep = open.length ? `AND id NOT IN (${open.map(() => '?').join(',')})` : '';
        for (const table of ['messages', 'quotes']) run(`DELETE FROM ${table} WHERE enquiry_id IN (SELECT id FROM enquiries WHERE wedding_id=? ${keep})`, w.id, ...open);
        run(`DELETE FROM enquiries WHERE wedding_id=? ${keep}`, w.id, ...open);
        run('DELETE FROM guest_events WHERE guest_id IN (SELECT id FROM guests WHERE wedding_id=?)', w.id);
        run('DELETE FROM votes WHERE shortlist_id IN (SELECT id FROM shortlist WHERE wedding_id=?)', w.id);
        for (const table of ['tasks', 'budget_items', 'guests', 'events', 'members', 'shortlist', 'invites', 'gifts', 'stays']) run(`DELETE FROM ${table} WHERE wedding_id=?`, w.id);
        if (open.length) run("UPDATE weddings SET title='Deleted wedding', city='', community='' WHERE id=?", w.id); else run('DELETE FROM weddings WHERE id=?', w.id);
      }
      const v = one('SELECT id FROM vendors WHERE user_id=?', uid);
      if (v) {
        for (const p of q('SELECT url FROM vendor_photos WHERE vendor_id=?', v.id)) if (/^\/uploads\/[0-9a-f]{24}\.(jpg|png|webp)$/.test(p.url)) { try { unlinkSync(`${UPLOAD_DIR}/${p.url.slice(9)}`); } catch { /* already gone */ } }
        for (const table of ['crm_notes', 'blocked_dates', 'vendor_photos', 'vendor_packages']) run(`DELETE FROM ${table} WHERE vendor_id=?`, v.id);
        if (one('SELECT 1 x FROM bookings WHERE vendor_id=?', v.id)) run("UPDATE vendors SET name='Deleted vendor', description='', locality='' WHERE id=?", v.id); else run('DELETE FROM vendors WHERE id=?', v.id);
      }
      if (phone) run('DELETE FROM members WHERE phone=?', phone);
      run('DELETE FROM votes WHERE user_id=?', uid);
      run("UPDATE users SET name='Deleted user', phone='del-'||id WHERE id=?", uid);
      audit(uid, 'data_deletion', { wedding: w?.id ?? null });
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.json({ ok: true });
  }));
  // e-invite micro-site (public)
  app.put('/api/invite', auth, wrap((req: any, res: any) => { const w = W(req); if (!canEdit(req, w)) throw fail(403, 'View only'); const b = z.object({ theme: z.enum(['maroon', 'emerald', 'royal', 'rose']).default('maroon'), message: z.string().max(300).optional() }).parse(req.body); const ex = one('SELECT slug FROM invites WHERE wedding_id=?', w.id); const slug = ex?.slug || randomBytes(4).toString('hex'); run('INSERT OR REPLACE INTO invites(wedding_id,theme,message,slug) VALUES(?,?,?,?)', w.id, b.theme, b.message || '', slug); res.json({ slug, path: `/w/${slug}` }); }));
  app.get('/api/invite', auth, wrap((req: any, res: any) => res.json(one('SELECT * FROM invites WHERE wedding_id=?', W(req).id) || null)));
  // gold accents lightened vs. the original hex for ~4.5:1 contrast on their dark pair, so small captions stay readable (WCAG AA)
  const themes: Record<string, [string, string]> = { maroon: ['#7A1F3D', '#E8C468'], emerald: ['#0B5D46', '#E6C769'], royal: ['#2B2A6F', '#E3C659'], rose: ['#B0475F', '#FBE3E8'] };
  app.get('/w/:slug', wrap((req: any, res: any) => {
    const i = one('SELECT * FROM invites WHERE slug=?', req.params.slug); if (!i) return res.status(404).send('Not found');
    const w = one('SELECT * FROM weddings WHERE id=?', i.wedding_id); const ev = q('SELECT * FROM events WHERE wedding_id=? ORDER BY date,sort', w.id); const [p, g] = themes[i.theme] || themes.maroon;
    res.send(`<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1"><title>${esc(w.title)} · Wedding invite</title><meta name=description content="You're invited to ${esc(w.title)}'s wedding on ${esc(w.date)} in ${esc(w.city)}."><link rel=icon href="/favicon.png"><meta property=og:title content="${esc(w.title)}"><meta property=og:description content="${esc(i.message || `Join us on ${w.date} in ${w.city}`)}"><body style="margin:0;font-family:Georgia,serif;background:#fffaf3;color:#2b1b22;text-align:center"><div style="background:${p};color:#fff;padding:60px 20px"><div style="color:${g};letter-spacing:4px;font-size:12px">TOGETHER WITH THEIR FAMILIES</div><h1 style="font-size:38px;margin:14px 0">${esc(w.title)}</h1><div>${esc(w.date)} · ${esc(w.city)}</div></div><p style="max-width:420px;margin:24px auto;padding:0 16px">${esc(i.message)}</p><div style="max-width:420px;margin:auto;padding:0 16px">${ev.map((e: any) => `<div style="border:1px solid ${g};border-radius:10px;padding:12px;margin:10px 0"><b>${esc(e.name)}</b><br>${esc(e.date)}${e.venue ? '<br>' + esc(e.venue) : ''}${e.dress ? '<br><i>Dress: ' + esc(e.dress) + '</i>' : ''}</div>`).join('')}</div><p style="color:#777;margin:40px 0 20px;font-size:12px">Planning your own wedding? <a href="/" style="color:${p};font-weight:600">Start free with Shaadi OS</a>.</p>`);
  }));
}
