import { DatabaseSync } from 'node:sqlite';
export const db = new DatabaseSync(process.env.DB_PATH || 'shaadi.db');
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, phone TEXT UNIQUE, name TEXT, role TEXT, lang TEXT DEFAULT 'en', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS weddings(id INTEGER PRIMARY KEY, owner_id INT, title TEXT, date TEXT, city TEXT, community TEXT, guests_est INT DEFAULT 200, budget_paise INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS vendors(id INTEGER PRIMARY KEY, user_id INT, name TEXT, category TEXT, city TEXT, locality TEXT, start_paise INT, description TEXT, languages TEXT, verified INT DEFAULT 0, travels INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY, wedding_id INT, couple_id INT, vendor_id INT, event_date TEXT, guests INT, budget_paise INT, note TEXT, status TEXT DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, enquiry_id INT, sender_id INT, body TEXT, flagged INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quotes(id INTEGER PRIMARY KEY, enquiry_id INT, version INT, items TEXT, total_paise INT, milestones TEXT, status TEXT DEFAULT 'sent', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY, quote_id INT, enquiry_id INT, couple_id INT, vendor_id INT, wedding_id INT, total_paise INT, commission_bps INT, status TEXT DEFAULT 'confirmed', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS milestones(id INTEGER PRIMARY KEY, booking_id INT, label TEXT, pct INT, amount_paise INT, status TEXT DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, booking_id INT, milestone_id INT, kind TEXT, amount_paise INT, idem TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, wedding_id INT, title TEXT, due TEXT, done INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS budget_items(id INTEGER PRIMARY KEY, wedding_id INT, category TEXT, allocated_paise INT);
CREATE TABLE IF NOT EXISTS guests(id INTEGER PRIMARY KEY, wedding_id INT, name TEXT, phone TEXT, side TEXT, token TEXT UNIQUE, rsvp TEXT DEFAULT 'pending', meal TEXT, plus_ones INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, booking_id INT UNIQUE, vendor_id INT, user_id INT, rating INT, text TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
export const q = (s: string, ...a: any[]) => db.prepare(s).all(...a) as any[];
export const one = (s: string, ...a: any[]) => db.prepare(s).get(...a) as any;
export const run = (s: string, ...a: any[]) => db.prepare(s).run(...a);

// The seeded demo vendors are invented businesses, so they are flagged as samples and never shown as verified.
// Seed vendor accounts use phones 9000000001 to 9000000099.
// Real businesses listed from public information before they join: no owner account, no price, no enquiries.
// contact_* hold the business contact a listing publishes on its own website (unclaimed listings only).
for (const [column, type] of [['unclaimed', 'INT DEFAULT 0'], ['website', 'TEXT'], ['source_url', 'TEXT'], ['contact_phone', 'TEXT'], ['contact_whatsapp', 'TEXT'], ['contact_email', 'TEXT'], ['contact_source', 'TEXT']]) {
  if (!q('PRAGMA table_info(vendors)').some((c: any) => c.name === column)) db.exec(`ALTER TABLE vendors ADD COLUMN ${column} ${type}`);
}
if (!q('PRAGMA table_info(vendors)').some((c: any) => c.name === 'sample')) {
  db.exec('ALTER TABLE vendors ADD COLUMN sample INT DEFAULT 0');
  run("UPDATE vendors SET sample=1, verified=0 WHERE user_id IN (SELECT id FROM users WHERE role='vendor' AND phone BETWEEN '9000000001' AND '9000000099')");
}
