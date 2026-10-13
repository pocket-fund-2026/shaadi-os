import { z } from 'zod';
import { db, one, q, run } from './db.ts';

db.exec(`
CREATE TABLE IF NOT EXISTS vendor_photos(id INTEGER PRIMARY KEY, vendor_id INTEGER NOT NULL REFERENCES vendors(id), url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', permission_confirmed INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS vendor_packages(id INTEGER PRIMARY KEY, vendor_id INTEGER NOT NULL REFERENCES vendors(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_paise INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
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
  app.post('/api/vendor/packages', auth, wrap((req: any, res: any) => {
    const id = ownVendor(req); const body = packageSchema.parse(req.body);
    if (one('SELECT COUNT(*) n FROM vendor_packages WHERE vendor_id=?', id).n >= 8) throw failure(400, 'A storefront can contain up to 8 packages.');
    run('INSERT INTO vendor_packages(vendor_id,title,description,price_paise) VALUES(?,?,?,?)', id, body.title, body.description, body.price_paise);
    res.status(201).json(vendorCatalog(id));
  }));
  for (const [route, table] of [['photos', 'vendor_photos'], ['packages', 'vendor_packages']]) {
    app.delete(`/api/vendor/${route}/:id`, auth, wrap((req: any, res: any) => {
      const vendor = ownVendor(req);
      if (!run(`DELETE FROM ${table} WHERE id=? AND vendor_id=?`, req.params.id, vendor).changes) throw failure(404, 'Item not found');
      res.json(vendorCatalog(vendor));
    }));
  }
}
