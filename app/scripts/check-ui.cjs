const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');
const path = require('node:path');

const bundle = esbuild.buildSync({
  absWorkingDir: path.resolve(__dirname, '..'), entryPoints: ['ui-regression.jsx'],
  bundle: true, write: false, platform: 'browser', format: 'iife',
  loader: { '.png': 'dataurl' },
  alias: { 'react-native': 'react-native-web' },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  define: { 'process.env.NODE_ENV': '"test"', 'process.env.EXPO_PUBLIC_API_URL': '"http://localhost:4600"' },
});
const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.matchMedia = () => ({ matches: process.env.UI_REDUCED_MOTION !== 'false', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
dom.window.fetch = async () => ({ ok: true, json: async () => [{ id: 1, name: 'Fixture photographer', category: 'photographer', city: 'Pune', locality: '', start_paise: 100000, verified: 0, rating: 0, reviews: 0 }] });
dom.window.eval(bundle.outputFiles[0].text);
dom.window.runUiChecks().then(result => {
  console.log(result); dom.window.close();
}, error => {
  console.error(error); dom.window.close(); process.exitCode = 1;
});
