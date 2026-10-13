# Shaadi OS interface

The second brand mark was generated for the user's explicit application-icon request and saved to `brand/out/icon-generated-v2.png`. Prepared assets include a 1024 px opaque app icon, a safe-area Android foreground and a website mark/favicon. The iOS asset catalog and existing Android icon resources were updated, with previous assets backed up under `.backups/brand-20261012`. The application and website use the same rings-and-mandap emblem. Native UI service icons remain locally drawn SVGs, including the partnership icon in the couple's planning tab. Tab selection has a 160 ms scale transition that respects reduced motion; website links use restrained pointer feedback and visible keyboard focus.

Portfolio images are owner-provided HTTPS links with a required permission confirmation. They are not generated customer portraits. Vendor packages and comparison values come from saved records. The image-link feature does not provide file uploads or identity verification.

The interface builds on the existing burgundy, warm ivory and Fraunces identity. Wedding stationery informs the floral arch and category illustrations. Illustrations identify services; they are not vendor portfolio photographs. Prices, verification flags, ratings and result counts come from the API.

The customer can browse, filter, sort and inspect vendors before signing in. Enquiries still require authentication. The existing couple and vendor workspaces remain available after login.

## Icons and motion

`app/src/icons.tsx` holds the locally drawn, typed SVG icon set on a 24-unit grid. Navigation, categories, buttons, tasks, ratings and empty states use these icons rather than emoji. SVG illustrations scale without remote image requests.

Controls have restrained press feedback. Entries use a 220 ms reveal with a capped stagger, and progress bars transition in 320 ms. Animations stop on cleanup and respect the operating system reduced-motion setting. Buttons have at least 44-unit targets; input labels, selected states and disabled states are exposed to accessibility APIs.

Guidance applied from [OpenDesign frontend design](https://github.com/nexu-io/open-design/blob/main/skills/frontend-design/SKILL.md), [OpenDesign motion](https://github.com/nexu-io/open-design/blob/main/skills/emilkowalski-motion/SKILL.md), and [anti-slop](https://github.com/miqdadbadjuber/anti-slop). Anti-slop mode is during, as selected for this session.

## Validation on 12 October 2026

- Code integrity: PASS. TypeScript and targeted ESLint checks passed.
- Data behavior: PASS for the seven existing backend regression tests. Public directory and detail views reuse existing read endpoints; no fabricated vendors or reviews were added.
- Packaging: PASS. Expo exported both web and iOS JavaScript bundles to `app/dist-ui`. This is not an iOS signed binary or an installation on a phone.
- Visual and interaction review: source reviewed for narrow layouts, safe-area padding, error/retry/empty states, keyboard handling and reduced motion. Live browser and phone verification remain pending because the environment could not launch the browser or install through Xcode. No runtime visual pass is claimed.

## Layout regression repair

The subsequent iPhone screenshot showed a separate native integration failure: red `Unimplemented component: <RNSVGSvgView>` blocks. The iOS lockfile and Pods manifest were missing `RNSVG`. CocoaPods installation now includes `RNSVG 15.15.4`, and generated `RCTThirdPartyComponentsProvider.mm` registers `RNSVGSvgView`. The Pods project includes the SVG Objective-C++ sources. Installation completed using the existing local React Native dependency and core archives because the environment could not resolve the CocoaPods CDN. The Desktop installer now installs Pods and runs `check:ios-deps` before building. Native build execution was blocked by the environment's Xcode services restrictions; the existing phone binary still needs rebuilding and reinstalling through Xcode. JavaScript export or reload does not establish that this native fix is installed on the phone.

Clickable cards previously used an outer animated wrapper with `flexShrink: 1` and a second flex layout on the inner pressable. This made their sizing differ from static cards and could collapse or constrain content in scroll layouts. Cards, chips and buttons now use a single animated pressable, which owns all padding, margins and layout styles. Animated pressables receive style arrays rather than style callbacks, so their styles survive animation processing on web as well as native.

`app/ui-regression.jsx` and `app/scripts/check-ui.cjs` exercise the real web components in a DOM environment. They verify direct layout ownership, retained card padding and flex, direct chips in wrapping rows, SVG button content, login rendering, the browse action and API-driven vendor rendering. The checks use installed `esbuild` and `jsdom` tooling from the sibling project for this session: `NODE_PATH=/Users/kabir/jobless-board/node_modules node scripts/check-ui.cjs` from `app`. Set `UI_REDUCED_MOTION=false` to exercise the animated path. These checks do not measure browser pixel geometry or establish iPhone visual correctness.
