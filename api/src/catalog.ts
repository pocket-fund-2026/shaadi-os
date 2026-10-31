import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import express from 'express';
import { db, one, q, run } from './db.ts';

db.exec(`
CREATE TABLE IF NOT EXISTS vendor_photos(id INTEGER PRIMARY KEY, vendor_id INTEGER NOT NULL REFERENCES vendors(id), url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', permission_confirmed INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS vendor_packages(id INTEGER PRIMARY KEY, vendor_id INTEGER NOT NULL REFERENCES vendors(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_paise INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
// Uploaded portfolio photos live on disk and are served from /uploads under random names.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || new URL('../uploads', import.meta.url).pathname;
mkdirSync(UPLOAD_DIR, { recursive: true });
const MAX_UPLOAD = 8 * 1024 * 1024;
// Trust the bytes, not the file name: only JPEG, PNG and WebP that browsers and phones can all display.
const imageType = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'jpg'
  : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png'
  : b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' ? 'webp' : null;
const uploadSchema = z.object({
  data: z.string().min(16).max(12 * 1024 * 1024),
  caption: z.string().trim().max(160).default(''),
  permission_confirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm permission to publish this photo.' }) }),
});
const failure = (status: number, message: string) => Object.assign(new Error(message), { status });
const photoSchema = z.object({
  url: z.string().trim().url().max(2000).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      !/^(localhost|.*\.localhost|.*\.local|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i.test(url.hostname) && url.hostname.includes('.');
  }, 'Use a public HTTPS image link without a username, password or custom port.'),
  caption: z.string().trim().max(160).default(''),
  permission_confirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm permission to publish this photo.' }) }),
});
const packageSchema = z.object({ title: z.string().trim().min(2).max(100), description: z.string().trim().min(3).max(1000), price_paise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export const vendorCatalog = (id: number) => ({
  photos: q('SELECT id,url,caption FROM vendor_photos WHERE vendor_id=? ORDER BY id', id),
  packages: q('SELECT id,title,description,price_paise FROM vendor_packages WHERE vendor_id=? ORDER BY price_paise,id', id),
});
export function mountCatalog(app: any, auth: any, wrap: any) {
  const ownVendor = (req: any) => {
    if (req.user.role !== 'vendor') throw failure(403, 'Vendors only');
    const vendor = one('SELECT id FROM vendors WHERE user_id=?', req.user.id);
    if (!vendor) throw failure(400, 'Save your storefront first.');
    return vendor.id;
  };
  app.get('/api/vendor/catalog', auth, wrap((req: any, res: any) => res.json(vendorCatalog(ownVendor(req)))));
  app.post('/api/vendor/photos', auth, wrap((req: any, res: any) => {
    const id = ownVendor(req); const body = photoSchema.parse(req.body);
    if (one('SELECT COUNT(*) n FROM vendor_photos WHERE vendor_id=?', id).n >= 12) throw failure(400, 'A portfolio can contain up to 12 photos.');
    if (one('SELECT id FROM vendor_photos WHERE vendor_id=? AND url=?', id, body.url)) throw failure(409, 'This photo is already in your portfolio.');
    run('INSERT INTO vendor_photos(vendor_id,url,caption,permission_confirmed) VALUES(?,?,?,1)', id, body.url, body.caption);
    res.status(201).json(vendorCatalog(id));
  }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', fallthrough: false }));
  app.post('/api/vendor/photos/upload', auth, wrap((req: any, res: any) => {
    const id = ownVendor(req); const body = uploadSchema.parse(req.body);
    if (one('SELECT COUNT(*) n FROM vendor_photos WHERE vendor_id=?', id).n >= 12) throw failure(400, 'A portfolio can contain up to 12 photos.');
    const bytes = Buffer.from(body.data.replace(/^data:[^,]*,/, ''), 'base64');
    if (bytes.length > MAX_UPLOAD) throw failure(413, 'Photos must be 8 MB or smaller.');
    const ext = imageType(bytes); if (!ext) throw failure(400, 'Upload a JPEG, PNG or WebP photo.');
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    writeFileSync(`${UPLOAD_DIR}/${name}`, bytes);
    run('INSERT INTO vendor_photos(vendor_id,url,caption,permission_confirmed) VALUES(?,?,?,1)', id, `/uploads/${name}`, body.caption);
    res.status(201).json(vendorCatalog(id));
  }));
  app.post('/api/vendor/packages', auth, wrap((req: any, res: any) => {
    const id = ownVendor(req); const body = packageSchema.parse(req.body);
    if (one('SELECT COUNT(*) n FROM vendor_packages WHERE vendor_id=?', id).n >= 8) throw failure(400, 'A storefront can contain up to 8 packages.');
    run('INSERT INTO vendor_packages(vendor_id,title,description,price_paise) VALUES(?,?,?,?)', id, body.title, body.description, body.price_paise);
    res.status(201).json(vendorCatalog(id));
  }));
  for (const [route, table] of [['photos', 'vendor_photos'], ['packages', 'vendor_packages']]) {
    app.delete(`/api/vendor/${route}/:id`, auth, wrap((req: any, res: any) => {
      const vendor = ownVendor(req);
      const file = table === 'vendor_photos' ? one('SELECT url FROM vendor_photos WHERE id=? AND vendor_id=?', req.params.id, vendor)?.url : null;
      if (!run(`DELETE FROM ${table} WHERE id=? AND vendor_id=?`, req.params.id, vendor).changes) throw failure(404, 'Item not found');
      if (typeof file === 'string' && /^\/uploads\/[0-9a-f]{24}\.(jpg|png|webp)$/.test(file)) { try { unlinkSync(`${UPLOAD_DIR}/${file.slice(9)}`); } catch { /* already gone */ } }
      res.json(vendorCatalog(vendor));
    }));
  }
}
