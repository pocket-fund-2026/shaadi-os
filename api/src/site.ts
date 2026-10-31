import express from 'express';
import { mountSiteFeatures } from './site-features.ts';
// Public web-presence: legal pages, SEO files, landing page, 404, and a spam guard for public POST forms.
// Privacy/Terms text is a placeholder, flagged per CLAUDE.md for CA/lawyer review before launch.
const esc = (s: string) => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const SITE = process.env.SITE_URL || 'http://46.225.26.58:4600';
const page = (title: string, description: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/png" href="/brand-icon-v3.png"><link rel="apple-touch-icon" href="/brand-icon-v3.png">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/brand-icon-v3.png"><meta name="twitter:card" content="summary">
<style>*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif;background:#FAF7F2;color:#2C2024}a{color:#74263F}
.wrap{max-width:1020px;margin:0 auto;padding:24px 20px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:36px}.brand{display:inline-flex;gap:12px;align-items:center;text-decoration:none;color:#74263F;font-size:26px;font-weight:700;white-space:nowrap}.brand img{width:48px;height:48px;border-radius:11px}.nav{display:flex;gap:22px;flex-wrap:wrap;font:600 14px system-ui,sans-serif}.nav a{text-decoration:none}.nav a:hover{text-decoration:underline}
.hero{border-radius:24px;padding:42px 32px;background:#4D192C;color:#FFF9F0}.hero h1{font-size:clamp(34px,6vw,54px);line-height:1.1;max-width:560px;margin:0 0 22px}.hero p{font-family:system-ui,sans-serif;line-height:1.7;max-width:520px;color:#F3E8D1}.hero .cta{background:#F3E8D1;color:#4D192C}
.cta,button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;background:#74263F;color:#fff;text-decoration:none;padding:12px 22px;border:0;border-radius:12px;font:600 14px system-ui,sans-serif;cursor:pointer;transition:transform 160ms ease,opacity 160ms ease}.cta:hover,button:hover{transform:translateY(-2px)}.cta:active,button:active{transform:scale(.98)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #896522;outline-offset:3px}
.preview{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:48px;align-items:center;margin-top:48px}.preview img{display:block;width:100%;height:auto;border-radius:28px;border:1px solid #EADCD3}.preview h2{margin:0 0 12px}.preview p{color:#5E5057;line-height:1.65}
.features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:36px}.features article{border-top:1px solid #EADCD3;padding-top:20px}.features svg{width:28px;height:28px;color:#74263F}.features h2{font-size:22px}.features p,.note{font-family:system-ui,sans-serif;font-size:14px;color:#75656B;line-height:1.7}.note{margin-top:28px}h1{font-size:30px}footer{color:#75656B;font-size:12px;margin-top:40px;font-family:system-ui,sans-serif;line-height:2}
.section-head{margin:48px 0 20px}.eyebrow{font:600 13px system-ui,sans-serif;color:#846120}.lead{font:15px/1.65 system-ui,sans-serif;color:#75656B;max-width:680px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.tile{background:#FFFEFC;border:1px solid #EADCD3;border-radius:16px;padding:20px;min-width:0}.tile h2,.tile h3{font-size:21px;margin:8px 0}.tile p,.tile small{font:14px/1.5 system-ui,sans-serif;color:#75656B}.tile img{display:block;width:100%;height:170px;object-fit:cover;border-radius:10px;margin-bottom:14px}.tile a:not(.cta){font:600 14px system-ui,sans-serif}.price{font:700 17px system-ui,sans-serif;color:#74263F}.badge{display:inline-block;background:#F3E8D1;color:#654C1C;border-radius:6px;padding:5px 8px;font:600 11px system-ui,sans-serif}.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:12px;align-items:end;background:#FFFEFC;border:1px solid #EADCD3;border-radius:16px;padding:18px;margin:24px 0}.filters label{font:600 13px system-ui,sans-serif;color:#4D192C}.filters input,.filters select{display:block;width:100%;min-height:46px;border:1px solid #CDBCB5;border-radius:9px;background:#fff;padding:9px 12px;margin-top:7px;font:14px system-ui,sans-serif;color:#2C2024}.filters button{width:100%}.subtle{font:13px/1.5 system-ui,sans-serif;color:#75656B}.timeline{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.timeline li{background:#FFFEFC;border:1px solid #EADCD3;border-left:3px solid #896522;border-radius:12px;padding:16px}.timeline strong{display:block;margin:7px 0;color:#2C2024}.timeline span{font:600 12px system-ui,sans-serif;color:#896522}.phase{font:700 11px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#896522}.inline-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.outline{background:transparent;color:#74263F;border:1px solid #74263F}.empty{border:1px dashed #CDBCB5;border-radius:12px;padding:24px;background:#FFFEFC;font:14px/1.6 system-ui,sans-serif;color:#75656B}
.planning-form{grid-template-columns:repeat(2,minmax(0,1fr)) auto}.cover{height:170px;border-radius:10px;background:#F3E9E0;display:flex;align-items:center;justify-content:center;color:#74263F;font:700 18px Georgia,serif;margin-bottom:14px}.detail-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.section-head h1,.section-head h2{margin:5px 0 8px}
@media(max-width:760px){.grid,.detail-list{grid-template-columns:repeat(2,minmax(0,1fr))}.filters,.planning-form{grid-template-columns:repeat(2,minmax(0,1fr))}.filters button{grid-column:span 2}}
@media(max-width:600px){.preview{grid-template-columns:1fr;gap:24px}.preview img{max-width:280px;margin:0 auto}.features,.grid,.timeline,.detail-list{grid-template-columns:1fr;gap:10px}.hero{padding:28px 24px}.topbar{align-items:flex-start;flex-direction:column;margin-bottom:24px}.nav{gap:15px}}
@media(prefers-reduced-motion:reduce){.cta,button{transition:none}.cta:hover,.cta:active,button:hover,button:active{transform:none}}</style></head>
<body><div class="wrap"><header class="topbar"><a class="brand" href="/" aria-label="Shaadi OS home"><img src="/brand-icon-v3.png" alt="" width="48" height="48">Shaadi OS</a><nav class="nav" aria-label="Main navigation"><a href="/vendors">Vendors</a><a href="/planning">Planning guide</a><a href="/app?browse=1">Open app</a></nav></header>${body}<footer>© ${new Date().getFullYear()} Shaadi OS · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer></div></body></html>`;

// very small in-memory IP rate limiter for public forms (no login), resets per window
const hits = new Map<string, number[]>();
export const spamGuard = (max = 8, windowMs = 600000) => (req: any, res: any, next: any) => {
  if (req.body && req.body.website) return res.status(400).send('Invalid submission'); // honeypot field
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now(); const t = (hits.get(ip) || []).filter(x => now - x < windowMs);
  if (t.length >= max) return res.status(429).send('Too many submissions, please try again later.');
  t.push(now); hits.set(ip, t); next();
};

// mount first, before API routes: HTTPS enforcement + static assets (favicon, og-image)
export function mountSiteEarly(app: express.Express) {
  // force HTTPS behind a proxy in production only; local/demo HTTP is intentional (see CLAUDE.md)
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
  app.use(express.static(new URL('../public', import.meta.url).pathname, { maxAge: '1d' }));
  app.use('/app', express.static(new URL('../public/app', import.meta.url).pathname));
  app.use('/_expo', express.static(new URL('../public/app/_expo', import.meta.url).pathname, { maxAge: '1d' }));
  app.use('/assets', express.static(new URL('../public/app/assets', import.meta.url).pathname, { maxAge: '1d' }));
}

// mount last, after API + extras routes: legal/landing pages + the 404 catch-all
export function mountSite(app: express.Express) {
  app.get('/robots.txt', (_q, r) => r.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api\nDisallow: /w\nDisallow: /rsvp\nSitemap: ' + SITE + '/sitemap.xml\n'));
  app.get('/sitemap.xml', (_q, r) => r.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/vendors', '/planning', '/privacy', '/terms'].map(p => `<url><loc>${SITE}${p}</loc></url>`).join('')}</urlset>`));
  app.get('/', (_q, r) => r.send(page('Shaadi OS | Your wedding, together',
    'Find wedding vendors, compare packages and plan your celebration together with Shaadi OS.',
    `<main><section class="hero"><h1>Your wedding,<br>together</h1><p>Find the people who understand your celebration. Compare vendors, plan the details and bring your families together in one wedding workspace.</p><div class="inline-actions"><a class="cta" href="/vendors">Browse wedding vendors</a><a class="cta outline" style="border-color:#F3E8D1;color:#F3E8D1;background:transparent" href="/planning">Preview your plan</a></div></section>
     <section class="preview" aria-labelledby="preview-title"><img src="/plan-preview.png" width="390" height="844" loading="lazy" alt="Plan overview in the Shaadi OS app: a countdown to the wedding, each vendor service with its booking stage, and the start of a month-by-month timeline"><div><h2 id="preview-title">The whole wedding on one screen</h2><p>Each service, from the venue to the pandit, shows whether it is shortlisted, enquired or booked, and how its cost compares with your budget. Below it, a timeline runs month by month to the wedding day with your ceremonies and tasks in date order.</p><p>Families can shortlist vendors together, and guests RSVP through their own invitation link.</p></div></section>
     <p class="note">Have an invitation from a couple? Open your personal invitation link to RSVP.</p><p class="note">Demo preview. Listings may contain sample data; OTP and payments are simulated. No real money is transferred.</p></main>`)));
  mountSiteFeatures(app, page);
  app.get('/privacy', (_q, r) => r.send(page('Privacy Policy | Shaadi OS', 'How Shaadi OS collects, uses and protects your data under India’s DPDP Act.',
    `<h1>Privacy Policy</h1><p style="font-family:sans-serif;color:#8A7680;font-size:12px">Placeholder draft: have a lawyer review before launch.</p>
     <p>We collect the minimum data needed to run bookings: your name, phone number, wedding details and messages with vendors. Payments in this demo are simulated; no card data is stored.</p>
     <p>Under India's Digital Personal Data Protection (DPDP) Act, you can export or delete your data any time from Profile → Privacy, and manage marketing consent there.</p>
     <p>Phone numbers and UPI IDs are hidden in chat until a booking is confirmed, to prevent off-platform leakage and protect you from fraud.</p>
     <p>Questions or grievances: <a href="mailto:grievance@shaadios.example">grievance@shaadios.example</a> (placeholder: set your real officer contact).</p>`)));
  app.get('/terms', (_q, r) => r.send(page('Terms & Conditions | Shaadi OS', 'The terms that govern using Shaadi OS to discover, book and pay wedding vendors.',
    `<h1>Terms & Conditions</h1><p style="font-family:sans-serif;color:#8A7680;font-size:12px">Placeholder draft: have a lawyer review before launch.</p>
     <p>Shaadi OS connects couples with independent wedding vendors. Vendors are responsible for the services they deliver; Shaadi OS facilitates discovery, communication, escrow-style payments and dispute support.</p>
     <p>Booking Protection holds milestone payments until you confirm the work is complete, then releases funds to the vendor minus the platform commission.</p>
     <p>Misuse (including circumventing in-app payments, harassment or fraudulent listings) may result in account suspension. GST and applicable taxes are charged as shown at checkout.</p>`)));
  // catch-all 404 for anything not handled above (after all real routes are mounted)
  app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.status(404).send(page('Page not found | Shaadi OS', 'This page does not exist.', `<h1>404</h1><p>That page doesn't exist.</p><p><a class="cta" href="/">Go home</a></p>`));
  });
}
