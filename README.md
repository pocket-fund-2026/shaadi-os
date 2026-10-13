# Shaadi OS (Phase 1 demo)

The latest local increment adds vendor portfolio image links with publish permission, package pricing and inclusions, customer budget filtering and a three-vendor comparison. The new app/website mark uses interlocking wedding rings beneath a mandap arch. Tab selection, controls and progress use reduced-motion-aware animations. Changes are local; no production deployment or successful installation of the updated phone binary is claimed.

The Plan screen now has a shared progress summary, a clearer checklist with task and due-date editing, and up to 36 optional planning ideas grouped by topic and community. Suggested dates follow the wedding date; for shorter engagements, past ideal dates become “Start now.” Couples can add, edit and remove celebrations as well as generate suggested ceremonies. Updating the wedding date recalculates suggestions while leaving existing task dates under the couple's control. The sequence is adapted from [Brides' wedding planning checklist](https://www.brides.com/story/brides-wedding-checklist-custom-wedding-to-do-list) and [Marigold Events' Indian wedding checklist](https://www.marigoldevents.com/2021/03/indian-wedding-planning-checklist/), with original wording and flexible multi-event use. The public website now has searchable vendor listings, vendor portfolio and package pages, and a wedding-date planning preview at `/planning`.

See [FEATURES.md](FEATURES.md) for the applied PM skill and acceptance criteria, and [PRODUCTION.md](PRODUCTION.md) for the path from demo to a real service. Run `npm test` in `api/` for the current regression suite. `NODE_ENV=production` now refuses to start while authentication and payments remain simulated. Use `SEED_DEMO_DATA=false` with a fresh non-production database to avoid fictional listings.
- api/  Node+TS (Express, node:sqlite). Run: `cd api && PORT=4600 npx tsx src/server.ts`. Serves web app + APK from api/public.
- app/  Expo React Native (Android/iOS/web). The latest web export is served from api/public/app at `/app?browse=1`; its shared assets are served at `/assets` and `/_expo`.
- Mocked (replace later): OTP (123456), payments/escrow (`/api/milestones/:id/pay`), WhatsApp share (wa.me link).
- Flag for CA/lawyer: escrow, GST/TCS, DPDP consent.
- iOS native build needs a Mac + Apple Developer account: `npx expo prebuild -p ios` / EAS.

## Planning workspace update (12 October 2026)

The Plan tab now opens a wedding overview with a countdown, checklist progress, guest headcount including plus ones, budget commitments and upcoming ceremonies. The checklist supports due dates, pending/overdue/completed filters and deletion. Budget allocations and wedding names, city and estimated guest counts can be edited.

Backend changes validate calendar dates and task updates, preserve every paise when splitting milestones, prevent repeated bookings and freeze payment actions on disputed bookings. Offline caches are scoped to the login session and cleared after successful writes or logout.

Run `npm test` in `api/` for eighteen regression tests using an isolated in-memory database and in-process HTTP transport. Node 22.18+ is required for the native TypeScript test command. Typecheck with `npm run typecheck` in `app/`. The latest export is in `app/dist-ui/`; the live remote demo has not been updated.

See [IOS-INSTALL.md](IOS-INSTALL.md) for Xcode signing, installing on an iPhone and connecting it to the local backend. Existing source backups are in `.backups/planner-20261012/`. Longer new planning descriptions currently use the existing English fallback; core labels have translations for all supported languages.
