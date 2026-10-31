// Imports real businesses from the researched CSV as unclaimed listings: public name, service, area and website,
// with no owner account, no price and no verified badge. Rerunning updates existing rows instead of duplicating them.
// Usage: node src/import-listings.ts ../vendor-prospects.csv [../vendor-contacts.csv]
import { readFileSync } from 'node:fs';
import { one, run } from './db.ts';

const CATEGORIES = new Set(['photographer', 'makeup', 'mehndi', 'decor', 'venue', 'caterer', 'dj', 'pandit']);

// Minimal RFC 4180 parser: quoted fields may contain commas, newlines and doubled quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; if (row.some(f => f.trim())) rows.push(row); row = [];
    } else field += c;
  }
  row.push(field); if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

const httpUrl = (value: string) => { try { const u = new URL(value.trim()); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; } };

export function importListings(path: string) {
  const [header, ...rows] = parseCsv(readFileSync(path, 'utf8'));
  const col = (name: string) => { const i = header.indexOf(name); if (i < 0) throw new Error(`CSV is missing the ${name} column`); return i; };
  const at = { name: col('business_name'), category: col('category'), city: col('city'), locality: col('locality'), website: col('website_or_instagram'), source: col('source_url'), notes: col('notes') };
  let added = 0, updated = 0; const skipped: string[] = [];
  for (const r of rows) {
    const name = r[at.name]?.trim(); const category = r[at.category]?.trim(); const city = r[at.city]?.trim();
    const website = httpUrl(r[at.website] || ''); const source = httpUrl(r[at.source] || '');
    if (!name || !CATEGORIES.has(category) || !city || !website) { skipped.push(name || '(no name)'); continue; }
    const notes = r[at.notes]?.trim();
    const fields = [category, r[at.locality]?.trim() || null, notes ? notes[0].toUpperCase() + notes.slice(1) : null, website, source];
    const existing = one('SELECT id FROM vendors WHERE unclaimed=1 AND name=? AND city=?', name, city);
    if (existing) { run('UPDATE vendors SET category=?,locality=?,description=?,website=?,source_url=? WHERE id=?', ...fields, existing.id); updated++; }
    else { run('INSERT INTO vendors(user_id,name,city,category,locality,description,website,source_url,start_paise,verified,travels,sample,unclaimed) VALUES(NULL,?,?,?,?,?,?,?,NULL,0,0,0,1)', name, city, ...fields); added++; }
  }
  return { added, updated, skipped };
}

// Public contact details from each business's own website, matched to its unclaimed listing by name and city.
// Anything that doesn't look like an Indian phone number or an email address is dropped rather than stored.
const indianPhone = (v: string) => { const d = (v || '').replace(/\D/g, '').replace(/^(91|0091)(?=[6-9]\d{9}$)/, ''); return /^[6-9]\d{9}$/.test(d) || /^0\d{9,10}$/.test(d) ? d : null; };
const email = (v: string) => { const e = (v || '').trim().toLowerCase(); return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) ? e : null; };
export function importContacts(path: string) {
  const [header, ...rows] = parseCsv(readFileSync(path, 'utf8'));
  const at = (name: string) => header.indexOf(name);
  let updated = 0, unmatched = 0;
  for (const r of rows) {
    const phone = indianPhone(r[at('phone')]); const wa = indianPhone(r[at('whatsapp')]); const mail = email(r[at('email')]); const source = httpUrl(r[at('contact_source_url')] || '');
    if (!phone && !wa && !mail) continue;
    const res = run('UPDATE vendors SET contact_phone=?, contact_whatsapp=?, contact_email=?, contact_source=? WHERE unclaimed=1 AND name=? AND city=?', phone, wa && /^[6-9]/.test(wa) ? wa : null, mail, source, r[at('business_name')]?.trim(), r[at('city')]?.trim());
    if (res.changes) updated++; else unmatched++;
  }
  return { updated, unmatched };
}

if (process.argv[1]?.endsWith('import-listings.ts')) {
  const path = process.argv[2];
  if (!path) { console.error('Usage: node src/import-listings.ts <vendor-prospects.csv>'); process.exit(1); }
  const r = importListings(path);
  console.log(`Added ${r.added}, updated ${r.updated}, skipped ${r.skipped.length}${r.skipped.length ? ': ' + r.skipped.join(', ') : ''}`);
  if (process.argv[3]) { const c = importContacts(process.argv[3]); console.log(`Contacts: ${c.updated} listings updated, ${c.unmatched} rows not matched`); }
}
