import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { readFileSync } from 'node:fs';
import { readRuntimeConfig } from './config.ts';

// Run against an isolated in-memory database, never the user's wedding data.
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-test-secret';
const { app } = await import('./server.ts');
const { db, one } = await import('./db.ts');
let couple: string; let outsider: string; let vendor: string;
test('demo server cannot start in production even with provider-like credentials', () => {
  assert.throws(() => readRuntimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'long-secret', OTP_PROVIDER: 'real', SEED_DEMO_DATA: 'false' }), /Production startup is disabled/);
});
test('a fresh staging directory can disable fictional vendors without changing the demo default', () => {
  assert.equal(readRuntimeConfig({ NODE_ENV: 'development' }).seedDemoData, true);
  assert.equal(readRuntimeConfig({ NODE_ENV: 'staging', SEED_DEMO_DATA: 'false' }).seedDemoData, false);
  assert.throws(() => readRuntimeConfig({ SEED_DEMO_DATA: 'False' }), /must be true or false/);
});
async function transport(path: string, token = '', method = 'GET', body?: unknown, form = false): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = new Duplex({ read() {}, write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    const req = new IncomingMessage(socket as any);
    req.url = path; req.method = method;
    const encoded = body === undefined ? '' : form ? String(body) : JSON.stringify(body);
    req.headers = { host: 'localhost', 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json', 'content-length': String(Buffer.byteLength(encoded)), ...(token ? { authorization: 'Bearer ' + token } : {}) };
    const res = new ServerResponse(req); res.assignSocket(socket as any);
    res.on('finish', () => {
      const raw = Buffer.concat(chunks).toString(); const text = raw.slice(raw.indexOf('\r\n\r\n') + 4);
      try { resolve({ status: res.statusCode, data: form ? text : JSON.parse(text) }); } catch (e) { reject(new Error('Invalid response: ' + text)); }
    });
    socket.on('error', reject);
    (app as any)(req, res);
    req.push(encoded || null); if (encoded) req.push(null);
  });
}
const request = transport;
async function login(phone: string) {
  const r = await request('/api/auth/verify', '', 'POST', { phone, otp: '123456', role: 'couple', name: 'Test couple' });
  assert.equal(r.status, 200); return r.data.token as string;
}
before(async () => {
  couple = await login('9812300091'); outsider = await login('9812300092'); vendor = await login('9000000001');
});
after(() => { db.close(); });

test('portfolio photos require permission, reject unsafe links and belong to their vendor', async () => {
  const otherVendor = await login('9000000002');
  const photo = { url: 'https://portfolio.example/wedding.jpg', caption: 'Test portfolio', permission_confirmed: true };
  assert.equal((await request('/api/vendor/photos', couple, 'POST', photo)).status, 403);
  assert.equal((await request('/api/vendor/photos', vendor, 'POST', { ...photo, permission_confirmed: false })).status, 400);
  for (const url of ['http://portfolio.example/wedding.jpg', 'https://127.0.0.1/pic', 'https://localhost/pic', 'https://owner:password@portfolio.example/pic']) {
    assert.equal((await request('/api/vendor/photos', vendor, 'POST', { ...photo, url })).status, 400);
  }
  const added = await request('/api/vendor/photos', vendor, 'POST', photo);
  assert.equal(added.status, 201); assert.equal(added.data.photos.length, 1);
  assert.equal((await request('/api/vendor/photos', vendor, 'POST', photo)).status, 409);
  const id = added.data.photos[0].id;
  assert.equal((await request(`/api/vendor/photos/${id}`, otherVendor, 'DELETE')).status, 404);
  const publicProfile = (await request('/api/vendors/1')).data;
  assert.equal(publicProfile.photos[0].url, photo.url);
  assert.equal(publicProfile.photos[0].permission_confirmed, undefined);
  assert.equal((await request('/api/vendors')).data.find((item: any) => item.id === 1).cover_url, photo.url);
  assert.equal((await request(`/api/vendor/photos/${id}`, vendor, 'DELETE')).data.photos.length, 0);
});
test('packages preserve integer paise and cannot be removed by another vendor', async () => {
  const otherVendor = await login('9000000002');
  const item = { title: 'One ceremony', description: 'Four hours of coverage and edited photos', price_paise: 6500001 };
  assert.equal((await request('/api/vendor/packages', vendor, 'POST', { ...item, price_paise: 1.5 })).status, 400);
  assert.equal((await request('/api/vendor/packages', couple, 'POST', item)).status, 403);
  const added = await request('/api/vendor/packages', vendor, 'POST', item);
  assert.equal(added.status, 201); assert.equal(added.data.packages[0].price_paise, 6500001);
  const id = added.data.packages[0].id;
  assert.equal((await request('/api/vendors/1')).data.packages[0].title, item.title);
  assert.equal((await request(`/api/vendor/packages/${id}`, otherVendor, 'DELETE')).status, 404);
  assert.equal((await request(`/api/vendor/packages/${id}`, vendor, 'DELETE')).data.packages.length, 0);
});
test('customer budget filtering returns matching starting prices and rejects invalid amounts', async () => {
  const result = await request('/api/vendors?max=25000');
  assert.equal(result.status, 200); assert.ok(result.data.length > 0);
  assert.ok(result.data.every((item: any) => item.start_paise <= 2500000));
  for (const max of ['-1', 'not-a-number', 'Infinity']) assert.equal((await request('/api/vendors?max=' + max)).status, 400);
});
test('website presents the new brand and links to customer browsing', async () => {
  const page = await transport('/', '', 'GET', undefined, true);
  assert.equal(page.status, 200);
  assert.ok(page.data.includes('/brand-icon-v3.png'));
  assert.ok(page.data.includes('href="/app?browse=1"'));
  assert.ok(page.data.includes('prefers-reduced-motion'));
  assert.ok(page.data.includes('payments are simulated'));
});
test('public site offers a date-aware Indian planning preview without saving a wedding', async () => {
  const start = await transport('/planning', '', 'GET', undefined, true);
  assert.equal(start.status, 200); assert.ok(start.data.includes('Build my preview'));
  const indian = await transport('/planning?date=2027-04-20&community=Punjabi%2FSikh', '', 'GET', undefined, true);
  assert.equal(indian.status, 200);
  assert.ok(indian.data.includes('Confirm baraat route'));
  assert.ok(indian.data.includes('Collect performance music'));
  assert.ok(!indian.data.includes('Plan mandap or ceremony decor'));
  assert.ok(indian.data.includes('Start now'));
  const christian = await transport('/planning?date=2027-04-20&community=Christian', '', 'GET', undefined, true);
  assert.ok(!christian.data.includes('Confirm baraat route'));
  assert.ok(!christian.data.includes('Confirm mehndi artists'));
  assert.equal((await transport('/planning?date=2027-02-30', '', 'GET', undefined, true)).data.includes('Enter a real wedding date.'), true);
  assert.equal((await transport('/planning?date=2027-04-20extra', '', 'GET', undefined, true)).data.includes('Enter a real wedding date.'), true);
  assert.equal(one('SELECT COUNT(*) n FROM weddings').n, 0);
});
test('public vendor directory filters actual listings and escapes submitted content', async () => {
  const listed = await transport('/vendors?city=Pune&category=caterer&budget=1000', '', 'GET', undefined, true);
  assert.equal(listed.status, 200);
  assert.ok(listed.data.includes('Spice Route Caterers'));
  assert.ok(!listed.data.includes('Royal Lawns'));
  const badBudget = await transport('/vendors?budget=-10', '', 'GET', undefined, true);
  assert.ok(badBudget.data.includes('Enter a positive budget'));
  const encoded = await transport('/vendors?search=%3Cscript%3E', '', 'GET', undefined, true);
  assert.ok(encoded.data.includes('value="&#60;script&#62;"'));
  assert.ok(!encoded.data.includes('value="<script>"'));
  await request('/api/vendor/photos', vendor, 'POST', { url: 'https://portfolio.example/real.jpg', caption: '<script>alert(1)</script>', permission_confirmed: true });
  await request('/api/vendor/packages', vendor, 'POST', { title: 'Ceremony coverage', description: 'Four hours of photography', price_paise: 6500000 });
  const profile = await transport('/vendors/1', '', 'GET', undefined, true);
  assert.equal(profile.status, 200);
  assert.ok(profile.data.includes('Ceremony coverage'));
  assert.ok(profile.data.includes('https://portfolio.example/real.jpg'));
  assert.ok(profile.data.includes('&#60;script&#62;alert(1)&#60;/script&#62;'));
  assert.ok(!profile.data.includes('<script>alert(1)</script>'));
  assert.equal((await transport('/vendors/999999', '', 'GET', undefined, true)).status, 404);
});
test('packaged customer app references an available JavaScript entry', () => {
  const page = readFileSync(new URL('../public/app/index.html', import.meta.url), 'utf8');
  const script = page.match(/<script src="([^"]+)"/);
  assert.ok(script, 'customer app must include its JavaScript entry');
  assert.match(script[1], /^\/_expo\/static\/js\/web\/[a-z0-9-]+\.js$/);
  const bundle = readFileSync(new URL('../public/app' + script[1], import.meta.url), 'utf8');
  assert.ok(bundle.length > 10000);
  assert.ok(!bundle.startsWith('<!DOCTYPE html>'));
});

test('wedding rejects impossible dates and invalid guest counts without partial data', async () => {
  for (const body of [{ date: '2027-02-30', guests_est: 200 }, { date: '2027-02-20', guests_est: -1 }]) {
    assert.equal((await request('/api/wedding', couple, 'POST', { title: 'A & B', city: 'Pune', budget_paise: 150000000, ...body })).status, 400);
  }
  assert.equal(one('SELECT COUNT(*) n FROM weddings').n, 0);
});
test('wedding seeds tasks and budget, overview reflects guest plus ones', async () => {
  assert.equal((await request('/api/wedding', couple, 'POST', { title: 'A & B', date: '2027-02-20', city: 'Pune', budget_paise: 150000000, guests_est: 200 })).status, 200);
  assert.equal((await request('/api/tasks', couple)).data.length, 10);
  await request('/api/guests', couple, 'POST', { name: 'Guest', side: 'bride' });
  const guest = (await request('/api/guests', couple)).data[0];
  const response = await transport('/rsvp/' + guest.token, '', 'POST', 'rsvp=yes&meal=Veg&plus=2', true);
  assert.equal(response.status, 200);
  const overview = await request('/api/planner/overview', couple);
  assert.equal(overview.data.guests.attending, 3); assert.equal(overview.data.tasks.total, 10);
  assert.equal((await request('/api/planner/overview', outsider)).status, 400);
  assert.equal((await request('/api/planner/overview')).status, 401);
});
test('planning guide adapts to a short engagement and imports optional tasks once', async () => {
  const dated = await request('/api/planner/guide', couple);
  assert.equal(dated.status, 200);
  assert.ok(dated.data.length > 15);
  const first = dated.data.find((item: any) => item.key === 'priorities');
  assert.ok(first); assert.equal(first.already_added, false);
  assert.equal(first.is_catch_up, true);
  assert.equal(first.due, new Date().toISOString().slice(0, 10));
  assert.equal((await request('/api/planner/guide', outsider)).status, 400);
  assert.equal((await request('/api/planner/guide/unknown', couple, 'POST')).status, 404);
  const added = await request('/api/planner/guide/priorities', couple, 'POST');
  assert.equal(added.status, 201);
  assert.equal(added.data.due, first.due);
  assert.equal((await request('/api/planner/guide/priorities', couple, 'POST')).status, 409);
  assert.equal((await request('/api/planner/guide', couple)).data.find((item: any) => item.key === 'priorities').already_added, true);
  const task = (await request('/api/tasks', couple)).data.find((item: any) => item.title === first.title);
  assert.ok(task);
  assert.equal((await request(`/api/tasks/${task.id}`, outsider, 'PATCH', { title: 'Changed' })).status, 400);
  assert.equal((await request(`/api/tasks/${task.id}`, couple, 'PATCH', { due: '2027-02-30' })).status, 400);
  assert.equal((await request(`/api/tasks/${task.id}`, couple, 'PATCH', { title: 'Our priorities', due: null })).status, 200);
  const edited = (await request('/api/tasks', couple)).data.find((item: any) => item.id === task.id);
  assert.equal(edited.title, 'Our priorities'); assert.equal(edited.due, null);
});
test('couples can choose ceremonies without duplicate templates or cross-wedding edits', async () => {
  assert.equal((await request('/api/events/generate', couple, 'POST')).status, 200);
  const initial = (await request('/api/events', couple)).data.length;
  assert.ok(initial > 3);
  assert.equal((await request('/api/events/generate', couple, 'POST')).status, 200);
  assert.equal((await request('/api/events', couple)).data.length, initial);
  assert.equal((await request('/api/events', couple, 'POST', { name: 'Family dinner', date: '2027-02-30' })).status, 400);
  const added = await request('/api/events', couple, 'POST', { name: 'Family dinner', date: '2027-02-18' });
  assert.equal(added.status, 201);
  assert.equal((await request('/api/events', couple, 'POST', { name: 'family DINNER' })).status, 409);
  assert.equal((await request(`/api/events/${added.data.id}`, outsider, 'PUT', { venue: 'Elsewhere' })).status, 400);
  assert.equal((await request(`/api/events/${added.data.id}`, couple, 'PUT', { venue: 'At home', date: '' })).status, 200);
  assert.equal((await request('/api/events', couple)).data.find((event: any) => event.id === added.data.id).date, null);
  assert.equal((await request(`/api/events/${added.data.id}`, couple, 'DELETE')).status, 200);
  assert.equal((await request(`/api/events/${added.data.id}`, couple, 'DELETE')).status, 404);
});
test('task updates validate booleans and do not cross wedding boundaries', async () => {
  await request('/api/wedding', outsider, 'POST', { title: 'C & D', date: '2027-03-20', city: 'Mumbai', budget_paise: 100000000 });
  const task = (await request('/api/tasks', couple)).data[0];
  assert.equal((await request('/api/tasks/' + task.id, outsider, 'PATCH', { done: true })).status, 404);
  assert.equal((await request('/api/tasks/' + task.id, couple, 'PATCH', { done: 'false' })).status, 400);
  assert.equal((await request('/api/tasks/' + task.id, couple, 'PATCH', { done: true })).status, 200);
  assert.equal((await request('/api/tasks/' + task.id, outsider, 'DELETE')).status, 404);
  assert.equal((await request('/api/tasks', couple, 'POST', { title: 'New task', due: '2027-02-30' })).status, 400);
  await request('/api/tasks', couple, 'POST', { title: 'New task', due: '2027-02-01' });
  const added = one("SELECT * FROM tasks WHERE title='New task'");
  assert.equal((await request('/api/tasks/' + added.id, couple, 'DELETE')).status, 200);
});
test('budget validates all categories and rejects overspending atomically', async () => {
  const b = (await request('/api/budget', couple)).data;
  const rows = b.rows.map((r: any) => ({ category: r.category, allocated_paise: r.allocated_paise }));
  assert.equal((await request('/api/budget', couple, 'PUT', { total_paise: 1, rows })).status, 400);
  assert.equal((await request('/api/budget', couple)).data.total_paise, b.total_paise);
  assert.equal((await request('/api/budget', couple, 'PUT', { total_paise: b.total_paise, rows: rows.slice(1) })).status, 400);
  assert.equal((await request('/api/budget', couple, 'PUT', { total_paise: b.total_paise, rows: [...rows.slice(0, -1), rows[0]] })).status, 400);
  assert.equal((await request('/api/budget', couple, 'PUT', { total_paise: b.total_paise + 10000, rows })).status, 200);
});
let booking: any;
test('booking milestone amounts exactly conserve odd-paise totals and prevent duplicate bookings', async () => {
  const e = await request('/api/enquiries', couple, 'POST', { vendor_id: 1, event_date: '2027-02-20', guests: 200, budget_paise: 101 });
  assert.equal(e.status, 200);
  const quote = await request(`/api/enquiries/${e.data.id}/quotes`, vendor, 'POST', { items: [{ label: 'Test service', amount_paise: 101 }], milestones: [{ label: 'First', pct: 33 }, { label: 'Second', pct: 33 }, { label: 'Last', pct: 34 }] });
  assert.equal(quote.status, 200);
  const id = (await request(`/api/enquiries/${e.data.id}`, couple)).data.quotes[0].id;
  assert.equal((await request(`/api/quotes/${id}/accept`, couple, 'POST')).status, 200);
  assert.equal((await request(`/api/quotes/${id}/accept`, couple, 'POST')).status, 409);
  assert.equal((await request(`/api/enquiries/${e.data.id}/quotes`, vendor, 'POST', { items: [{ label: 'Again', amount_paise: 100 }] })).status, 409);
  booking = (await request('/api/bookings', couple)).data[0];
  assert.equal(booking.milestones.reduce((sum: number, m: any) => sum + m.amount_paise, 0), 101);
});
test('payment and release enforce ownership, idempotency and dispute holds', async () => {
  const m = booking.milestones[0];
  assert.equal((await request(`/api/milestones/${m.id}/pay`, outsider, 'POST')).status, 403);
  assert.equal((await request(`/api/milestones/${m.id}/pay`, couple, 'POST')).status, 200);
  assert.equal((await request(`/api/milestones/${m.id}/pay`, couple, 'POST')).status, 409);
  await request(`/api/bookings/${booking.id}/dispute`, couple, 'POST', { reason: 'Service was not delivered as agreed' });
  assert.equal((await request(`/api/milestones/${m.id}/release`, couple, 'POST')).status, 409);
  assert.equal((await request(`/api/milestones/${booking.milestones[1].id}/pay`, couple, 'POST')).status, 409);
  assert.equal(one('SELECT status FROM milestones WHERE id=?', m.id).status, 'held');
});
test('roadmap tracks each vendor service and a month-by-month timeline', async () => {
  const r = await request('/api/planner/roadmap', couple);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.vendors.map((v: any) => v.category), ['venue', 'caterer', 'photographer', 'decor', 'makeup', 'mehndi', 'dj', 'pandit']);
  assert.ok(r.data.vendors.some((v: any) => v.stage === 'booked' && v.booked_vendor), 'a booked service names its vendor');
  assert.equal(r.data.booked_count, r.data.vendors.filter((v: any) => v.stage === 'booked').length);
  assert.equal(r.data.months[0].month, new Date().toISOString().slice(0, 7));
  assert.ok(r.data.months.every((m: any) => m.tasks.every((t: any) => !t.overdue || m.month === r.data.months[0].month)), 'overdue tasks surface in the current month');
});
test('real businesses import as unclaimed listings that cannot take enquiries', async () => {
  const { importListings, parseCsv } = await import('./import-listings.ts');
  const { writeFileSync, mkdtempSync } = await import('node:fs'); const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\n'), [['a', 'b, c', 'd "e"']]);
  const file = join(mkdtempSync(join(tmpdir(), 'listings-')), 'v.csv');
  writeFileSync(file, 'business_name,category,city,locality,website_or_instagram,source_url,notes\n"Test Lawns, Baner",venue,Pune,Baner,https://example.com/lawns,https://example.com/src,"lawns, 400 guests"\nBad Link,venue,Pune,,javascript:alert(1),,x\n');
  assert.deepEqual(importListings(file), { added: 1, updated: 0, skipped: ['Bad Link'] });
  assert.equal(importListings(file).updated, 1, 'a rerun updates instead of duplicating');
  const listed = (await request('/api/vendors?city=Pune&category=venue', couple)).data.find((v: any) => v.name === 'Test Lawns, Baner');
  assert.equal(listed.unclaimed, 1); assert.equal(listed.start_paise, null); assert.equal(listed.verified, 0); assert.equal(listed.website, 'https://example.com/lawns');
  const r = await request('/api/enquiries', couple, 'POST', { vendor_id: listed.id, event_date: '2027-02-14', guests: 200, budget_paise: 100000 });
  assert.equal(r.status, 409);
});
test('starter tasks on a short engagement are spread from today instead of overdue', async () => {
  const { starterDates } = await import('./server.ts');
  const now = new Date('2026-10-31T09:00:00Z');
  const dates = starterDates('2027-02-14', now).map(([, due]) => due);
  assert.ok(dates.every(d => d >= '2026-10-31'), 'nothing starts overdue');
  assert.deepEqual(dates.slice(0, 3), ['2026-10-31', '2026-11-07', '2026-11-14'], 'catch-up tasks a week apart, in order');
  assert.ok(dates.every(d => d <= '2027-02-14'));
  assert.equal(starterDates('2028-06-01', now)[0][1], '2027-06-02', 'a long engagement keeps the ideal dates');
});
test('guests reply per ceremony and headcounts follow', async () => {
  const haldi = (await request('/api/events', couple, 'POST', { name: 'Test Haldi', date: '2027-04-10' })).data;
  const sangeet = (await request('/api/events', couple, 'POST', { name: 'Test Sangeet', date: '2027-04-11' })).data;
  const events = (await request('/api/events', couple)).data;
  const h = haldi?.id ?? events.find((e: any) => e.name === 'Test Haldi').id; const s = sangeet?.id ?? events.find((e: any) => e.name === 'Test Sangeet').id;
  await request('/api/guests', couple, 'POST', { name: 'Ceremony Guest', side: 'groom' });
  const guest = (await request('/api/guests', couple)).data.find((g: any) => g.name === 'Ceremony Guest');
  for (const id of [h, s]) assert.equal((await request(`/api/guests/${guest.id}/events/${id}`, couple, 'PUT', { invited: true })).status, 200);
  assert.equal((await request(`/api/guests/${guest.id}/events/${h}`, outsider, 'PUT', { invited: true })).status, 404, 'another wedding cannot invite this guest');
  const page = await transport('/rsvp/' + guest.token, '', 'GET', undefined, true);
  assert.ok(String(page.data).includes('Test Haldi') && String(page.data).includes('Test Sangeet'));
  await transport('/rsvp/' + guest.token, '', 'POST', `rsvp=events&e${h}=yes&e${s}=no&meal=Jain&plus=1`, true);
  const counts = (await request('/api/events/headcount', couple)).data;
  const hc = counts.find((e: any) => e.id === h), sc = counts.find((e: any) => e.id === s);
  assert.deepEqual([hc.invited, hc.coming, hc.jain, hc.waiting], [1, 2, 1, 0]);
  assert.deepEqual([sc.invited, sc.coming, sc.declined], [1, 0, 1]);
  assert.equal((await request('/api/guests', couple)).data.find((g: any) => g.id === guest.id).rsvp, 'yes');
});
test('shagun register hides amounts from viewers; stays reject impossible dates', async () => {
  const owner = await login('9812300151');
  await request('/api/wedding', owner, 'POST', { title: 'G & H', date: '2027-05-01', city: 'Pune', budget_paise: 100000000 });
  const viewerPhone = '9812300152'; await request('/api/members', owner, 'POST', { name: 'Viewer', phone: viewerPhone, role: 'viewer' });
  const viewer = await login(viewerPhone);
  assert.equal((await request('/api/gifts', owner, 'POST', { giver: 'Mama ji', kind: 'cash', amount_paise: 1100000 })).status, 200);
  assert.equal((await request('/api/gifts', owner, 'POST', { giver: 'No amount', kind: 'cash' })).status, 400);
  assert.equal((await request('/api/gifts', viewer)).status, 403, 'viewers cannot see gift amounts');
  const gift = (await request('/api/gifts', owner)).data[0];
  assert.equal((await request(`/api/gifts/${gift.id}`, owner, 'PATCH', { thanked: true })).status, 200);
  assert.equal((await request(`/api/gifts/${gift.id}`, outsider, 'PATCH', { thanked: true })).status, 404, 'another wedding cannot touch it');
  assert.equal((await request('/api/stays', owner, 'POST', { guest_name: 'Delhi cousins', people: 4, check_in: '2027-04-30', check_out: '2027-04-29' })).status, 400);
  assert.equal((await request('/api/stays', owner, 'POST', { guest_name: 'Delhi cousins', people: 4, hotel: 'Hotel Shreyas', check_in: '2027-04-30', check_out: '2027-05-02', arrival: 'Pune station 10:30', pickup: true })).status, 200);
  assert.equal((await request('/api/stays', viewer)).data.length, 1, 'family viewers see the stays plan');
  assert.equal((await request('/api/stays', viewer, 'POST', { guest_name: 'X' })).status, 403);
});
test('deleting account data removes the wedding and everything in it', async () => {
  const owner = await login('9812300161');
  await request('/api/wedding', owner, 'POST', { title: 'Del & Ete', date: '2027-06-01', city: 'Pune', budget_paise: 100000000 });
  await request('/api/guests', owner, 'POST', { name: 'Private Guest', phone: '9876500000' });
  await request('/api/gifts', owner, 'POST', { giver: 'Private Giver', kind: 'gift', description: 'Silver set' });
  await request('/api/stays', owner, 'POST', { guest_name: 'Private Stay' });
  const wid = (await request('/api/me', owner)).data.wedding.id;
  const exported = (await request('/api/my-data', owner)).data;
  assert.equal(exported.guests.length, 1); assert.equal(exported.gifts.length, 1); assert.equal(exported.stays.length, 1);
  assert.equal((await request('/api/my-data', owner, 'DELETE')).status, 200);
  for (const table of ['weddings', 'tasks', 'guests', 'gifts', 'stays', 'budget_items']) {
    assert.equal(one(`SELECT COUNT(*) n FROM ${table} WHERE ${table === 'weddings' ? 'id' : 'wedding_id'}=?`, wid).n, 0, table + ' rows remain');
  }
});
test('photo uploads accept only real images from the owning vendor', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64').toString('base64');
  const body = { data: png, caption: 'Mandap at dusk', permission_confirmed: true };
  assert.equal((await request('/api/vendor/photos/upload', couple, 'POST', body)).status, 403);
  assert.equal((await request('/api/vendor/photos/upload', vendor, 'POST', { ...body, permission_confirmed: false })).status, 400);
  assert.equal((await request('/api/vendor/photos/upload', vendor, 'POST', { ...body, data: Buffer.from('<script>alert(1)</script> not an image').toString('base64') })).status, 400);
  const r = await request('/api/vendor/photos/upload', vendor, 'POST', body);
  assert.equal(r.status, 201);
  const photo = r.data.photos.find((p: any) => p.caption === 'Mandap at dusk');
  assert.match(photo.url, /^\/uploads\/[0-9a-f]{24}\.png$/);
  assert.equal((await request(`/api/vendor/photos/${photo.id}`, vendor, 'DELETE')).status, 200);
});
test('expenses paid outside the app count in the budget and mark the service booked', async () => {
  const owner = await login('9812300171');
  await request('/api/wedding', owner, 'POST', { title: 'E & X', date: '2027-07-01', city: 'Nashik', budget_paise: 100000000 });
  assert.equal((await request('/api/expenses', owner, 'POST', { category: 'not-a-category', payee: 'X', amount_paise: 100 })).status, 400);
  const r = await request('/api/expenses', owner, 'POST', { category: 'caterer', payee: 'Annapurna Caterers', amount_paise: 30000000, paid: false });
  assert.equal(r.status, 201);
  const caterer = (await request('/api/budget', owner)).data.rows.find((x: any) => x.category === 'caterer');
  assert.deepEqual([caterer.booked_paise, caterer.paid_paise, caterer.due_paise], [30000000, 0, 30000000]);
  assert.equal((await request(`/api/expenses/${r.data.id}`, owner, 'PATCH', { paid: true })).status, 200);
  assert.equal((await request(`/api/expenses/${r.data.id}`, outsider, 'PATCH', { paid: false })).status, 404);
  assert.equal((await request('/api/planner/overview', owner)).data.budget.remaining_paise, 70000000);
  const tracker = (await request('/api/planner/roadmap', owner)).data.vendors.find((v: any) => v.category === 'caterer');
  assert.equal(tracker.stage, 'booked'); assert.match(tracker.booked_vendor, /Annapurna Caterers/);
});
test('free-on filter leaves out vendors who blocked or booked that date', async () => {
  const me = (await request('/api/me', vendor)).data.vendor;
  await request('/api/vendor/block', vendor, 'POST', { date: '2027-11-20', note: 'Family function' });
  const ids = async (day: string) => (await request('/api/vendors?free_on=' + day)).data.map((v: any) => v.id);
  assert.ok(!(await ids('2027-11-20')).includes(me.id), 'blocked vendor is hidden on that date');
  assert.ok((await ids('2027-11-21')).includes(me.id), 'and shown on other dates');
  assert.ok((await request('/api/vendors?free_on=2027-11-21')).data.every((v: any) => !v.unclaimed));
  assert.equal((await request('/api/vendors?free_on=21-11-2027')).status, 400);
});
test('run sheet keeps timed items per ceremony and checks times', async () => {
  const owner = await login('9812300181');
  await request('/api/wedding', owner, 'POST', { title: 'R & S', date: '2027-08-01', city: 'Nagpur', budget_paise: 100000000 });
  await request('/api/events', owner, 'POST', { name: 'Pheras', date: '2027-08-01' });
  const ev = (await request('/api/events', owner)).data.find((e: any) => e.name === 'Pheras');
  assert.equal((await request('/api/run-sheet', owner, 'POST', { event_id: ev.id, time: '6:30 pm', title: 'Baraat arrives' })).status, 400);
  for (const [time, title] of [['20:15', 'Pheras begin'], ['18:30', 'Baraat arrives']]) assert.equal((await request('/api/run-sheet', owner, 'POST', { event_id: ev.id, time, title, owner: 'Rohan bhaiya' })).status, 201);
  assert.deepEqual((await request('/api/run-sheet', owner)).data.map((x: any) => x.time), ['18:30', '20:15']);
  assert.equal((await request('/api/run-sheet', outsider, 'POST', { event_id: ev.id, time: '19:00', title: 'X' })).status, 404);
});
test('organiser: reminders, shopping, contacts, documents and seating', async () => {
  const owner = await login('9812300191');
  await request('/api/wedding', owner, 'POST', { title: 'O & P', date: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), city: 'Pune', budget_paise: 100000000 });
  await request('/api/tasks', owner, 'POST', { title: 'Old task', due: '2026-01-01' });
  await request('/api/expenses', owner, 'POST', { category: 'decor', payee: 'Phoolwala', amount_paise: 500000, paid: false });
  const kinds = (await request('/api/reminders', owner)).data.items.map((i: any) => i.kind);
  assert.ok(kinds.includes('task') && kinds.includes('payment'), 'overdue task and unpaid payment are reminders: ' + kinds);
  assert.equal((await request('/api/shopping', owner, 'POST', { item: 'Bridal lehenga', kind: 'outfit', for_whom: 'Bride', budget_paise: 15000000 })).status, 201);
  assert.equal((await request('/api/shopping', owner, 'POST', { item: 'X', kind: 'car' })).status, 400);
  assert.equal((await request('/api/day-contacts', owner, 'POST', { name: 'Driver Raju', role: 'Car', phone: '12345' })).status, 400);
  assert.equal((await request('/api/day-contacts', owner, 'POST', { name: 'Driver Raju', role: 'Car', phone: '9876501234', arrival: '5:00 pm' })).status, 201);
  const contacts = (await request('/api/day-contacts', owner)).data; assert.equal(contacts.contacts.length, 1); assert.equal(contacts.outside[0].name, 'Phoolwala');
  const docs = (await request('/api/documents', owner)).data; assert.ok(docs.length >= 9);
  assert.equal((await request('/api/documents', owner)).data.length, docs.length, 'seeded only once');
  assert.equal((await request(`/api/documents/${docs[0].id}`, owner, 'PATCH', { done: true })).status, 200);
  assert.equal((await request(`/api/documents/${docs[0].id}`, outsider, 'PATCH', { done: true })).status, 404);
  await request('/api/events', owner, 'POST', { name: 'Reception' }); const ev = (await request('/api/events', owner)).data.find((e: any) => e.name === 'Reception');
  await request('/api/guests', owner, 'POST', { name: 'Seated Guest' }); const g = (await request('/api/guests', owner)).data[0];
  const t1 = (await request('/api/seating/tables', owner, 'POST', { event_id: ev.id, name: 'Table 1', seats: 8 })).data.id;
  const t2 = (await request('/api/seating/tables', owner, 'POST', { event_id: ev.id, name: 'Table 2', seats: 8 })).data.id;
  await request(`/api/seating/tables/${t1}/guests/${g.id}`, owner, 'PUT', { seated: true });
  await request(`/api/seating/tables/${t2}/guests/${g.id}`, owner, 'PUT', { seated: true });
  assert.deepEqual((await request('/api/seating', owner)).data.seats.map((x: any) => x.table_id), [t2], 'a guest sits at one table per ceremony');
});
test('profile: edit name and language; marketing choice is remembered', async () => {
  const user = await login('9812300201');
  assert.equal((await request('/api/me', user, 'PATCH', { name: 'A' })).status, 400);
  assert.equal((await request('/api/me', user, 'PATCH', { lang: 'xx' })).status, 400);
  const r = await request('/api/me', user, 'PATCH', { name: '  Meera Iyer ', lang: 'mr' });
  assert.equal(r.status, 200); assert.equal(r.data.name, 'Meera Iyer'); assert.equal(r.data.lang, 'mr');
  assert.equal((await request('/api/consent', user)).data.marketing, null);
  await request('/api/consent', user, 'POST', { purpose: 'marketing', granted: true });
  await request('/api/consent', user, 'POST', { purpose: 'marketing', granted: false });
  assert.equal((await request('/api/consent', user)).data.marketing, false, 'the latest choice wins');
});
test('deals follow one vendor relationship from enquiry to completed, for both sides', async () => {
  const c = await login('9812300211'); const v = await login('9000000003');
  await request('/api/wedding', c, 'POST', { title: 'D & L', date: '2027-09-01', city: 'Pune', budget_paise: 100000000 });
  const vendorId = (await request('/api/me', v)).data.vendor.id;
  const e = (await request('/api/enquiries', c, 'POST', { vendor_id: vendorId, event_date: '2027-09-01', guests: 200, budget_paise: 5000000, note: 'Haldi, Wedding' })).data;
  const stage = async (tok: string) => (await request('/api/deals', tok)).data.find((d: any) => d.id === e.id).stage;
  assert.equal(await stage(c), 'new'); assert.equal(await stage(v), 'new', 'the vendor sees the same relationship');
  await request(`/api/enquiries/${e.id}/quotes`, v, 'POST', { items: [{ label: 'Mehndi for bride', amount_paise: 2000000 }, { label: 'Family members (10)', amount_paise: 1000000 }] });
  assert.equal(await stage(c), 'quoted');
  const deal = (await request('/api/deals', c)).data.find((d: any) => d.id === e.id); assert.equal(deal.quote.total_paise, 3000000);
  await request(`/api/quotes/${deal.quote.id}/accept`, c, 'POST');
  assert.equal(await stage(c), 'booked');
  const ms = (await request('/api/deals', c)).data.find((d: any) => d.id === e.id).booking.milestones;
  await request(`/api/milestones/${ms[0].id}/pay`, c, 'POST'); assert.equal(await stage(c), 'paying');
  for (const m of ms) { if (m.id !== ms[0].id) await request(`/api/milestones/${m.id}/pay`, c, 'POST'); await request(`/api/milestones/${m.id}/release`, c, 'POST'); }
  assert.equal(await stage(c), 'completed'); assert.equal(await stage(v), 'completed');
  assert.ok(!(await request('/api/deals', outsider)).data.some((d: any) => d.id === e.id), 'other people never see it');
});
test('instalments have due dates, show as reminders, and quotes carry their items', async () => {
  const { instalmentDue } = await import('./organiser.ts');
  assert.deepEqual([0, 1, 2].map(i => instalmentDue(i, 3, '2026-11-01 10:00:00', '2027-01-20')), ['2026-11-04', '2027-01-13', '2027-01-23']);
  const c = await login('9812300221'); const v = await login('9000000005');
  const soon = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await request('/api/wedding', c, 'POST', { title: 'I & J', date: soon, city: 'Pune', budget_paise: 100000000 });
  const vendorId = (await request('/api/me', v)).data.vendor.id;
  const e = (await request('/api/enquiries', c, 'POST', { vendor_id: vendorId, event_date: soon, guests: 100, budget_paise: 5000000 })).data;
  await request(`/api/enquiries/${e.id}/quotes`, v, 'POST', { items: [{ label: 'Stage decor', amount_paise: 4000000 }, { label: 'Entrance', amount_paise: 1000000 }] });
  const deal = (await request('/api/deals', c)).data.find((d: any) => d.id === e.id);
  assert.deepEqual(deal.quote.items.map((i: any) => i.label), ['Stage decor', 'Entrance']);
  await request(`/api/quotes/${deal.quote.id}/accept`, c, 'POST');
  const booked = (await request('/api/deals', c)).data.find((d: any) => d.id === e.id);
  assert.ok(booked.booking.milestones.every((m: any) => /^\d{4}-\d{2}-\d{2}$/.test(m.due_on)), 'every instalment has a due date');
  const reminders = (await request('/api/reminders', c)).data.items.filter((i: any) => i.kind === 'instalment');
  assert.ok(reminders.some((r: any) => r.title.startsWith('Pay Token advance')), 'token due within a week is a reminder');
});
test('wedding details save only for the current owner', async () => {
  const before = (await request('/api/tasks', couple)).data.find((item: any) => item.title === 'Our priorities');
  const r = await request('/api/wedding', couple, 'PATCH', { title: 'Updated couple', date: '2027-04-20', city: 'Nashik', guests_est: 300 });
  assert.equal(r.status, 200); assert.equal(r.data.title, 'Updated couple');
  assert.equal(r.data.date, '2027-04-20');
  assert.equal((await request('/api/wedding', couple, 'PATCH', { title: 'Updated couple', date: '2027-02-30', city: 'Nashik', guests_est: 300 })).status, 400);
  assert.equal((await request('/api/planner/guide', couple)).data.find((item: any) => item.key === 'seating').due, '2027-03-21');
  assert.equal((await request('/api/tasks', couple)).data.find((item: any) => item.id === before.id).due, null);
  assert.equal((await request('/api/me', outsider)).data.wedding.title, 'C & D');
});
