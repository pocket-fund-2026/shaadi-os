// Renders the solid-mandap mark (canvas option B) to the PNGs the app needs.
const { chromium } = require(process.env.HOME + '/shaadi-os/.qa/node_modules/playwright-core');
const OUT = process.argv[2];
const BG = '#74263F', GOLD = '#E3C27A';
const mark = `<path d="M232 840V470C232 335 400 290 466 242Q498 220 512 178Q526 220 558 242C624 290 792 335 792 470V840Z" fill="${GOLD}"/>
<circle cx="447" cy="610" r="115" fill="none" stroke="${BG}" stroke-width="50"/>
<circle cx="577" cy="610" r="115" fill="none" stroke="${BG}" stroke-width="50"/>
<path d="M482.5 500.6A115 115 0 0 1 537.6 539.2" fill="none" stroke="${GOLD}" stroke-width="78"/>
<path d="M482.5 500.6A115 115 0 0 1 537.6 539.2" fill="none" stroke="${BG}" stroke-width="50"/>`;
const svg = (size, { rx = 0, bg = true, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" rx="${rx}" fill="${BG}"/>` : ''}<g transform="translate(512 512) scale(${scale}) translate(-512 -509)">${mark}</g></svg>`;
const jobs = [
  ['brand-icon-v3.png', 1024, svg(1024)],                                      // iOS (iOS masks the corners), splash, in-app logo
  ['android-icon-foreground-v3.png', 1024, svg(1024, { bg: false, scale: 0.75 })], // inside Android's 66% safe zone
  ['favicon-v3.png', 48, svg(48, { rx: 230 })],
  ['mark.svg', 0, svg(1024, { rx: 230 })],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const [name, size, markup] of jobs) {
    if (!size) { require('fs').writeFileSync(OUT + '/' + name, markup); continue; }
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
    await p.screenshot({ path: OUT + '/' + name, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
  }
  await b.close();
})();
