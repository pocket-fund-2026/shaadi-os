// Renders the logo SVG into every PNG the app and web need.
const { chromium } = require('/Users/kabir/shaadi-os/.qa/node_modules/playwright-core');
const fs = require('fs');
const mark = fs.readFileSync(__dirname + '/mark.svg', 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const WINE = '#7A1F3D';
const jobs = [
  // [file, size, background, mark scale (fraction of canvas)]
  ['icon.png', 1024, WINE, 0.84],                 // iOS: full-bleed, iOS applies its own rounded mask
  ['android-icon-foreground.png', 1024, null, 0.62], // adaptive icon: mark inside the 66% safe zone
  ['android-icon-background.png', 1024, WINE, 0],
  ['splash-icon.png', 1024, null, 0.70],
  ['favicon.png', 196, WINE, 0.94],
  ['preview-sizes.png', 0, null, 0],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage();
  for (const [file, size, bg, scale] of jobs) {
    if (!size) continue;
    await p.setViewportSize({ width: size, height: size });
    const inner = scale ? `<div style="width:${scale * 100}%;height:${scale * 100}%">${mark}</div>` : '';
    await p.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg || 'transparent'}">${inner}</body></html>`);
    await p.screenshot({ path: __dirname + '/out/' + file, omitBackground: !bg });
  }
  // Review sheet: app icon with iOS-style mask at several sizes, plus wordmark lockup.
  await p.setViewportSize({ width: 900, height: 420 });
  const ic = s => `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.225}px;background:${WINE};display:flex;align-items:center;justify-content:center;margin:0 18px"><div style="width:80%;height:80%">${mark}</div></div>`;
  await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&display=swap" rel="stylesheet"></head>
  <body style="margin:0;background:#FBF6F1;font-family:Fraunces,serif;padding:30px">
  <div style="display:flex;align-items:flex-end">${ic(180)}${ic(96)}${ic(60)}${ic(32)}${ic(16)}</div>
  <div style="display:flex;align-items:center;margin-top:40px;margin-left:18px">${ic(72).replace('margin:0 18px', 'margin:0 16px 0 0')}<span style="font-size:58px;font-weight:700;color:#241019">Shaadi OS</span></div></body></html>`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: __dirname + '/out/preview-sizes.png' });
  await b.close();
})();
