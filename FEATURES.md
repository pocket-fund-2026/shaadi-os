# Couple and vendor feature increment

## Purpose

Help couples choose wedding services using actual portfolio material, clear packages and a manageable comparison. Help participating vendors show what they offer. These outcomes address the user's request for real people and a more complete customer experience.

## Input

Existing Expo app, Express API, SQLite database and burgundy/ivory visual identity. No approved real vendor list or provider credentials supplied. Native SVG integration now exists in Pods, but successful installation of the rebuilt phone binary has not been verified. Features are local changes; the remote demo is not updated.

## Key concepts

Use actual submitted portfolio content and prices; empty states stay empty until owners contribute. Publish permission is required for each photo. API writes must belong to the logged-in vendor. Compare at most three listings to keep the decision readable on phones. Starting price is a discovery filter, not a final quote.

## Application

### User Story 1

- **Summary:** Show permitted portfolio work to prospective couples.
- **As a** wedding photographer or service vendor
- **I want to** add an image link and caption to my storefront
- **so that** couples can assess my style before enquiring.
- **Scenario:** Owner publishes a permitted photo.
- **Given:** My storefront exists and I have a public HTTPS image link.
- **and Given:** I have confirmed permission to publish that photo.
- **When:** I add the photo.
- **Then:** It appears in my public portfolio.
- **Scenario:** A different vendor tries to remove a photo.
- **Given:** The photo belongs to another vendor.
- **When:** I request its removal.
- **Then:** The API rejects the request and retains the photo.

### User Story 2

- **Summary:** Explain service packages before an enquiry.
- **As a** participating wedding vendor
- **I want to** publish named packages with inclusions and prices
- **so that** couples can judge whether my service suits their celebration.
- **Scenario:** Owner publishes a package.
- **Given:** My storefront exists and I have entered a package name, description and positive price.
- **When:** I add the package.
- **Then:** My public profile displays its price and inclusions.

### User Story 3

- **Summary:** Narrow the vendor directory to an affordable starting price.
- **As a** couple planning a wedding
- **I want to** apply a maximum starting price
- **so that** I can focus enquiries on vendors within my initial budget.
- **Scenario:** Couple applies a budget.
- **Given:** I have entered a valid positive amount.
- **When:** I apply the budget filter.
- **Then:** The directory contains only vendors whose starting price is no greater than that amount.

### User Story 4

- **Summary:** Compare a few candidates before opening their profiles.
- **As a** couple choosing a wedding service
- **I want to** compare up to three vendors
- **so that** I can review price, location and ratings together.
- **Scenario:** Couple opens a comparison.
- **Given:** I have selected up to three listed vendors.
- **When:** I show the comparison.
- **Then:** The selected vendors' existing data appears in a horizontally scrolling comparison with profile actions.

## Examples

An owner can add an existing direct portfolio image URL with a caption, then publish a ceremony photography package. A couple can apply a starting-price limit and compare the owner with two other listings. No fictional portfolio photographs, people, reviews or package prices are added to user data by this increment.

## Common pitfalls

Image links are not uploads: durable media storage remains a separate launch task. An owner's confirmation is not identity verification. A selected vendor may belong to a different service category; prices are only comparable in context. Images that fail to load show a stable placeholder. Packages do not initiate real payment. Fixed OTP and payment simulation still block production startup.

## References

Applied [PM Skills 101](https://github.com/deanpeters/Product-Manager-Skills/blob/main/docs/Using%20PM%20Skills%20101.md) and the [User Story skill](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/user-story/SKILL.md). Acceptance checks are implemented in `api/src/test.ts` and `app/ui-regression.jsx`.

## Public site and Indian wedding planning increment

**Purpose:** Let a couple assess available services and get an actionable planning preview before creating an account. Let a signed-in couple choose the celebrations that actually fit their families.

**Inputs and assumptions:** The site reads existing vendor profiles, permitted photos and published packages. Seed profiles remain demo data until real vendors join. The planning preview uses the couple's entered date and selected community without writing personal data. Ceremony suggestions are optional; traditions vary by family, region and faith. The planning sequence draws on the [Brides timeline](https://www.brides.com/story/brides-wedding-checklist-custom-wedding-to-do-list) and [Marigold Events' Indian checklist](https://www.marigoldevents.com/2021/03/indian-wedding-planning-checklist/) without copying their checklist text.

### User Story 5 — browse services on the public site

- **As a** couple exploring services, **I want to** filter listings by city, category and maximum starting price **so that** I can open a useful shortlist without first signing in.
- **Given** matching vendor profiles exist, **when** I submit valid filters, **then** only matching profiles appear with their current starting prices.
- **Given** I open a profile, **when** the owner has published permitted photos and packages, **then** I see those details and a path into the app to enquire.
- **Given** I enter invalid budget text, **when** I submit the form, **then** I receive a readable validation message without a server error.

### User Story 6 — preview a date-aware Indian wedding plan

- **As a** couple beginning to plan, **I want to** enter my date and celebration style **so that** I can see which decisions to make now and which can wait.
- **Given** a valid future wedding date, **when** I request the preview, **then** I see original task suggestions ordered by suggested date.
- **Given** the engagement is shorter than a typical planning window, **when** a suggested date is already past, **then** the task is marked “Start now.”
- **Given** I choose a community without baraat or mehndi in the template, **when** the plan appears, **then** those specific suggestions are omitted; I can still add my own tasks in the app.

### User Story 7 — choose celebrations in the app

- **As a** couple planning several events, **I want to** add my own celebration and remove an irrelevant template event **so that** the schedule matches what we will actually host.
- **Given** my wedding workspace exists, **when** I add a named celebration with an optional valid date, **then** it appears in my timeline.
- **Given** another couple's event ID, **when** I try to edit or remove it, **then** the API keeps their event unchanged.
- **Given** I generate suggestions twice, **when** I view my events, **then** the generated template events appear only once.

**Examples and pitfalls:** A Punjabi/Sikh preview can include sangeet music and a conditional baraat task; a Christian preview does not. These are suggestions rather than requirements. Public profiles escape submitted text before rendering. The site lists up to 48 matching vendors, and starting prices are not final quotes. The website preview is anonymous and does not save a wedding; creating a workspace in the app does. No real vendor identities or photos have been imported by this increment.

**Validation:** `api/src/test.ts` covers filtering, escaping, planning preview, conditional suggestions, event ownership and duplicates. App typechecking, UI regression and platform exports cover the client changes. Native phone appearance remains unverified until the rebuilt app is installed.
