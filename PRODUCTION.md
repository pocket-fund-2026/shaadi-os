# Turning Shaadi OS into a real service

The current app is a demonstration, not a production deployment. Vendor names in `api/src/seed.ts` are fictional. OTP is always `123456`; payment and release endpoints update local records without transferring money. The default API URL is HTTP, and the remote demo backend has not received all local changes.

## Real vendors and customers

Start with businesses willing to join the platform. Collect business name, service category, city, prices, portfolio links, owner contact details and permission to publish their material. `vendor-onboarding.csv` contains a header for collecting that information; it has no invented people or businesses. Owners can register as Vendor and fill their storefront; couples register as Couple / Family. These account flows currently use demo authentication and must not be treated as verified identity.

Use a fresh staging database with `SEED_DEMO_DATA=false` to avoid fictional seed listings. This option prevents seeding; it does not remove existing records. Do not delete existing account or booking data to clear a directory. Before launch, implement explicit listing approval, consent records, ownership checks, photo uploads and a moderation process. Do not assign verified badges automatically. Photos of actual people should be their submitted or properly licensed images with appropriate permissions; stock imagery must not be presented as actual customers or endorsements.

## First release

The recommended first release covers real vendor profiles, customer enquiries and wedding planning. Disable simulated payment routes and payment actions for that release. Add real money movement only after gateway approval and end-to-end payment, refund and payout reconciliation tests. The demo's escrow labels are not evidence of a licensed escrow product.

1. Replace fixed-code authentication with a selected SMS or WhatsApp verification provider. Require expiration, attempt limits, request limits, replay protection and proof of phone verification before profile creation. Verify delivery requirements for the launch country with that provider. [Twilio Verify documentation](https://www.twilio.com/docs/verify/api) is one reference implementation; no provider has been selected or connected.
2. Deploy the API to a continuously running host with a domain and HTTPS. Use server-managed secrets, restricted CORS, explicit admin authorization, server-side input validation, authorization checks, monitoring and redacted logs. The phone must use the HTTPS API URL and must no longer depend on the Mac running locally.
3. Use a separate staging and production database. A single-instance SQLite pilot needs persistent storage and tested backups; a multi-instance service needs a database suited to shared access and explicit migrations. Test backup restoration before onboarding customer data.
4. Add durable media storage with upload limits, access controls and a removal process. The current category artwork is illustration, not vendor portfolio photography.
5. Prepare privacy and terms documents based on the actual data and services, account deletion, support contact, listing moderation and vendor agreements. Have the intended Indian payment/escrow and tax flows reviewed before making corresponding claims.
6. Test signup, profile approval, search, enquiries, wedding planning and invitation links with a small group of real volunteers on actual devices. Measure failures and verify access boundaries between accounts.
7. Distribute a signed iOS build through TestFlight and then App Store review; use the equivalent testing and release process on Android. A web deployment can run alongside the mobile apps. [Expo's iOS production build guide](https://docs.expo.dev/tutorial/eas/ios-production-build/) explains the build and submission flow. The iPhone install currently used for development is not a public distribution channel.

For marketplace payments, [Razorpay Route](https://razorpay.com/docs/payments/route/) supports linked vendor accounts and transfers, but has eligibility and onboarding requirements. Confirm access for this business before selecting it. Integrate signed webhooks, idempotency, refunds and reconciliation; do not mark a payment paid based only on an app callback. No real payment provider has been connected.

## Work completed and remaining

The server now refuses `NODE_ENV=production` while mock authentication and payments remain, and accepts `SEED_DEMO_DATA=false` for a fresh non-production directory. `api/.env.example` documents staging values. These changes are a safeguard and staging setup, not a production launch. Provider implementation, photo uploads, production infrastructure, store accounts, approved real vendor data and device testing remain necessary. Secrets belong in the host's secret settings, not chat or client-side Expo environment variables.
