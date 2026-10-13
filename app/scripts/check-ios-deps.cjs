const fs = require('node:fs');
const path = require('node:path');
const ios = path.resolve(__dirname, '../ios');
const fail = message => { console.error(message); process.exit(1); };
const read = relative => {
  const filename = path.join(ios, relative);
  if (!fs.existsSync(filename)) fail(`Missing ${relative}. Run pod install in app/ios before building.`);
  return fs.readFileSync(filename, 'utf8');
};
const lock = read('Podfile.lock');
const manifest = read('Pods/Manifest.lock');
if (lock !== manifest) fail('Installed pods do not match Podfile.lock. Run pod install before building.');
if (!/\n  - RNSVG \(/.test(lock)) fail('The SVG native library is missing. Run pod install and rebuild the iPhone app.');
const registry = read('build/generated/ios/ReactCodegen/RCTThirdPartyComponentsProvider.mm');
if (!registry.includes('@"RNSVGSvgView": NSClassFromString(@"RNSVGSvgView")')) fail('The SVG component is not in the native registry. Run pod install to regenerate native code.');
const project = read('Pods/Pods.xcodeproj/project.pbxproj');
if (!project.includes('RNSVGBrush.mm in Sources')) fail('SVG sources are not in the Pods build project. Run pod install.');
console.log('PASS: SVG pod installed, manifests match, native component registered and SVG sources included. Phone binary still requires a native rebuild.');
