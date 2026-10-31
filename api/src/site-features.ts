import type express from 'express';
import { one, q } from './db.ts';
import { vendorCatalog } from './catalog.ts';
import { guideForWedding } from './planning-guide.ts';
import { TEMPLATES } from './extras.ts';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const plain = (value: unknown, max = 80) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const inr = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateText = (value: string) => new Date(value + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const realDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
type Page = (title: string, description: string, body: string) => string;

export function mountSiteFeatures(app: express.Express, page: Page) {
  app.get('/vendors', (req, res) => {
    const search = plain(req.query.search);
    const city = plain(req.query.city);
    const category = plain(req.query.category);
    const budget = plain(req.query.budget, 20);
    const rupeeLimit = Number(budget);
    const budgetError = !!budget && (!/^\d+(\.\d{1,2})?$/.test(budget) || !Number.isSafeInteger(Math.round(rupeeLimit * 100)) || rupeeLimit <= 0);
    const cities = q("SELECT DISTINCT city FROM vendors WHERE city IS NOT NULL AND city!='' ORDER BY city").map(v => v.city);
    const categories = q("SELECT DISTINCT category FROM vendors WHERE category IS NOT NULL AND category!='' ORDER BY category").map(v => v.category);
    const where: string[] = ['1=1']; const args: unknown[] = [];
    if (search) { where.push('(v.name LIKE ? OR v.description LIKE ? OR v.locality LIKE ?)'); args.push(...Array(3).fill(`%${search}%`)); }
    if (city) { where.push('(v.city=? OR v.travels=1)'); args.push(city); }
    if (category) { where.push('v.category=?'); args.push(category); }
    if (budget && !budgetError) { where.push('v.start_paise<=?'); args.push(Math.round(rupeeLimit * 100)); }
    const vendors = budgetError ? [] : q(`SELECT v.id,v.name,v.category,v.city,v.locality,v.start_paise,v.verified,v.unclaimed,(SELECT url FROM vendor_photos p WHERE p.vendor_id=v.id ORDER BY p.id LIMIT 1) cover_url,(SELECT caption FROM vendor_photos p WHERE p.vendor_id=v.id ORDER BY p.id LIMIT 1) cover_caption FROM vendors v WHERE ${where.join(' AND ')} ORDER BY v.sample ASC,v.unclaimed ASC,v.verified DESC,v.id LIMIT 96`, ...args);
    const option = (value: string, current: string) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(value)}</option>`;
    const cards = vendors.map(v => `<article class="tile">${v.cover_url ? `<img src="${esc(v.cover_url)}" alt="${esc(v.cover_caption || v.name + ' portfolio photo')}" loading="lazy">` : '<div class="cover" aria-hidden="true">Shaadi OS</div>'}<span class="phase">${esc(v.category)}</span><h2>${esc(v.name)}</h2><p>${esc(v.city)}${v.locality ? ` · ${esc(v.locality)}` : ''}</p><p class="price">${v.start_paise ? `From ${inr(v.start_paise)}` : 'Price not listed'}</p>${v.unclaimed ? '<p class="note">Not on Shaadi OS yet</p>' : ''}<p><a href="/vendors/${v.id}">See portfolio and packages</a></p></article>`).join('');
    res.send(page('Wedding vendors | Shaadi OS', 'Browse wedding vendors by city, service and starting price.', `<main><div class="section-head"><span class="eyebrow">Find your people</span><h1>Wedding vendors</h1><p class="lead">Search by service, city and starting price. Open a listing to see submitted portfolio work and packages.</p></div><form action="/vendors" method="get" class="filters"><label>Search<input name="search" value="${esc(search)}" placeholder="Name or service"></label><label>City<select name="city"><option value="">All cities</option>${cities.map(v => option(v, city)).join('')}</select></label><label>Service<select name="category"><option value="">All services</option>${categories.map(v => option(v, category)).join('')}</select></label><label>Max starting price (₹)<input name="budget" inputmode="decimal" value="${esc(budget)}" placeholder="Any budget"></label><button type="submit">Show vendors</button></form>${budgetError ? '<p role="alert" class="empty">Enter a positive budget in rupees, with up to two decimal places.</p>' : `<p class="subtle">Showing ${vendors.length} ${vendors.length === 1 ? 'listing' : 'listings'}${vendors.length === 48 ? ' (first 48)' : ''}. Starting prices are estimates; ask vendors for a full quote.</p>${vendors.length ? `<div class="grid">${cards}</div>` : '<div class="empty">No listings match these filters. Try another city, service or budget.</div>'}`}<p class="note">Demo preview. Some listings are sample data; verification and payment are not live services.</p></main>`));
  });

  app.get('/vendors/:id', (req, res) => {
    const missing = () => res.status(404).send(page('Vendor not found | Shaadi OS', 'This vendor was not found.', '<main><h1>Vendor not found</h1><a href="/vendors">Browse vendors</a></main>'));
    if (!/^\d+$/.test(req.params.id)) return missing();
    const vendor = one('SELECT id,name,category,city,locality,start_paise,description,verified,travels,unclaimed,website,contact_phone,contact_whatsapp,contact_email FROM vendors WHERE id=?', req.params.id);
    if (!vendor) return missing();
    const catalog = vendorCatalog(vendor.id);
    const photos = catalog.photos.length ? `<div class="grid">${catalog.photos.map(photo => `<figure class="tile" style="margin:0"><img src="${esc(photo.url)}" alt="${esc(photo.caption || vendor.name + ' portfolio photo')}" loading="lazy"><figcaption class="subtle">${esc(photo.caption)}</figcaption></figure>`).join('')}</div>` : '<div class="empty">This vendor has not added portfolio photos yet.</div>';
    const packages = catalog.packages.length ? `<div class="detail-list">${catalog.packages.map(pack => `<article class="tile"><span class="phase">Package</span><h3>${esc(pack.title)}</h3><p>${esc(pack.description)}</p><p class="price">${inr(pack.price_paise)}</p></article>`).join('')}</div>` : '<div class="empty">No packages published yet. Ask the vendor for a custom quote in the app.</div>';
    res.send(page(`${vendor.name} | Shaadi OS vendors`, `See ${vendor.name}'s wedding portfolio and packages in ${vendor.city}.`, `<main><p><a href="/vendors">← All vendors</a></p><div class="section-head"><span class="eyebrow">${esc(vendor.category)} · ${esc(vendor.city)}</span><h1>${esc(vendor.name)}</h1><p class="lead">${esc(vendor.description || 'Explore this vendor’s work and ask for details in the app.')}</p><div class="inline-actions"><span class="price">${vendor.start_paise ? `From ${inr(vendor.start_paise)}` : 'Price not listed'}</span>${vendor.unclaimed ? `<p class="note">Not on Shaadi OS yet. Listed from public information, so details may be out of date${vendor.website ? `. <a href="${esc(vendor.website)}" rel="nofollow noopener">Visit their website</a>` : ''}.</p>${[vendor.contact_phone && `<a href="tel:${esc(vendor.contact_phone.length === 10 ? '+91' + vendor.contact_phone : vendor.contact_phone)}">Call ${esc(vendor.contact_phone)}</a>`, vendor.contact_whatsapp && `<a href="https://wa.me/91${esc(vendor.contact_whatsapp)}" rel="nofollow noopener">WhatsApp</a>`, vendor.contact_email && `<a href="mailto:${esc(vendor.contact_email)}">${esc(vendor.contact_email)}</a>`].filter(Boolean).length ? `<p class="note">Contact from their website: ${[vendor.contact_phone && `<a href="tel:${esc(vendor.contact_phone.length === 10 ? '+91' + vendor.contact_phone : vendor.contact_phone)}">Call ${esc(vendor.contact_phone)}</a>`, vendor.contact_whatsapp && `<a href="https://wa.me/91${esc(vendor.contact_whatsapp)}" rel="nofollow noopener">WhatsApp</a>`, vendor.contact_email && `<a href="mailto:${esc(vendor.contact_email)}">${esc(vendor.contact_email)}</a>`].filter(Boolean).join(' · ')}</p>` : ''}` : ''}</div></div><section aria-labelledby="portfolio-title"><div class="section-head"><h2 id="portfolio-title">Portfolio</h2></div>${photos}</section><section aria-labelledby="packages-title"><div class="section-head"><h2 id="packages-title">Packages</h2></div>${packages}</section><p class="note">Starting prices and packages come from this listing. Confirm availability and a final quote with the vendor.</p><a class="cta" href="/app?browse=1">Open app to enquire</a></main>`));
  });

  app.get('/planning', (req, res) => {
    const rawDate = plain(req.query.date, 20);
    const community = plain(req.query.community);
    const selectedCommunity = Object.hasOwn(TEMPLATES, community) ? community : 'North Indian Hindu';
    const dateError = !!rawDate && !realDate(rawDate);
    const suggestions = rawDate && !dateError ? guideForWedding(rawDate, [], new Date(), selectedCommunity).sort((a, b) => a.due.localeCompare(b.due)) : [];
    const rows = suggestions.map(item => `<li><span class="phase">${esc(item.phase)}</span><strong>${esc(item.title)}</strong><span>${item.is_catch_up ? 'Start now' : dateText(item.due)}</span></li>`).join('');
    res.send(page('Indian wedding planning guide | Shaadi OS', 'Preview a flexible Indian wedding checklist tailored to your date and celebration style.', `<main><div class="section-head"><span class="eyebrow">A plan that fits your celebration</span><h1>Start with a date. Make it yours.</h1><p class="lead">Choose your wedding date and celebration style to preview a practical checklist. The first decisions cover events, guest numbers and venues; later steps bring together vendors, family and the final schedule.</p></div><form action="/planning" method="get" class="filters planning-form"><label>Wedding date<input type="date" name="date" required value="${esc(rawDate)}"></label><label>Celebration style<select name="community">${Object.keys(TEMPLATES).map(name => `<option value="${esc(name)}"${name === selectedCommunity ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label><button type="submit">Build my preview</button></form>${dateError ? '<p role="alert" class="empty">Enter a real wedding date.</p>' : rawDate ? `<div class="section-head"><span class="eyebrow">Your date · ${dateText(rawDate)}</span><h2>A flexible timeline</h2><p class="lead">${suggestions.length} optional ideas. If your celebration is sooner, early decisions become “Start now.” Keep only the events and traditions that matter to you.</p></div><ol class="timeline">${rows}</ol><p class="note">Preview only. To save, edit and share tasks with family, create a wedding workspace in the app.</p><a class="cta" href="/app">Save my plan in the app</a>` : '<div class="empty">Choose a date to see your timeline. Your preview stays on this page and is not saved.</div>'}<p class="note">Inspired by <a href="https://www.brides.com/story/brides-wedding-checklist-custom-wedding-to-do-list">Brides’ planning timeline</a> and <a href="https://www.marigoldevents.com/2021/03/indian-wedding-planning-checklist/">Marigold Events’ Indian wedding checklist</a>. The task wording and schedule are adapted for flexible celebrations.</p></main>`));
  });
}
