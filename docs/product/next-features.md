# Shaadi OS: next features (November 2026)

Method: [Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills), route "PRD → epics → stories": problem framing, proto-personas, jobs-to-be-done, ICE prioritisation (the repo's recommendation before product-market fit), then user stories with Gherkin acceptance criteria (one When, one Then each).

No user research has been done yet. Every persona trait, pain and score below is tagged **[ASSUMPTION—VALIDATE]** and should be checked in 5–10 interviews with couples and vendors (repo skill: discovery-interview-prep, Mom Test questions such as "Tell me about the last time you booked a wedding vendor").

## Problem

**Restated problem (problem-framing-canvas):** The couple, usually with a parent, struggles to choose and pay the right vendors on time because quotes arrive one at a time in separate chats and nothing tells them when each instalment is due, which leads to slow decisions, missed payments and vendors booked by someone else. This affects first-time planners most and has been overlooked because the app was built screen by screen (search, chat, bookings) rather than around the decision a couple is making. [ASSUMPTION—VALIDATE]

**How might we** help couples compare offers and keep payments on track as we aim to get every service booked well before the wedding?

## Proto-personas

**Primary: Priya, the planning bride** [ASSUMPTION—VALIDATE]
- 26–30, Pune or Mumbai, working, plans on her phone in the evenings with her mother.
- Trying to: book 6–8 vendors within a budget her family agreed, without being overcharged.
- Pains: quotes come as WhatsApp messages and PDFs she can't line up; she forgets which instalment is due when; asking three photographers means typing the same details three times.
- Decision authority: shared with parents; budget approved by the family.
- Quotes: [PLACEHOLDER—NEEDS RESEARCH]

**Secondary: Rakesh, the small vendor** [ASSUMPTION—VALIDATE]
- Runs a 3-person decor or photography business; replies between events from his phone.
- Trying to: turn enquiries into bookings fast and get paid on time.
- Pains: retyping the same package prices into every quote; chasing payments.
- Quotes: [PLACEHOLDER—NEEDS RESEARCH]

## Jobs to be done (summary)

- Functional: compare offers for one service; ask several vendors at once; pay each instalment on time; send a quote quickly.
- Social: show the family the choice was fair and within budget.
- Emotional: avoid the fear of being overcharged or of losing a date; feel in control near the wedding.

## Prioritisation (ICE, 1–10 each) [ASSUMPTION—VALIDATE]

| Opportunity | Impact | Confidence | Ease | ICE |
|---|---|---|---|---|
| Instalment due dates and payment reminders | 7 | 8 | 8 | **448** |
| Compare quotes side by side for one service | 8 | 7 | 7 | **392** |
| Quote from a saved package (vendor) | 6 | 7 | 8 | **336** |
| Send one enquiry to several shortlisted vendors | 7 | 6 | 7 | **294** |
| Vendor reply-time badge | 6 | 6 | 7 | 252 |
| Shareable booking summary | 4 | 6 | 8 | 192 |

Build the top four now; the reply-time badge and booking summary wait.

## User stories

### Story 1: Know when each instalment is due
- **As a** couple paying a vendor in instalments **I want to** see the due date of each instalment **so that** I pay on time and the vendor keeps my date.
- Scenario: an instalment is due within a week
  - Given: a booking whose next instalment is due within 7 days
  - and Given: it is not yet paid
  - When: I open the plan
  - Then: Reminders shows "Pay <instalment> to <vendor>" with its due date, and the vendor screen shows the date beside the instalment.
- Rule: token advance due 3 days after booking; "one week before event" due 7 days before the event date; "after event" due 3 days after it.

### Story 2: Compare quotes for one service
- **As a** couple with quotes from several vendors for the same service **I want to** see them side by side **so that** I can pick one with my family without switching chats.
- Scenario: two photographers have quoted
  - Given: two or more active quotes for the same service
  - When: I open My vendors
  - Then: a "Compare N quotes for <service>" card opens a side-by-side view of totals, line items, ratings and instalments, each with a link to that vendor.

### Story 3: Quote from a saved package
- **As a** vendor who has listed packages **I want to** start a quote from a package **so that** I reply to enquiries in seconds instead of retyping prices.
- Scenario: vendor with packages sends a quote
  - Given: my storefront has at least one package
  - When: I open the quote builder
  - Then: each package appears as a one-tap option that adds its name and price as a line item.

### Story 4: Ask several vendors at once
- **As a** couple who has shortlisted several vendors for one service **I want to** send the same enquiry to all of them **so that** I collect quotes without retyping my details.
- Scenario: two other photographers are shortlisted
  - Given: other shortlisted vendors on Shaadi OS for the same service that I haven't enquired with
  - When: I send an enquiry
  - Then: I can tick them under "Also send to", and each receives the same enquiry as a separate conversation in My vendors.

## Success metrics [ASSUMPTION—VALIDATE]
- Primary: share of bookings whose instalments are paid by the due date.
- Secondary: median days from first enquiry to booking per service; quotes per enquiry.
- Guardrail: vendor reply rate does not fall as couples send more enquiries.

## Out of scope
- Real payment collection and automatic charging (needs a payment gateway).
- Push notifications for payment dates (local task reminders already exist; server push needs Apple credentials).
- Negotiation or counter-offers inside the comparison view.
