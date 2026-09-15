# UtilitySheet Strategic Product and Growth Audit

- Date: 2026-09-10
- Author: Claude Code (Opus 5), continuing an audit started by OpenAI Codex
- Baseline: `main` at `7b76a93`
- Status: Recommendations for owner decision. No product, pricing, schema, or production change was made.
- Live-data addendum (added 2026-09-10, after this report was completed): [2026-09-10-live-business-baseline.md](2026-09-10-live-business-baseline.md). It measures production Neon, Stripe, and Vercel Analytics read-only and records which conclusions below it strengthens, weakens, or overturns. The text of this report is unchanged and still reflects its original evidence base.

## How to read this report

Every material claim carries one of three labels:

- **[Verified]** Directly supported by current code, maintained documentation, tests, observed public product behavior, aggregate analyses already recorded in this repository (dated and cited), or cited public sources.
- **[Inference]** A conclusion reasoned from verified facts but not measured.
- **[Hypothesis]** Requires customer conversations, behavioral data, or an experiment before anyone should act on it as true.

Major recommendations are classified **Build now**, **Validate first**, **Later**, or **Do not build**.

### Evidence base and access limits

Reviewed for this audit:

- Current code for pricing, plan gating, metering, billing, Teams, referrals, attribution, analytics, activation reporting, provider suggestions, packet and PDF output, crons, and lifecycle email.
- `PRD.md`, `ADMIN.md`, `docs/ai-telemetry.md`, `docs/growth/*`, the July 2026 growth design and independent growth review, the 2026-07-01 UX audit, the July provider-incident communications, the 2026-09-03 Michelle Wright evaluation, the Team billing decision record, and the suite strategy.
- Five public-flow screenshots in `output/playwright/product-audit/` and the live pricing page, fetched 2026-09-10.
- Public competitor and market sources cited inline.

Limits, stated plainly:

- **No production database, Stripe, Vercel Analytics, or email-provider data was accessed in this session.** Every behavioral number below comes from repository documents that record earlier analyses:
  - the founder-reported July 14, 2026 baseline in `docs/growth/experiment-log.md`;
  - the owner-authorized read-only production queries recorded 2026-09-03 in `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`.
- Those numbers are point-in-time and small. They are not a market base rate.
- The authenticated dashboard was not driven in a browser for this audit.
- No new customer conversations were held. The only customer voice available is four published testimonials and one paying customer's support message.
- Retention, conversion, willingness to pay, and revenue were **not measured**. Where this report discusses them, it says how to measure them.

---

## 1. Executive strategic thesis

**UtilitySheet should become the standard seller handoff step for listing-side transaction coordination, bought by small TC companies.** The wedge is utilities. The natural boundary is everything a seller knows about the property that the buyer side needs at closing, collected once per transaction and delivered as one trusted packet. It should not become a transaction manager, a homeowner binder, a form builder, a utility concierge, or an agent CRM.

The case, in brief:

1. **The product is ahead of the business.** [Verified] The workflow is complete and operationally hardened: reusable link, no-account mobile seller flow, AI provider suggestions, web and PDF packet, branding, submitted-sheet editing, Teams billing, referral credits, and an audited admin plane. [Verified, 2026-09-03 aggregate] The paying base was 9 Pro workspaces against 108 Free workspaces. 95 percent of Property Handoff Packet requests came from 2 accounts. [Inference] At list price, 9 Pro workspaces is roughly $81/month before any Team subscriptions; the Team subscription count is not recorded in the repository. The binding constraint is not feature breadth.

2. **The job is real, recurring, and tied to listing volume.** [Verified] Every published testimonial describes the same pain: chasing sellers through blank forms, email, and text, then cleaning up vague answers. [Verified] The power accounts show recurring use: 178 and 69 distinct property addresses across 103 and 50 separate days. [Inference] Retention comes from template embedding. Once the link lives in a TC's listing email or checklist, usage recurs with each file at near-zero effort. That is excellent for retention and invisible for engagement, which shapes every recommendation below.

3. **The pricing is set like a template, not like a workflow step.** [Verified] Pro is $9/month for unlimited files, and Teams is $7/seat/month with a 3-seat minimum. Both are monthly only. [Verified, public source] Independent TCs charge roughly $275 to $450 per file ([ListedKit salary guide](https://www.listedkit.com/resources/transaction-coordinator-salary-guide-2026)), and adjacent "home handoff" software charges $69 per handoff ([HomeHandoff](https://home-handoff.com/)). [Hypothesis] TC companies would pay materially more for a company-standard version. This is unvalidated, and the report does not recommend a price change until it is.

4. **The most defensible future is company adoption plus handoff quality, not data or network effects.** [Inference] The form, the PDF, and AI suggestions are copyable. A TC company that has standardized its seller handoff on UtilitySheet across coordinators, with its branding and its buyer-side delivery, is much harder to displace.

5. **The biggest near-term risk is building on a thin evidence base.** [Verified] The growth experiment scoreboard was never filled in past its zero row. The client funnel events go to Vercel Analytics, which cannot follow an account. The company-buyer thesis rests on four testimonials and two power accounts. **The first move is measurement and customer conversations, then one clearly justified retention feature: automatic seller follow-up.**

Where I disagree with current direction:

- **Teams is a billing tier, not yet a team workflow.** [Verified] Seller links and packet defaults are per account (`intake_links` is `UNIQUE(account_id)`). The public "Org-wide packet defaults" claim has no organization-scoped implementation behind it.
- **The closing-exposure loop is better instrumented than most, but it leaks where it matters.** [Verified] The packet PDF, the artifact most likely to be forwarded, has an untracked plain-text footer. Paid white-label accounts, the busiest producers, show no CTA at all.
- **The PRD's MVP included seller reminder automation, and it was never built.** [Verified] Reminders are manual only. For a product whose promise is "stop chasing sellers," this is the most obvious retention gap.
- **More seller questions are not the growth path.** [Verified, 2026-09-03] Advanced mode costs about 5 points of completion. 45 percent of submitted advanced requests contained no advanced answers.

---

## 2. Current understanding of UtilitySheet

### What the product does today [Verified]

| Area | Current behavior | Source |
| --- | --- | --- |
| Seller collection | Reusable per-account seller link (`/i/[slug]`) and per-request links (`/s/[token]`). Seller needs no account. Home Basics, then utilities with address-based suggestions, search, or "I'm not sure". | `schema.sql:145-158`, `app/i/[slug]/page.tsx`, screenshots 03-05 |
| Packet modes | Simple Utility Sheet (Free and paid). Property Handoff Packet (paid) adds five modules; the built-in inventory totals 51 questions across 15 sections. | `lib/packet/modules.ts`, `lib/packet/seller-questions.ts` |
| Output | Public web packet (`/packet/[token]`), PDF, and completion email with optional PDF attachment. Paid accounts can edit submitted sheets. | `app/packet/[token]/page.tsx`, `lib/marketing-content.ts:43-49` |
| Provider suggestions | Gemini-backed suggestions blended with **per-account, per-workspace** provider memory. Contact resolution with dashboard alerts. Redacted telemetry. | `lib/providers/suggestion-service.ts:1111-1141`, `lib/neon/queries/provider-memory.ts:59-64`, `docs/ai-telemetry.md` |
| Tracking | Requests workspace with status, search, pagination, and "needs attention". Manual seller reminder. | `app/api/requests/[id]/remind/route.ts`, `.ai/plans/2026-07-17-requests-workspace.md` |
| Activation aids | Onboarding centered on the link. Self-serve test drive that sends a real, fictional submission and PDF to the user. Two lifecycle emails (15 minutes and 1 day after signup). | `app/api/test-drive/route.ts`, `schema.sql:283-295` |
| Plans | Free: 3 live files per calendar month per account; over-limit submissions saved but locked. Pro $9/month. Teams $7/seat/month, 3-seat minimum. Monthly billing only. | `lib/neon/queries/accounts.ts:245-267`, `app/api/seller/[token]/route.ts:495-553`, `app/api/organization/billing/checkout/route.ts:24-28`, `lib/stripe/client.ts:13-14`, live [pricing page](https://www.utilitysheet.com/pricing) |
| Teams | Organization workspace, admin/member roles, invitations, org-scoped Branding Profiles, notification routing, Pro-to-Team conversion in place. Seller link and packet defaults remain per account. | `schema.sql:28-81`, `.ai/decisions/2026-08-27-team-billing-ownership-and-workspace-isolation.md` |
| Growth mechanics | First-touch UTM and `ref` attribution. Packet-page referral CTA with server-side impression and click counts. `/from-a-closing` recipient page. $9 referral credit per activated referral (max 12 per 365 days). First-time Pro trial for referred accounts. | `lib/growth/attribution.ts`, `components/packet/transaction-referral-cta.tsx`, `lib/neon/queries/referral-credits.ts:146-197`, `lib/referrals/referral-trial.ts` |
| Demand capture | "Don't see a question you need?" requests stored as workspace-scoped records. | `schema.sql:160-170`, `.ai/plans/2026-09-03-question-gap-capture.md` |
| Integrations | None. "Works alongside Dotloop, Skyslope & Brokermint" means pasting the link. No API, webhooks, or prefill entry point. | `components/landing/TrustStrip.tsx:24`, `app/dashboard/requests/new/page.tsx:92-93` |

### Contradictions found between docs, code, copy, and pricing

| # | Contradiction | Evidence | Severity |
| --- | --- | --- | --- |
| C1 | Pricing and marketing promise **"Org-wide packet defaults"** for Teams. Packet mode, modules, and exclusions are stored only on the per-account `intake_links` row. No organization-scoped default exists. | `lib/marketing-content.ts:118`, `components/landing/PricingSection.tsx:61` vs `schema.sql:145-158`, `lib/neon/queries/intake-links.ts` | High: a Team buyer-facing claim |
| C2 | **"Nearly 86% of started UtilitySheets are completed"** appears on seven public surfaces. No query, document, or test in the repository defines the number or its denominator. The 2026-09-03 analysis recorded 82.1 percent (Simple) and 77.3 percent (Advanced) submit rates, likely on a different denominator. | `lib/marketing-content.ts:39,136`, `components/landing/SocialProofBar.tsx:21`, `app/(marketing)/from-a-closing/page.tsx:155` | Medium: may be true, but is not reproducible |
| C3 | The PRD MVP requires **reminder automation**. Only manual reminders exist: `vercel.json` schedules just the two activation crons. | `PRD.md:128`, `vercel.json`, `app/api/requests/[id]/remind/route.ts` | High: core promise gap |
| C4 | A weekly summary route, query, and email exist, and the route comment says it runs every Monday. It is not scheduled, and Settings intentionally hides it. | `app/api/cron/weekly-summary/route.ts:55-66`, `app/dashboard/settings/page.tsx:1059-1062` | Low: honestly handled in UI, stale in code comment |
| C5 | Marketing features list "Tracking, reminders, and status visibility". Reminders are manual only. | `lib/marketing-content.ts:172-176` | Low |
| C6 | Suite context lists an Intake to UtilitySheet prefill handoff as a planned flow. No prefill entry point exists. | `norma_suite_context.md` header, `app/dashboard/requests/new/page.tsx:92-93` | Low: planned, not claimed publicly |
| C7 | The PRD describes system-maintained canonical providers improving "using aggregated confirmations". Provider memory is scoped to the same account and workspace. There is no cross-customer provider knowledge. | `PRD.md:321-330` vs `lib/neon/queries/provider-memory.ts:61-62` | Informational: strategic, see section 16 |
| C8 | The 2026-07-01 UX audit reported no way to delete or archive a request. It remains true: no dashboard code issues a request DELETE. | `docs/design/UTILITYSHEET_UX_UI_AUDIT.md:61`, grep of `app/dashboard` and `components` | Medium: quota and hygiene irritant |

### What it does especially well [Verified unless noted]

- **The seller flow respects the unpaid, untrained participant.** No account, autosave, "I'm not sure" always allowed, and curated prompts. The 2026-09-03 fill-rate data shows sellers reliably answer "where is it" and "who services it" questions (breaker box 88.9 percent, water shutoff 84.3 percent).
- **The Free-limit lock is a fair, value-connected upgrade trigger.** The seller's work is saved and unlocks on upgrade (`app/api/seller/[token]/route.ts:495-553`). The TC hits the paywall at the exact moment the value exists.
- **Operational discipline is unusually high for the size.** It includes idempotent Stripe flows, audited admin writes, redacted AI telemetry, an honest activation funnel that excludes demos, and a documented incident response.
- **The team is willing to reject expensive ideas on evidence.** The Michelle Wright evaluation declined a custom-question builder after measuring fill rates.

### What is confusing, weak, or underdeveloped

- **Teams is thin as a workflow** (C1, and section 12).
- **Nothing happens automatically when a seller stalls** (C3).
- **The output's journey after delivery is unknown.** [Verified] The product records packet actions client-side and CTA impressions server-side. It does not record, per request, whether the packet was viewed by anyone other than the owner, or whether it was forwarded as a link or as a PDF.
- **Positioning straddles two names.** [Verified] The homepage sells "Stop chasing sellers for utility info". The paid mode is "Property Handoff Packet". [Inference] That tension is healthy if deliberate. Section 15 resolves it.
- **The public demo accepts a non-address.** [Verified, screenshots 02-05] The captured demo ran on the literal placeholder "123 Sample Street, City, state, zip" and then showed nationally scattered electric suggestions (Dominion, Duke, FPL). [Inference] This is a capture artifact, not proof of poor suggestions, but a prospect who types junk sees the product at its least convincing.

### Differentiation versus alternatives

| Alternative | What it does | UtilitySheet advantage | Where the alternative wins |
| --- | --- | --- | --- |
| Blank PDF, DocuSign/Dotloop form, email, text | Asks the seller to type everything | Guided mobile flow, suggested providers, one reusable link, finished branded output, status tracking [Verified by testimonials, `docs/growth/customer-proof-library.md`] | Zero cost, already inside the TMS the TC uses |
| Canva/Etsy templates, pdfFiller, DocHub | Static sheet the TC fills in ([Etsy](https://www.etsy.com/listing/1672742266/utility-sheet-real-estate-utilities-list), [pdfFiller](https://seller-utility-information-sheet.pdffiller.com/), [DocHub](https://www.dochub.com/fillable-form/53060-real-estate-utility-information-sheet)) | Seller does the work; no retyping | One-time $5 to $15 purchase; full design control |
| Google Forms, Jotform | Generic forms ([Jotform TC template](https://www.jotform.com/form-templates/transaction-coordinator-form)) | Address-aware suggestions, utility logic (well/septic/fuel), buyer-ready packet, no setup | Arbitrary questions; free or bundled |
| Transaction management (Open to Close $99-399/mo, DocJacket $29/user, ListedKit $14.99/intake, per [ListedKit comparison](https://www.listedkit.com/best-tc-software)) | Checklists, documents, deadlines, AI contract intake | Purpose-built seller utility capture; none of the compared tools claim it [Verified from that comparison page] | Owns the TC's daily workflow and budget |
| HomeHandoff ($69/handoff, $114-164/mo, per [home-handoff.com](https://home-handoff.com/)) | Seller-built digital home handbook, including utilities and smart-home credentials, plus a personal-property marketplace, aimed at listing agents | Coordinator-first, cheaper, no seller effort on research, provider suggestions | Broader buyer-experience story; agent listing-win marketing claim (its own claim: "89% of sellers say...") |
| Sellers Shield (free, per [sellersshield.com](https://sellersshield.com/home/tc/)) | Guided seller disclosure forms with TC dashboard and reminders, monetized through legal protection | Utilities and property handoff, not legal disclosure | Already sits in the seller-form moment for TCs, with reminders |
| Utility concierges (Utility Connect, MoveEasy, Citizen Home Solutions) | Free buyer utility setup, private-labeled for agents, funded by the provider side ([Utility Connect](https://www.utilityconnect.net/brokers-and-agents), [Howard Hanna and MoveEasy](https://blog.howardhanna.com/press/howard-hanna-and-moveeasy-partner-to-launch-hanna-home-concierge-a-complimentary-service-for-howard-hanna-agents-to-deliver-clients-exclusive-discounts-and-value/)) | Captures the seller's actual existing providers; not a sales channel | Free to agents; handles setup itself |

[Inference] UtilitySheet's defensible difference is narrow but real. It is the only product found that turns the seller's own knowledge of current providers into a finished coordinator deliverable with no chasing. The closest threats are adjacent products extending into that moment (Sellers Shield, HomeHandoff), not the TMS platforms.

---

## 3. Primary and secondary ICP assessment

### Roles in the workflow

| Role | Who | Evidence |
| --- | --- | --- |
| User | Transaction coordinator or listing admin who places the link, watches status, and reviews and edits the sheet | [Verified] Product design, onboarding, testimonials |
| Buyer (pays) | Solo TC or TC-company owner. Rarely the listing agent. | [Verified] Pro/Teams billing; two of four testimonials are owners. [Hypothesis] Owners are the main payers. |
| Beneficiaries | Listing agent (TC's client, sees polish); buyer and buyer's agent (receive providers); seller (less back-and-forth) | [Inference] |
| Distribution participants | Buyer-side TC or agent who receives the packet; TC communities and educators | [Verified] "Other side of a closing" and TC Facebook groups are the founder-reported strongest sources (`docs/growth/experiment-log.md`) |
| Unpaid participant | Seller | [Verified] |

### Primary ICP: small TC companies doing listing-side files for multiple agents

A primary ICP is a company with roughly 2 to 10 coordinators, often owner-led, serving many agents, and standardizing a "listing launch" checklist.

- **Supporting evidence.** [Verified] Two of four public testimonials are TC-company owners (Precision Leverage Solutions, FastForward Transaction Management). The other two work in TC practices. [Verified] Power usage is highly concentrated: 178 and 69 distinct addresses. That volume fits a busy coordinator practice better than a typical individual agent. [Verified] The product already invested in Teams billing, workspace switching, and notification routing.
- **What is not known.** [Hypothesis] Whether the two power accounts are companies or solo coordinators. Whether owners, not coordinators, make the purchase. Whether companies will pay more than $7/seat for a standardized workflow.
- **Why companies over solo TCs.** [Inference] A company multiplies file volume, which powers the exposure loop. It enforces the link across staff, which creates retention that survives one person leaving. It is the only segment where a price above impulse level is plausible.

### Secondary ICP: independent solo TCs

- They are the acquisition base, loop carriers, and future company founders. They are reachable in TC communities, and the $9 Pro plan fits them.
- [Inference] Solo TCs should stay fully served, but the product should not be shaped around their lowest willingness to pay.

### Not an ICP now: individual listing agents

- [Verified] Marketing includes an agent page (`app/(marketing)/utility-sheet-for-real-estate-agents/page.tsx`).
- [Inference] Most agents list too few homes per month to exceed the Free plan's 3 live files. They would rarely convert and would rarely create recurring habits.
- [Inference] TCs are paid by agents to do exactly this chasing. Positioning UtilitySheet toward agents risks telling a TC's clients they do not need the TC. Serve agents who self-coordinate, but do not market toward them until data shows agents activating and paying.

### Not an ICP: brokerages

Section 12 covers why brokerage-level investment is premature.

---

## 4. Jobs, pain, "aha" moment, and willingness to pay

### Jobs to be done

1. **Functional.** "When a listing goes live or under contract, get the seller's utility and property service information into a clean, buyer-ready document without me chasing, retyping, or researching." [Verified by all four testimonials]
2. **Professional.** "Make my coordination service look complete and premium to the agents who hire me." [Verified] Agatha Aquilia's published quote says the branded PDF "helps level up my TC company's service" (`components/landing/SocialProofBar.tsx`).
3. **Operational (company).** "Make every coordinator on my team handle the seller handoff the same way." [Hypothesis] Plausible from Teams interest; not yet voiced in repository evidence.

### How severe and frequent is the pain?

- **Frequency.** [Verified] Nearly every listing-side resale involves a utility handoff. NAR reported a 4.06 million annual rate of existing-home sales in July 2026 ([NAR](https://www.nar.realtor/newsroom/nar-existing-home-sales-report-shows-1-7-decrease-in-july)). [Inference] Frequency per customer is set by that customer's listing volume, so the product's value per customer varies by orders of magnitude.
- **Severity.** [Inference] Moderate per file and cumulative across files. A missing provider is annoying, not catastrophic, and rarely blocks closing. Pain comes from repeated chasing and cleanup time, and from looking unprofessional.
- [Hypothesis] Severity is high enough to justify a company-level price for TC companies. It is probably not high enough for a standalone high price for solo agents. There is no measured time-saved figure in the repository.

### The "aha" moment

[Verified design, Inference as the aha] The aha is **the first live seller submission arriving as a finished, branded sheet and PDF in the TC's inbox without any follow-up.** The self-serve test drive simulates it with a fictional property (`.ai/plans/2026-07-21-self-serve-test-utilitysheet.md`).

[Verified, founder estimate] Only an estimated 10 to 30 of about 120 signups had used the product on a real transaction by the July baseline. [Inference] The aha depends on a live listing file existing soon after signup, which the product cannot control.

### Use once, use repeatedly, become normal workflow

| Stage | Trigger | Evidence |
| --- | --- | --- |
| Use once | A live listing file needs utilities while the tool is top of mind | [Inference] from the activation gap |
| Use repeatedly | The link is pasted into a listing email template or checklist task | [Verified] Testimonial: "we send one seller link from a templated email, get notified when it is complete... and we are done." |
| Normal workflow | Every coordinator in the company uses the same link and output, and the buyer side expects the packet | [Hypothesis] |

### What creates willingness to pay

- **Current triggers.** [Verified] The Free-limit lock (usage), Property Handoff Packet mode, editing, and white-label branding.
- **Actual behavior.** [Verified, 2026-09-03] 9 of 117 workspaces were Pro. Paid adoption of advanced mode was 5 of 9, versus 1 of 108 for Free.
- **Candidate stronger drivers.** [Hypothesis] Company standardization (one form and brand across coordinators). Not having to chase stalled sellers (automation). Proof the packet reached the buyer side.
- **Evidence gap.** No price-sensitivity data exists. No churn or cancellation reason data is recorded in the repository.

---

## 5. The actual core product opportunity

The opportunity is not "utility sheet generation." A Canva template already generates a utility sheet.

The opportunity is **owning one recurring step in listing-side coordination: getting what the seller knows about the property out of the seller and into the hands of the buyer side, complete, on time, and in the coordinator's brand.** [Inference]

Owning that step has three parts, and UtilitySheet currently does only the middle one well:

| Part | Today | Opportunity |
| --- | --- | --- |
| **Getting the seller to do it** | One link, then manual nudges | Automatic follow-up until submitted, with TC-visible exceptions (bet 1) |
| **Collecting it well** | Strong: guided flow, suggestions, fill-rate evidence, curated prompts | Protect completion rate. Add questions only on measured demand. |
| **Delivering it to the other side** | TC downloads the PDF or copies a link, then forwards it outside the product | Tracked buyer-side delivery with a designed recipient view (bet 3) |

[Inference] Completing both ends turns UtilitySheet from a form into a closed loop the TC can trust and stop thinking about. Delivery is also where acquisition exposure lives, so the same work serves retention and growth.

---

## 6. Initial wedge, expansion boundary, and feature-creep boundary

### Initial wedge

**Seller utility provider information for listing-side resale files, sent by TCs through one reusable link.** Keep this as the public front door. "Utility sheet" and "seller utility information form" are the terms buyers already search and pay for ([Etsy](https://www.etsy.com/listing/1393270358/real-estate-utility-information-sheet), [Creative Market](https://creativemarket.com/realtor-rebecca/7037883-Utility-Information-Sheet)), and the product already targets them in `lib/marketing-content.ts:1-13`.

### Natural expansion boundary

Expansion is on-strategy when **all four** tests hold:

1. The seller already knows the answer without research, and it is not a secret or legal representation.
2. The buyer side needs it at or shortly after closing.
3. It is captured once per transaction, not maintained over time.
4. It fits the same no-account, mobile, few-minutes seller flow and the same packet.

Inside the boundary:

- Home systems locations and service providers (already in Property Handoff Packet).
- An **access handoff plan** rather than raw codes (per the 2026-09-03 evidence, garage code fill was 8.3 percent).
- Trash and recycling specifics.
- Transaction-type variants of the same form, such as standard resale, vacant, and short-term-rental sale (Validate first, bet 8).
- Delivery of the packet to the buyer side.
- A small, evidence-driven set of named fields sourced from gap capture.

### Feature-creep boundary

Expansion becomes dilution when it:

- Requires an ongoing relationship with the property or homeowner (homeowner binders, maintenance reminders, STR operations).
- Requires legal representation or signatures (disclosures, e-signature).
- Requires coordinating parties other than seller-to-buyer-side handoff (tasks, deadlines, document compliance).
- Makes UtilitySheet the party that executes utility service changes or earns provider commissions.
- Makes the seller answer questions they must research or should not share.

### What to leave to established categories

| Category | Leave to it | Reason |
| --- | --- | --- |
| Transaction management (Open to Close, Dotloop, SkySlope, NormaTC) | Checklists, deadlines, documents, compliance, contract intake | Larger vendors with daily-use budget; NormaTC owns this in the suite |
| CRMs | Contacts, nurture, pipeline | No UtilitySheet-specific advantage |
| Form builders | Arbitrary questions | Custom labels degrade seller answers and PDF layout (2026-09-03 evaluation) |
| Disclosure platforms (Sellers Shield) | Seller legal disclosures | Liability, state-specific forms |
| Utility concierges | Setting up buyer service | Different business model; conflicts with neutrality |
| Home binders (HomeBinder, HomeHandoff) | Long-term homeowner records | Different buyer and data model |
| Norma Intake and Reports | Agent-side capture and weekly reporting | Suite boundary (`docs/product/norma-suite-intake-reports-strategy-2026-07-21.md`) |

---

## 7. Biggest weaknesses in the current product and business

Ranked by strategic consequence.

1. **Customer and revenue concentration.** [Verified, 2026-09-03] There were 9 Pro workspaces. 95 percent of advanced requests came from 2 accounts. [Inference] Losing one power account would materially change usage, revenue, and the loop's impression volume. Concentration is not tracked anywhere as a metric.
2. **Evidence infrastructure lags product infrastructure.**
   - [Verified] The experiment scoreboard stayed at its zero row (`docs/growth/experiment-log.md:31`).
   - [Verified] Client funnel events go to Vercel Analytics custom events (`lib/analytics/events.ts:3,285`), which are aggregate and not account-joinable.
   - [Verified] There is no cohort retention report, no free-limit-lock-to-upgrade measure, and no per-request packet view record.
   - [Inference] Most strategic questions are answerable from the database today, but nobody has a standing view of them.
3. **The "stop chasing" promise is only half automated.** [Verified] There are no scheduled seller reminders (C3). [Verified, 2026-09-03] 17.9 percent of Simple and 22.7 percent of Advanced requests did not reach submission. [Inference] The recovery of those files currently depends on TC effort, which is precisely the effort the product sells removal of.
4. **Price architecture signals low value and caps upside.** [Verified] Pro is $9/month unlimited. Teams is $7/seat, cheaper per person than Pro, with the 3-seat minimum ($21/month) barely above two Pro seats. There is no annual option. [Inference] A TC company paying $21/month has little financial commitment, and the product earns almost nothing from the heaviest users. [Hypothesis] Willingness to pay is higher for companies. This is unvalidated.
5. **Teams lacks company-level workflow** (C1). [Verified] Each member has their own link and packet defaults. [Inference] A company cannot enforce one seller form, and a departing coordinator's link, which is embedded in templates, is personal.
6. **The exposure loop is weakest where volume is highest.** [Verified]
   - The packet-page CTA renders only when "powered by" shows (`app/packet/[token]/page.tsx:705`), so paid white-label packets carry none.
   - The PDF footer is plain untracked text (`lib/pdf/packet-html.ts:655`).
   - [Inference] If TCs forward PDFs rather than links, the loop is largely unmeasured. Whether they do is unknown.
7. **Trust in provider accuracy is fragile and core.** [Verified] The July 24 to 29 incident produced generic or wrong suggestions and missing contacts, requiring repairs and credits (`docs/incidents/2026-07-provider-resolution-customer-communications.md`). [Inference] The packet is the TC's professional output, so an accuracy failure is a reputational failure for the customer.
8. **Unsubstantiated public numbers** (C2), plus a Team claim not implemented (C1).
9. **Founder capacity across four products.** [Verified] The suite strategy records a solo-maintainer bus factor. [Inference] Every recommendation here must be small, and the owner must choose.

---

## 8. Biggest untapped opportunities

1. **Automatic seller follow-up and a TC exception view.** Directly serves the core promise and the PRD's own MVP. Low complexity. (Build now)
2. **A measured baseline from data the product already stores.** Cohorts, concentration, lock-to-upgrade, loop conversion, and team behavior are computable without new tracking. (Build now, measurement)
3. **Buyer-side delivery.** A "send to buyer side" action with a tracked recipient view. It completes the job, gives proof of delivery, and creates identified professional exposure even for white-label accounts, since the recipient view can be tasteful without breaking branding. (Validate first)
4. **Company standard for TC companies.** Organization-owned seller form and defaults, with submissions routed to the assigned coordinator. This is the minimum team workflow and the most plausible route to higher willingness to pay. (Validate first)
5. **Pricing and packaging research.** Test the company plan, annual billing, and the per-seat anchor through conversations before any change. (Validate first)
6. **Founder-led TC-company pilots.** Recommended in July but not recorded as run. (Validate first)
7. **Named transaction-type forms.** Only if gap capture and conversations show TCs run distinct file types. (Validate first)
8. **Aggregated, privacy-safe provider confirmation data** to improve suggestion accuracy across accounts. (Later, with explicit privacy and accuracy design)

---

## 9. Ranked top-ten product and growth bets

### How to read the scores

- **Scale.** 1 to 5. Effort 5 means highest effort.
- **What confidence means.** Confidence is confidence that the bet produces its intended outcome, not confidence that the feature can be built.
- **Precision.** The numbers are ordinal judgments to force trade-offs, not measurements.
- **Ranking.** Rank weighs impact, confidence, and fit against effort, with a bias toward bets that also reduce uncertainty.

### Summary scores

| Rank | Bet | Impact | Confidence | Effort | Retention | Revenue | Fit | Classification |
| ---: | --- | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| 1 | Aggregate baseline: cohorts, concentration, lock-to-upgrade, loop funnel | 4 | 5 | 1 | 2 | 3 | 5 | Build now (measurement) |
| 2 | Customer and willingness-to-pay discovery with TC companies and power users | 5 | 4 | 1 | 3 | 4 | 5 | Validate first (research) |
| 3 | Automatic seller follow-up and TC exception list | 4 | 3 | 2 | 4 | 2 | 5 | Build now |
| 4 | Company standard: organization-owned seller form and defaults | 4 | 2 | 4 | 5 | 4 | 4 | Validate first |
| 5 | Buyer-side delivery with tracked recipient view | 4 | 2 | 3 | 3 | 2 | 4 | Validate first |
| 6 | Packaging and pricing test: company plan and annual billing | 4 | 2 | 2 | 2 | 5 | 4 | Validate first |
| 7 | Complete the closing-exposure loop measurement, including PDF | 3 | 3 | 1 | 1 | 2 | 5 | Build now (small) |
| 8 | Founder-led TC-company pilots | 4 | 3 | 2 | 3 | 4 | 5 | Validate first |
| 9 | Lifecycle messages timed to transaction rhythm | 3 | 3 | 2 | 2 | 2 | 5 | Build now (after bet 1) |
| 10 | Transaction-type seller forms (multiple profiles per workspace) | 3 | 2 | 4 | 3 | 3 | 4 | Validate first |

### Bet details

**1. Aggregate baseline from existing data** (Build now, measurement)

- **User problem.** The owner cannot see retention, concentration, or which motion produces paying customers, so every other bet is argued rather than decided.
- **Recommendation.** Run a documented set of read-only aggregate queries, with owner authorization, and record the results. Section 14 defines the metrics. No new tracking is needed for the first pass.
- **Supporting evidence.** [Verified] The data exists in `requests`, `accounts`, `organizations`, `organization_members`, `growth_attributions`, `growth_referral_events`, `referral_credits`, and `question_requests`. [Verified] The admin funnel already computes activation and habit (`lib/admin/activation-funnel.ts:148-223`). [Verified] The scoreboard was never filled.
- **Assumptions.** Timestamps (`metered_at`, `last_activity_at`) are reliable enough for cohorts. Demo exclusion is correct.
- **Smallest validation step.** Eight queries, aggregates only, one sitting.
- **Primary metric.** A dated baseline exists for every metric in section 14.
- **Major risk.** Small numbers invite over-interpretation. Mitigate by reporting counts, not only percentages.
- **Confidence basis (5).** The only uncertainty is data quality, not whether it is useful.

**2. Customer and willingness-to-pay discovery** (Validate first, research)

- **User problem.** Unknown who pays, why they stay, how the packet is delivered, and what a company would pay.
- **Recommendation.** 8 to 10 conversations with a fixed script:
  - the 2 power accounts;
  - 3 other paid accounts;
  - 2 or 3 Free accounts that hit the limit or stopped;
  - any Team account.
- **Supporting evidence.** [Verified] Testimonials point to owners. [Verified] Michelle Wright's message shows engaged paying customers respond.
- **Assumptions.** Customers will take a 20-minute call. The owner can run them.
- **Smallest validation step.** Five conversations in two weeks, using the questions in section 20.
- **Primary metric.** Clear answers on buyer role, company size, delivery channel (link vs PDF, to whom), stalled-seller handling, and price anchors, from at least 5 accounts.
- **Major risk.** Leading questions. Ask about past behavior, not future intent.
- **Confidence basis (4).** Conversations reliably resolve these qualitative questions; they do not prove price.

**3. Automatic seller follow-up and TC exception list** (Build now)

- **User problem.** Sellers stall, and the TC must notice and chase them. That is the job the product was hired to remove.
- **Recommendation.** Schedule one automatic reminder for per-request links with seller contact when the request is sent or opened but not submitted after about 48 hours. Add a second at about 5 days. Give TCs a workspace toggle and a per-request stop. Surface stalled files in the existing "needs attention" list. Log `reminder_sent` with an automatic source.
- **Supporting evidence.** [Verified] PRD MVP requirement (`PRD.md:128`). [Verified] Manual reminder route and seller email template exist (`app/api/requests/[id]/remind/route.ts`, `lib/email/email-service.ts:410`). [Verified] Cron infrastructure exists (`vercel.json`). [Verified, 2026-09-03] 18 to 23 percent of requests did not submit.
- **Assumptions.** A meaningful share of unsubmitted requests has a seller email or phone. Reusable-link starts may lack contact unless the seller used "save link" (`app/api/seller/[token]/send-link/route.ts`). Reminders will not irritate sellers or damage deliverability.
- **Smallest validation step.** Before building, count unsubmitted non-demo requests from the last 90 days by whether seller contact exists and by age. Then ship one reminder only.
- **Primary metric.** 7-day submission rate for eligible requests, versus the prior 90-day baseline. Guardrails: complaint and unsubscribe rate, and TC opt-out rate.
- **Major risk.** Low eligibility because most volume comes from reusable-link starts without contact, which would cap impact.
- **Confidence basis (3).** Reminders reliably lift completion in form workflows generally, but eligible volume is unknown.

**4. Company standard: organization-owned seller form** (Validate first)

- **User problem.** A TC company cannot make every coordinator use one seller form, packet configuration, and brand, and a departing coordinator's link is personal.
- **Recommendation.** Validate first. If validated, build an organization-owned reusable link and defaults. Route submissions to the assigned coordinator using existing notification routing. Support reassigning a request's owner. Fix the "Org-wide packet defaults" claim immediately regardless (copy change or implementation).
- **Supporting evidence.** [Verified] `intake_links UNIQUE(account_id)` and no org-scoped defaults. [Verified] Org-scoped branding and notification routing exist. [Verified] Owner testimonials.
- **Assumptions.** Power users are companies. Owners want enforcement, not flexibility.
- **Smallest validation step.** Ask the discovery-call companies how they handle new-coordinator setup and departures today. Separately, query how many organizations have 2 or more members with live submissions.
- **Primary metric.** Active members per paying organization; organization retention.
- **Major risk.** Schema and routing change touching the most sensitive public surface (seller links). The Michelle evaluation also noted `intake_links` is single-configuration by schema.
- **Confidence basis (2).** The mechanism is sound, but segment reality is unproven.

**5. Buyer-side delivery with tracked recipient view** (Validate first)

- **User problem.** After submission, the TC still forwards the sheet by hand and never knows whether the buyer side opened it.
- **Recommendation.** Validate first. If validated, add "Send to buyer side" from the request page:
  - recipient email or copyable tracked link;
  - a recipient view that respects white-label branding and carries a discreet "how this was collected" section;
  - a delivered/viewed status for the TC.
- **Supporting evidence.** [Verified] PRD Journey C, step 4 ("send packet link to buyer/title"), is unbuilt as a product action. [Verified] `/from-a-closing` and CTA counting exist.
- **Assumptions.** TCs send packets to buyer-side professionals, not only into a TMS. Recipients value a web view over a PDF.
- **Smallest validation step.** In discovery calls, ask exactly where the sheet goes and in what form. From data, compare 90-day CTA impressions to submitted packets as a rough proxy for recipient views.
- **Primary metric.** Share of submitted packets sent through the product; recipient view rate.
- **Major risk.** TCs deliver inside Dotloop or SkySlope and will not change. Recipient email adds deliverability and privacy obligations.
- **Confidence basis (2).** The delivery channel is unknown.

**6. Packaging and pricing test** (Validate first)

- **User problem.** Companies that would pay for a standard workflow have no offer. The heaviest users pay the least per file.
- **Recommendation.** Do not change live prices yet. Test a company offer and annual billing in conversations and on new signups only, after bets 2 and 4 clarify value.
- **Supporting evidence.** [Verified] Current prices and monthly-only billing. [Verified, public] Adjacent price points: HomeHandoff $69 per handoff; TC software $29 to $399/month.
- **Assumptions.** Company value exists (bet 4). Price increases do not break the loop. Keep Free generous.
- **Smallest validation step.** Price-anchor questions in discovery calls, then a written offer to 3 to 5 companies.
- **Primary metric.** Offers accepted at the tested price.
- **Major risk.** Existing-customer trust. Grandfather current customers.
- **Confidence basis (2).** Willingness to pay has no data.

**7. Complete loop measurement, including PDF** (Build now, small)

- **User problem.** Owner cannot tell whether completed sheets recruit customers.
- **Recommendation.** First read the existing 90-day referral funnel (`lib/admin/activation-funnel.ts:252-298`). Then make the PDF footer on powered-by PDFs a tracked link to `/from-a-closing` with the sender's ref, distinguishing PDF from web surface.
- **Supporting evidence.** [Verified] Plain text footer (`lib/pdf/packet-html.ts:655`). [Verified] CTA limited to powered-by web packets.
- **Assumptions.** Recipients click PDF links. The PDF system reference allows links.
- **Smallest validation step.** Read the funnel. Add the link to Free PDFs only.
- **Primary metric.** PDF and web CTA clicks per 100 submitted packets; referred first live submissions.
- **Major risk.** Low absolute numbers for months. Also PDF rendering constraints (`docs/pdf-system-reference.md` is authoritative).
- **Confidence basis (3).** Cheap and measurable, but yield is unknown.

**8. Founder-led TC-company pilots** (Validate first)

- **User problem.** No repeatable way to acquire the highest-value segment.
- **Recommendation.** Ten outreach messages to TC companies via existing customers' introductions and communities. Offer a guided 30-day team pilot. This was recommended in July but is not recorded as run.
- **Supporting evidence.** [Verified] `docs/growth/fable-independent-growth-review.md` Experiment D. [Verified] Team billing exists.
- **Assumptions.** Owners respond. Pilots convert.
- **Smallest validation step.** 10 outreaches, then at least 3 conversations, then at least 1 pilot with 2 or more members submitting live files within 45 days.
- **Primary metric.** Pilot organizations with 2 or more active members after 45 days.
- **Major risk.** Founder time.
- **Confidence basis (3).** The channel is plausible, and the decision rule is already written.

**9. Lifecycle messages timed to transaction rhythm** (Build now, after bet 1)

- **User problem.** New users sign up when no listing file is ready, and the reminders land within a day.
- **Recommendation.** Add day-3, day-10, and day-21 messages about "put the link on your next listing file", stopping at first live submission.
- **Supporting evidence.** [Verified] Only `after_15m` and `after_1d` stages exist (`schema.sql:289`). [Verified] Activation estimated at 10 to 30 of 120 signups.
- **Assumptions.** Later timing matches file arrival.
- **Smallest validation step.** Send the day-10 message manually to one cohort first.
- **Primary metric.** First live submission within 30 days, by cohort.
- **Major risk.** Requires a small schema check-constraint migration (authorization needed). Email fatigue.
- **Confidence basis (3).** The diagnosis is well reasoned; the effect is unmeasured.

**10. Transaction-type seller forms** (Validate first)

- **User problem.** A coordinator who runs standard and short-term-rental or vacant sales has one reusable form configuration.
- **Recommendation.** Wait for gap-capture data and a preset over existing fields. Build multiple profiles only if selection data shows real demand.
- **Supporting evidence.** [Verified] `UNIQUE(account_id)`. [Verified] One paying customer asked. [Verified] The 2026-09-03 evaluation ranks this as the top Later item.
- **Assumptions.** More than a handful of accounts run distinct file types.
- **Smallest validation step.** Review 60 days of `question_requests`, plus a preset selection-rate test.
- **Primary metric.** Accounts using 2 or more configurations monthly.
- **Major risk.** Schema change on seller links. Overlaps with bet 4, so design them together.
- **Confidence basis (2).** Current evidence is one customer.

### Considered and excluded from the top ten

- **Intake to UtilitySheet prefill.** Later. [Verified] The suite strategy reports Intake users inactive, including its paying subscriber.
- **Custom question builder.** Do not build. See section 17.
- **Cross-account provider data.** Later. See section 16.
- **Agent-segment marketing.** Later, triggered by data.
- **Request delete/archive (C8).** A small hygiene fix worth doing, but not strategic.

---

## 10. Retention strategy

### Why someone returns for transaction 2, 10, and 100

| Transaction | What brings them back | Current support | Gap |
| --- | --- | --- | --- |
| 2 | The first submission worked, and the next listing file arrives while UtilitySheet is still remembered | Completion email and PDF; test drive; 15-minute and 1-day emails [Verified] | Messaging ends before most second files arrive [Inference] |
| 10 | The link is embedded in the listing email or checklist, so use is automatic | Reusable link; message templates in Branding Profiles [Verified] | Nothing detects or encourages "link placed"; stalled sellers still need manual chasing [Verified] |
| 100 | The company's standard handoff: every coordinator, every file, the buyer side expects it | Teams billing, shared branding, notification routing [Verified] | No company-owned form, no reassignment, no delivery record [Verified] |

### Separating the retention forces

**1. Genuine recurring utility (the priority)**

[Inference] Value recurs when each file costs the TC less effort than the alternative. Strengthen it by removing the remaining effort:

- automatic seller follow-up (bet 3);
- fixing typos and misreads without reopening the seller form (already built for paid);
- one-step buyer-side delivery (bet 5).

Measure it as live submissions per active account-month and months-active per account.

**2. Stored data and switching costs (real but small, and should stay honest)**

[Verified] Submission history, Branding Profiles, message templates, and per-account provider memory accumulate. Account export exists (`app/api/account/export/route.ts`). [Inference] These are modest switching costs. The embedded link is the real one, since changing tools means editing every template. That is legitimate. Do not add export friction.

**3. Collaboration and team adoption (the durable force, if the segment is real)**

[Inference] Once a company's coordinators and its buyer-side counterparts expect the packet, leaving requires retraining people, not just changing a link. This depends on bet 4 and is unvalidated.

**4. Artificial friction to avoid**

- Holding submitted data hostage beyond the current fair lock.
- Blocking export.
- Expiring reusable links.
- Hiding the ability to cancel.
- Charging to remove branding from sheets that already went out.

[Verified] Current behavior avoids these. Keep it that way. The product's trust with TCs is part of the moat.

### Mechanisms evaluated

| Mechanism | Verdict | Reason |
| --- | --- | --- |
| Automatic seller reminders | **Build now** | Serves the core job; PRD requirement; low effort |
| Stalled-file exception list for TCs | **Build now, with reminders** | Makes remaining manual work visible; reuses "needs attention" |
| Company-owned form and defaults | **Validate first** | Strongest durable retention if companies are the buyer |
| Buyer-side delivery record | **Validate first** | Completes the job; channel unknown |
| Saved seller contacts / contact reuse | **Do not build** | Sellers are one-time participants; no repeat-seller pattern exists |
| Reusable property records across transactions | **Do not build** | The same property rarely returns to the same TC; stale data risk |
| Cross-account provider knowledge | **Later** | Accuracy benefit for everyone, but privacy and verification design required (section 16) |
| Templates | **Already exists** as message templates and module defaults | Improve placement guidance, not new template systems |
| Weekly summary email | **Do not prioritize** | Set-and-forget users gain little from a digest; the exception list is the useful subset |
| Transaction-management integrations | **Later** | No evidence of demand; link-paste works; high maintenance |
| Notifications beyond completion and stalls | **Do not build** | Noise |

---

## 11. Growth-loop strategy

A growth loop must have product-generated exposure, a reason for the exposed person to care, a conversion path, and a measurable reproduction rate. Community posting, SEO content, and partnerships are distribution channels, not loops. They are covered briefly at the end of this section.

### Loop A: Closing exposure (recommended, the primary loop)

1. **Initiating action.** A TC delivers a completed packet (web link or PDF) to the buyer side.
2. **Who is exposed.** Buyer's agent, buyer-side TC, and sometimes title/escrow staff.
3. **Why they care.** [Inference] They handle utilities for their own buyer now, and many also run listing files where they chase sellers themselves. The artifact is a working demonstration received at a moment of relevance.
4. **Conversion action.** Visit `/from-a-closing`, then create a free seller link (UTM plus `ref` preserved), then reach a first live submission.
5. **Incentive for the original user.** [Verified] A $9 account credit per referred activation, up to 12 per 365 days (`schema.sql:318`, `lib/neon/queries/referral-credits.ts:171-172`). [Inference] The stronger incentive is professional: the TC looks more organized than the other side. The credit rarely motivates a busy owner.
6. **Metric.** Referred first live submissions per 100 submitted packets, with this chain: CTA impressions, then clicks, then signups, then activations.

State of the loop:

- [Verified] Plumbing, counting, and a landing page exist.
- [Verified] PDF exposure is untracked, and paid white-label packets do not participate.
- [Hypothesis] Buyer-side professionals, not buyers, view packets. The July review named this as the key falsifier.

Next steps: bet 7 (measure and track the PDF), then bet 5 (designed delivery).

On white-label: [Inference] Do not force branding onto paid output. A recipient-facing "how this was collected" note that names the sending TC's brand first can respect white-label and still expose the method. Test whether paying TCs accept it before assuming.

### Loop B: Team expansion inside TC companies (recommended, secondary)

1. **Initiating action.** An owner or lead coordinator adopts UtilitySheet.
2. **Who is exposed.** The other coordinators in the company.
3. **Why they care.** One standard, less chasing, and the owner's expectation.
4. **Conversion action.** Invitation accepted, then the member's first live submission.
5. **Incentive for the original user.** Consistent output, shared branding, one bill, and visibility across files.
6. **Metric.** Active members per paying organization; seats paid versus seats active.

State: [Verified] Invitations and seat billing exist. [Verified] Company-standard workflow does not. [Hypothesis] Companies are the right expansion unit.

### Loop C: TC-to-TC referral credit (keep, do not expand yet)

1. **Initiating action.** A user copies the referral link from the referral card (`referral_credit_link_copied`).
2. **Who is exposed.** Peer TCs in groups, masterminds, and direct messages.
3. **Why they care.** Same pain.
4. **Conversion action.** Signup with `ref`, then first live submission.
5. **Incentive for the original user.** $9 credit; the referred account gets a first-time Pro trial (`lib/referrals/referral-trial.ts`).
6. **Metric.** Referred activations per 100 active paying accounts per quarter.

[Inference] This is an amplifier for advocacy that already exists, not an engine. The incentive is small relative to a TC's time. Do not raise the reward until bet 1 shows any referral activations at all.

### Exposure paths evaluated and rejected as loops

| Path | Verdict | Reason |
| --- | --- | --- |
| TC to agent exposure (agents see TC-branded forms and packets) | **Do not build as an acquisition loop** | [Inference] Converting a TC's clients into self-serve users undermines the customer's business, and TCs would rightly turn on white-label. Agents see value that benefits the TC; that is retention, not acquisition. |
| Agent to TC exposure | **Weak** | Agents who self-coordinate could introduce their TC, but no mechanism or evidence exists |
| Seller-facing experience | **Not a loop** | Sellers are homeowners with no recurring need. A seller-to-agent referral would be noise. |
| Shared public utility pages / address-based SEO pages | **Do not build** | Privacy (addresses tied to providers), accuracy liability, and low-quality programmatic content risk |
| Branded outputs | **Part of Loop A** | Only exposure to professionals matters |
| Brokerage adoption | **Later** | See section 12 |

### Distribution channels (not loops, still useful)

- **TC communities.** [Verified] Founder-reported as the strongest source. Keep one high-value post per week at most.
- **TC educators and courses** ([Transaction Coordinator Academy](https://www.transactioncoordinatoracademy.com/), [Elite TC Training](https://elitetctraining.com/)). Place the Utility Handoff Kit in course materials. It is slow but durable. Validate with one partner.
- **Templates and free tools.** The existing Handoff Kit and checklist page already cover this. [Hypothesis] A static template listing on Etsy reaching buyers with purchase intent is cheap to test.
- **Affiliate partnerships.** Do not build a program. At $9/month there is no margin for payouts.

---

## 12. Teams strategy

### Most plausible team buyer

**The owner of a TC company with roughly 2 to 10 coordinators.** [Hypothesis, supported by testimonials and power-user volume]

- Brokerages and large teams are not the plausible buyer now. They buy transaction platforms with compliance needs, where a utility step is a line item. [Inference]
- Agent-coordinator pairs are collaboration, not a buying unit. [Inference]

### Capability assessment

| Capability | UtilitySheet-specific problem? | Current state [Verified] | Verdict |
| --- | --- | --- | --- |
| Shared company seller form and defaults | Yes: standard output across coordinators; departure-proof links | Per-account link and defaults | **Validate first** (bet 4); fix C1 copy now |
| Submission routing to the assigned coordinator | Yes: the right person gets the completion | Notification routing exists | Extend with company link if built |
| Request ownership and reassignment | Yes, when a coordinator leaves or workload shifts | Workspace visibility exists; reassignment not found | **Validate first** with bet 4 |
| Shared branding | Yes | Org-scoped Branding Profiles | Done |
| Centralized billing and seats | Yes | Done, 3-seat minimum | Done |
| Shared provider knowledge within the company | Modest accuracy benefit | Provider memory requires the same `account_id` and workspace (`lib/neon/queries/provider-memory.ts:61-62`), so teammates do not benefit from each other's confirmed providers | **Later**: share within one organization; same-company data carries low privacy risk |
| Simple roles (admin, member) | Yes | Done | Done |
| Granular permissions, custom roles | No evidence | None | **Do not build** |
| Reporting dashboards | Weak: owners may want per-coordinator volume | None | **Later**: one simple count view if companies ask |
| Audit history for customers | Weak | Admin-only audit logs | **Do not build** for customers |
| SSO, SCIM, approval workflows, brokerage hierarchy | No | None | **Do not build** |

### Minimum viable team workflow

If validated, the minimum is:

1. The company owns one seller link and one default packet configuration and brand.
2. Each submission is attributed and routed to a coordinator.
3. Everyone in the workspace sees company files.
4. An admin can reassign a file and remove a member without breaking the link.

Everything else is optional.

### Primary strategy, later expansion, or pricing tier?

**Today, Teams is a pricing tier. It should become a primary strategy only after validation.** Company adoption would become the primary strategy if bets 1, 2, and 8 show that:

- the power accounts are companies, or organizations with 2 or more members submitting live files retain better than solo accounts;
- owners describe standardization as a problem they have;
- at least one pilot company reaches 2 or more active members.

If those hold, company adoption becomes the main revenue path (section 13). If not, keep Teams as a tier and focus on solo TC volume.

### What must be true before brokerage-level investment

- At least 10 paying TC companies with 3 or more active seats each, retained 6 months or more.
- Inbound brokerage requests, not founder-generated interest.
- A named brokerage willing to pilot on paid annual terms.
- A clear answer on who owns the seller link when an agent, TC, and brokerage all touch the file.

None is true today. [Verified that no evidence exists in the repository.]

---

## 13. Monetization recommendations

### Current model [Verified]

| Plan | Price | Gates | Upgrade trigger |
| --- | --- | --- | --- |
| Starter (Free) | $0 | 3 live files per calendar month per account; Simple mode only; "powered by" branding forced; no submitted-sheet editing | Over-limit submission saved but locked; unlocks on upgrade |
| Pro | $9/month, monthly only, single seat | Unlimited files, Property Handoff Packet, editing, branding and white-label, unlock | Volume, branding, packet mode |
| Teams | $7/seat/month, 3-seat minimum, monthly only | Everything in Pro plus workspace, invites, roles | Multiple people |
| Referral | $9 credit per referred activation, max 12/year; referred account first-time Pro trial | | |

### Answers to the monetization questions

- **Is Free an effective acquisition mechanism?** [Inference] Yes, for TCs: 3 files lets a working TC reach the aha on real files and hit the limit within a normal month. For agents with few listings, Free is effectively permanent, which is acceptable only if their packets expose the loop. [Verified] They do: "powered by" is forced.
- **Does Free reach the real aha?** [Inference] Yes. The first live submission is included, and the test drive does not consume quota.
- **Is the upgrade trigger obvious and connected to value?** [Inference] The lock is well connected. The seller's completed work is waiting. [Hypothesis] Upgrade copy at the lock moment is the highest-leverage paywall surface. The lock-to-upgrade conversion rate is not measured; add it in bet 1.
- **Are we charging for the right things?** Mostly.
  - Volume, white-label, editing, and extended packet mode are real value.
  - [Inference] One tension: white-label is what successful companies want, and it removes the loop. Keep it paid, and make the loop work through delivery (bet 5) instead of through forced branding.
- **Are sharing mechanics artificially restricted?** [Verified] No. Packet links and PDFs are available on Free, and forced branding increases exposure.
- **Confusing or awkward limits?**
  - [Verified] The limit counts per account, not per workspace (`lib/neon/queries/accounts.ts:257`), and resets on the calendar month.
  - [Verified] Requests cannot be deleted in the UI (C8), so a typo'd request can consume quota. The metering code intentionally soft-deletes metered requests so they still count (`lib/neon/queries/requests.ts:740-741`).
  - [Inference] Both are minor irritants for Free users. Consider not metering requests that never receive seller activity.
- **Would a different pricing metric better reflect value?** [Inference] Value scales with files. But a per-file charge adds anxiety to every send, and TCs pass costs to agents unevenly. [Hypothesis] The better structure is company plans with generous included volume, not per-file billing. ListedKit's per-intake model ([ListedKit](https://www.listedkit.com/best-tc-software)) shows per-transaction pricing is accepted for AI contract work, but that is not evidence for this job.
- **Is there room for a meaningfully higher-value offering?** [Hypothesis] Yes, if bets 4 and 5 validate. The offer would be a company plan including the company-owned form, transaction-type profiles, buyer-side delivery tracking, and priority provider verification. Test anchors in conversations only. Candidate anchors for a 3 to 5 coordinator company, to test and not to publish, are roughly $29 to $99/month.
- **Could Teams become a more important revenue source?** Only if company adoption validates. Today, $7/seat (below Pro's per-seat price) signals Teams as a discount, not an upgrade.
- **Does pricing match the buying motion?** Solo TC self-serve: yes. TC company: no. The company buying motion needs a company offer, annual billing, and possibly a founder-assisted pilot. None exists.

### Recommendations

| Recommendation | Classification |
| --- | --- |
| Correct the "Org-wide packet defaults" claim, or implement it, before selling Teams on it | **Build now** (copy fix is tiny) |
| Substantiate or remove "Nearly 86% of started UtilitySheets are completed" with a documented query and denominator | **Build now** |
| Measure lock-to-upgrade conversion, paid churn, and revenue concentration | **Build now** (bet 1) |
| Offer annual billing for Pro and Teams | **Validate first**: ask in discovery; low-risk to add once confirmed |
| Company plan with included company workflow | **Validate first** (bets 2, 4, 6) |
| Raise Pro or Team list prices | **Do not do yet**: no willingness-to-pay evidence; grandfather existing customers if ever changed |
| Per-file pricing | **Do not build** without contrary evidence |
| Increase referral reward or cash affiliate payouts | **Do not build**: no margin, no evidence the credit drives behavior |
| Revenue from buyer utility-setup concierge referrals | **Later, and cautious**: conflicts with neutrality and trust, and makes UtilitySheet a sales channel inside the TC's deliverable. Consider only as a TC-controlled, disclosed option after core metrics are healthy. |

---

## 14. Measurement and telemetry strategy

### What exists today [Verified]

| Layer | What it records | Account-joinable? | Source |
| --- | --- | --- | --- |
| Client analytics | About 60 typed events: landing, signup, onboarding, link copies, seller steps, packet actions, CTA views, test drive | **No**. Vercel Analytics custom events, aggregate only | `lib/analytics/events.ts:1-4,272-286` |
| Server request events (`event_logs`) | `request_created`, `seller_opened`, `suggestions_fetched`, `suggestions_search`, `seller_submitted` (redacted summary), `reminder_sent`, `seller_self_send_link`, `submitted_sheet_edited`, `test_drive_delivery_failed` | Yes, via request | grep of `app/api` and `lib`; `docs/ai-telemetry.md` |
| PDF events | Admin testimonial-candidate SQL counts `pdf_generated` and `pdf_downloaded`, but no current writer of those event types was found | Unclear | `lib/admin/testimonial-candidates.ts:320` |
| Request state | Status, `metered_at`, lock state, packet mode, modules, exclusions, demo flag, timestamps | Yes | `schema.sql:112-143` |
| Activation reporting | Accounts, dashboard-ready, onboarding, first request, first live submission, habitual (3+ in 30 days), paid, last-7-day activations | Yes (admin UI) | `lib/admin/activation-funnel.ts:148-223` |
| Acquisition | First-touch UTM and `ref` per account; 90-day signups and activations by source | Yes | `schema.sql:297-312`, `lib/admin/activation-funnel.ts:225-250` |
| Loop | CTA impressions and clicks (surface, ref code), referred signups and activations over 90 days | Partly (events are not tied to accounts, by design) | `schema.sql:325-333`, `lib/admin/activation-funnel.ts:252-298` |
| AI quality | Runs, items, sources, failures, latency, locality, seller selection | Yes | `docs/ai-telemetry.md` |
| Billing | Subscription status on account and organization; referral credits ledger | Yes; history lives in Stripe | `schema.sql:8-41,314-323` |
| Demand | `question_requests` free text, scoped to workspace | Yes | `schema.sql:160-170` |

### What it can and cannot answer

| Question | Answerable now? | How, or what is missing |
| --- | --- | --- |
| What features are used? | **Partly** | Server: packet mode, modules, editing, reminders, self-send. Client-only (aggregate): link copies, previews, packet actions. No per-account feature usage for client events. |
| How many users activate? | **Yes** | Admin funnel (all-time first live submission). A time-bounded definition is missing. |
| How many reach a 2nd, 10th, 100th transaction? | **Yes, by ad hoc SQL** | `requests` per account with demo exclusion. Not reported. |
| Time to value | **Yes, by ad hoc SQL** | `accounts.created_at` to first live submitted request |
| Where creators abandon setup | **Partly** | Onboarding, defaults, and first request are known. "Link placed in a template" is unobservable. Seller-link starts appear only as requests. |
| Where sellers abandon | **Coarse** | Last server event per request (opened, suggestions fetched). Step-level data is client-only and aggregate. |
| Which users or organizations return | **Yes, by ad hoc SQL** | Account-month or organization-month activity from requests |
| Paid vs free differences | **Yes, by ad hoc SQL** | Subscription status joined to usage. History of plan changes is only in Stripe. |
| Which sources produce activated or paying users | **Activated yes (90 days); paying partly** | Attribution joined to current subscription status; no plan-change timestamps |
| Do shared outputs or referrals create accounts? | **Web packet: yes. PDF and email: no.** | Untracked PDF footer; no per-request recipient view record |
| Team vs individual behavior | **Yes, by ad hoc SQL** | `organization_members` count joined to activity |
| Lock-to-upgrade conversion | **Approximately** | `locked_at` exists; unlock or upgrade time is not recorded directly |

### Recommended framework

**North-star metric.** Completed live seller handoffs per week (submitted, non-demo, non-deleted requests).

- Why: it grows only if customers are acquired, activated, retained, and sellers actually complete.
- Guardrail: seller completion rate for requests with seller activity.
- Companion count: **active accounts**, meaning accounts with at least 1 live submission in the trailing 30 days.

**Activation definition.** First live seller submission within 30 days of signup. The existing all-time definition should remain for continuity, but decisions should use the bounded one.

**Retention definition and cohorts.**

- **Active account-month:** at least 1 live submission in the calendar month.
- Cohort by the month of first live submission, not signup, so timing luck does not distort retention.
- Report M1, M3, and M6 account retention, plus **volume retention** (submissions in month N divided by month 1).
- Split cohorts by plan at month N, by acquisition source, and by organization size (1 member vs 2 or more).
- Report the same metrics at the organization level.

**Key funnel stages.**

1. Signup
2. Link ready and copied (client) / onboarding completed (server)
3. First request exists (reusable start or manual)
4. Seller opened
5. Seller submitted (activation)
6. Second live submission
7. 3 or more in 30 days (habitual)
8. Paid

**Monetization metrics.**

- Accounts hitting the Free limit per month.
- Locked submissions per month.
- Lock-to-paid conversion within 7 and 30 days.
- New paid accounts and paid churn per month.
- Revenue and submission concentration (share from the top 2 and top 5 accounts).
- Team seats paid vs seats with a live submission in 30 days.

**Growth-loop metrics.**

- Loop A: submitted packets; CTA impressions and clicks by surface (web, PDF); referred signups; referred activations within 30 days; referred activations per 100 submitted packets.
- Loop B: invites sent, accepted, and members with a first live submission.
- Loop C: referral link copies (client); referred activations; credits earned.

**Team-adoption metrics.**

- Organizations with 2 or more members submitting live files.
- Active members per organization.
- Organization M3 retention vs solo accounts.

### Essential new events or properties (small set)

| Addition | Why | Privacy note |
| --- | --- | --- |
| `request_source` on request creation (`reusable_link`, `manual`, `test_drive`) | Distinguishes the reusable-link workflow from manual requests; needed for reminder eligibility | No personal data |
| Server `packet_viewed` event (surface `web`, viewer `owner_session` or `anonymous`), counted, not per-viewer | Answers whether packets reach anyone beyond the owner | No IP or user agent stored; follow `docs/ai-telemetry.md` |
| Server `pdf_downloaded` event, or fix the orphaned admin count | Admin SQL already expects it | Counts only |
| `plan_changed` (from, to, at) on the account or organization | Enables source-to-paid and lock-to-upgrade analysis without Stripe exports | No payment details |
| `reminder_sent.source` (`manual`, `automatic`) | Required to evaluate bet 3 | None |
| `surface` values `packet_pdf` and `from_a_closing` in `growth_referral_events` | Separates PDF from web exposure | Existing constraints apply |

### Events that would create noise

- More landing-page section and scroll events.
- Per-toggle configuration events beyond what exists.
- Per-keystroke or per-field seller events.
- Session replay on seller or packet pages. That would be a privacy liability and must not happen.
- Any event carrying addresses, provider names tied to addresses, seller identity, meter numbers, access codes, or Property Handoff Packet answers. This is prohibited by `docs/ai-telemetry.md`.
- Duplicating server facts in Vercel Analytics.

### Governance

- Keep decisions on database-derived metrics, per the July review's point that Vercel Analytics is the wrong tool for funnel decisions.
- Record baseline numbers with dates in a repository document each quarter.
- Public numeric claims (C2) must cite a saved query.

---

## 15. Recommended positioning and value proposition

### Category options assessed

| Option | User value | Clarity | Search | Differentiation | Expansion | Can UtilitySheet own it? | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Utility sheet generator | Low: implies a template | High | High (template buyers) | Low: Canva does this | Low | Yes, but it is a cheap category | Use as search entry, not identity |
| Transaction coordinator utility workflow | High for TCs | Medium | Low | Medium | Medium | Plausible | Useful audience framing |
| **Seller utility-information collection** | High | High | Medium ("seller utility information form") | High: seller does the work | Medium | Yes | **Core category** |
| Property utility-information platform | Vague | Low | Low | Low | High on paper | No: implies data coverage and accuracy the product does not have | Reject |
| "Property handoff" software | High | Medium | Low; contested by HomeHandoff and binders | Medium | High | Not yet | Use as the paid-mode name only |

### One-sentence strategic positioning

**UtilitySheet is the seller handoff link transaction coordinators send on every listing: the seller confirms utilities and property details on their phone, and the coordinator gets a finished, branded packet without chasing anyone.**

### Concise value proposition

**Send one link. Stop chasing sellers. Get a buyer-ready utility and property handoff packet back.** [Consistent with the current homepage hero, which is already strong.]

### Positioning components

- **Primary audience.** Transaction coordinators and TC companies handling listing-side files. Listing admins and self-coordinating agents are welcome but not the headline.
- **Problem category.** Collecting seller utility and property information for closing.
- **Strongest reason to choose UtilitySheet.** The seller actually completes it. The guided mobile flow with suggested providers replaces the blank form nobody returns, and the output is already formatted in the coordinator's brand.

### Claims to avoid until validated

- "Nearly 86% completed", until the query and denominator are documented (C2).
- "Org-wide packet defaults", until implemented (C1).
- Any implication of integration with Dotloop, SkySlope, or Brokermint beyond "paste your link" (`components/landing/TrustStrip.tsx:24` is borderline; "Use your link inside..." is safer).
- Provider or contact **accuracy** guarantees, or "verified" contacts, especially after the July incident.
- Time-saved or hours-saved figures. None are measured.
- "Platform", "system of record", or "utility database" language.
- Security claims about access codes. Packet links are permanent bearer links without revocation (`docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` section 6).
- Customer counts, company counts, or "trusted by teams" phrasing beyond approved testimonials (`docs/growth/customer-proof-library.md` use rules).

---

## 16. Realistic competitive-moat analysis

### Defensibility realistic for a small niche SaaS

1. **Workflow embedding.** [Inference, strong] The link lives in templates and checklists, so replacing it is a chore. It is already the main retention force.
2. **Company adoption.** [Hypothesis] A company standard across coordinators, and buyer-side counterparts who expect the packet, create organizational switching cost.
3. **Seller-flow quality proven by data.** [Verified foundation] Curated prompts, completion rates, and fill-rate evidence are copyable in principle. In practice, a competitor that treats this as a side feature will not tune it.
4. **Provider suggestion and contact quality, measured over time.** [Verified foundation] Redacted AI telemetry, selection correlation, and contact caching exist. [Inference] This becomes an advantage only if accuracy is measured and published internally, and incidents stay rare.
5. **Reputation in TC communities.** [Verified] Named testimonials, founder presence, and the Handoff Kit. It is small, but it is how this market buys.

### Valuable but easily copied

- The mobile form, PDF output, and branding.
- AI provider suggestions. Any vendor can call a model with grounding.
- Reusable link concept, test drive, and templates.
- Transaction-management vendors or HomeHandoff adding a utility section. [Verified] HomeHandoff already collects utilities ([home-handoff.com](https://home-handoff.com/)).

### Theoretically attractive but unrealistic

- **Network effects.** There is no multi-sided value that increases per added user beyond Loop A exposure.
- **Proprietary national utility database.** Service-territory data is public in many places and messy everywhere. Achieving and maintaining coverage and accuracy is an operations business, not a side benefit.
- **Integration moat.** Integrations are table stakes when they exist and are maintained at the platform vendor's discretion.

### Data strategies that create privacy, accuracy, or operational risk

| Strategy | Risk | Verdict |
| --- | --- | --- |
| Pooling seller-confirmed providers across all customers to improve suggestions | [Inference] Real accuracy upside. Seller-provided data from one customer would shape another's suggestions: consent, terms, and poisoning risk. The July incident shows how plausible-but-wrong answers propagate. | **Later**: only as aggregated locality-level provider signals (state/ZIP3/city, per `docs/ai-telemetry.md` rules), with a minimum count threshold, no addresses, terms reviewed, and a measured accuracy gain |
| Public address-level "utilities for this address" pages for SEO | Exposes property-to-provider data; stale and wrong pages carry the brand | **Do not build** |
| Storing access codes and credentials broadly | Permanent bearer links, no revocation (verified in the 2026-09-03 evaluation) | **Do not build** beyond the existing accepted decision; prefer "how access will transfer" |
| Selling or sharing provider lists with utility concierges or providers | Breaks neutrality and customer trust; possible terms and privacy issues | **Do not build** |

---

## 17. Features and directions not to build

These are candid, specific calls. Each names the failure it would cause.

| Direction | Why not | Failure mode |
| --- | --- | --- |
| **Custom question builder** | [Verified, 2026-09-03] Notes fields are nearly unused (6 non-empty answers). Customer-authored labels break curated seller prompts and fixed-layout PDFs (`docs/pdf-system-reference.md`). Gap capture exists to prove otherwise first. | Dilutes product; lowers answer quality; PDF support burden |
| **Conditional or branching seller questions** | Moves a configuration-time decision onto the unpaid seller; each branch taxes completion | Weakens the core asset (completion) |
| **Tasks, deadlines, checklists, document storage, e-signature** | That is transaction management: Open to Close, Dotloop, SkySlope, and NormaTC in the suite | Competing with much larger vendors; category dilution |
| **Agent CRM, contact nurture, "stay in touch with past clients"** | No UtilitySheet-specific advantage | Generic CRM |
| **Homeowner binder, maintenance reminders, warranty tracking** | Different buyer, ongoing data model, and competitors that are free to agents via inspectors ([HomeBinder](https://pages.homebinder.com/real-estate-agents)) | Weak retention for TCs; distraction |
| **Short-term-rental operations** (rotating codes, cleaner handoffs) | Different product and buyer; the 2026-09-03 evaluation already recommended declining it | Security and support burden; wrong data model |
| **Executing utility transfers or becoming a utility concierge** | Operations-heavy and funded by provider fees; conflicts with neutrality inside the TC's branded deliverable | Operational capability the company does not have; trust risk |
| **Bill uploads, OCR, meter reading from photos** | PRD non-goal; raises seller effort and sensitive-data handling | Privacy risk; completion loss |
| **Collecting live access credentials as a growth feature** | 8.3 percent garage-code fill rate; permanent non-revocable packet links | Security incident risk with little value delivered |
| **Public address-level utility pages or a public utility lookup database** | Privacy exposure, accuracy liability, and thin programmatic content | Brand damage when wrong; possible search penalties |
| **Seller disclosure forms** | Legal, state-specific, and occupied by free players such as Sellers Shield | Regulatory and liability risk |
| **Brokerage enterprise features** (SSO, SCIM, custom roles, compliance reporting) | No brokerage demand in evidence; section 12 gates it | Enterprise complexity for no revenue |
| **Broad paid acquisition or an agent-first repositioning** | Agents rarely exceed Free; TC clients should not be told they can skip their TC | Spend without paying customers; harms the TC channel |
| **Deep TMS integrations before demand** | Link-paste already fits TMS workflows; integrations carry permanent maintenance | Support burden with no measured retention gain |
| **A generic AI assistant or chat inside the dashboard** | No job requires it; AI already sits where it helps (suggestions) | Cost and distraction |
| **Suite-driven UtilitySheet changes that touch login, domain, billing, or seller URLs** | The suite strategy explicitly protects UtilitySheet revenue and users | Risk to the suite's only broadly active product |

---

## 18. Six-month product vision (September 2026 to March 2027)

**By March 2027, UtilitySheet should be a measured, largely self-running seller handoff workflow that a TC company can standardize on, with evidence either confirming or rejecting the company-buyer thesis.**

This assumes owner capacity for roughly two small implementation slices plus founder research. Specific targets should be set after the section 14 baseline exists, not before.

### Months 1 to 2: Know, then act

- Record the aggregate baseline (bet 1) and fix the two public-claim contradictions (C1, C2).
- Hold 8 to 10 customer conversations (bet 2). Start 10 TC-company outreaches (bet 8).
- Ship automatic seller follow-up with a TC exception view (bet 3), under its own plan and authorization.
- Add the tracked PDF footer and read the loop funnel (bet 7).

### Months 3 to 4: Decide on the company thesis

- **If validated:** design the company-owned seller form, routing, and reassignment together with transaction-type profiles (bets 4 and 10 share the `intake_links` redesign). Draft a company offer and annual billing (bet 6).
- **If not validated:** keep Teams as a tier. Put effort into activation timing (bet 9) and solo-TC acquisition through communities and educators.
- Validate buyer-side delivery from conversation and packet-view evidence (bet 5).

### Months 5 to 6: Complete the loop

- Build the one validated structural feature (company form or buyer-side delivery, not both at once).
- Put a written company offer to 3 to 5 companies.
- Review the north star, retention cohorts, and loop yield. Stop whichever motion produced the fewest activated accounts per founder hour.

### Explicitly not in the six months

Custom questions, branching, integrations, brokerage features, concierge revenue, cross-account provider pooling, and public price changes for existing customers.

---

## 19. Realistic two-to-three-year evolution

These are scenarios with triggers, not forecasts. There is no revenue or retention data behind any projection, so no targets are asserted.

### Scenario A: company thesis validated (the upside worth building toward)

UtilitySheet becomes the default seller handoff step for independent US TC companies.

- The paid core is a company plan: company-owned forms per transaction type, coordinator routing, buyer-side delivery with view status, and annual billing.
- Solo Pro remains the entry product, and Free remains the loop carrier.
- Provider accuracy improves through measured, aggregated locality signals under an explicit privacy design.
- One-way handoffs appear where evidence supports them: a prefill entry point from Norma Intake or a TMS link, never two-way sync.
- [Inference] Illustrative arithmetic only: a few hundred paying TC companies at a company price materially above today's $21/month minimum would make UtilitySheet a real small business. Whether the reachable number is dozens or hundreds is unknown. Dedicated TC headcount is not reliably published; the ListedKit guide cited in July provides pay data but no headcount.

### Scenario B: company thesis rejected, solo usage retains well

UtilitySheet stays a focused, inexpensive tool for solo TCs.

- Growth comes from communities, educators, and Loop A.
- Revenue grows slowly with account count.
- Investment stays in reliability, completion, and activation timing.
- In the suite, it serves as a trusted entry product whose customers may later adopt NormaTC.

### Scenario C: retention weak outside a few power users

- Protect the power users, minimize maintenance, and stop feature investment.
- Treat UtilitySheet primarily as suite acquisition and reputation.
- The trigger is concentration staying above roughly 80 percent of submissions in 2 to 3 accounts after two quarters of acquisition effort. [Inference: a judgment threshold]

### Across all scenarios

UtilitySheet should not become a transaction platform, homeowner binder, concierge, or form builder. Its credibility comes from being narrow.

---

## 20. The three highest-priority next actions

### Action 1: Record the aggregate business baseline

- **Type.** Measurement.
- **Intended outcome.** A dated, reproducible picture of retention, concentration, monetization, and loop yield.
- **Why it comes next.** Every expensive decision in this report (company plan, buyer-side delivery, pricing) depends on numbers that the database already holds but no one has recorded. It costs hours, not weeks.
- **Evidence needed.** These metrics, aggregate counts only, no row-level customer data:
  - active accounts and organizations by month for the last 12 months;
  - M1/M3/M6 cohorts by first live submission month;
  - share of submissions from the top 2 and top 5 accounts;
  - organizations with 2 or more members submitting;
  - Free accounts hitting the limit and locked submissions per month;
  - current paid counts by plan;
  - 90-day loop funnel (impressions, clicks, referred signups, activations);
  - submit rate by `request_source` proxy (reusable-link starts vs manual);
  - unsubmitted requests by seller-contact availability and age.
- **Smallest useful action.** With explicit owner authorization for read-only aggregate queries, run a saved query set once and record results in a dated addendum to this audit. Do not copy customer names, emails, or addresses.
- **Success metric.** Every section 14 baseline metric has a dated value, or a recorded reason it cannot be computed.
- **Decision unlocked.**
  - Is retention or acquisition the binding constraint?
  - Is the company segment visible in behavior?
  - How many requests are eligible for automatic reminders (sizing Action 3)?
  - Does the closing-exposure loop produce any activations?

### Action 2: Run customer and willingness-to-pay discovery

- **Type.** Research.
- **Intended outcome.** Know who buys, why they stay, where the packet goes, and what a company would pay.
- **Why it comes next.** The company-buyer thesis, the delivery-channel question, and pricing cannot be answered from data. Conversations are the fastest reliable method and cost no engineering.
- **Evidence needed.** Five to ten conversations. Include both power accounts, other paid accounts, Free accounts that hit the limit or stopped, and any Team account. Ask about past behavior:
  1. "Walk me through the last listing file where you used UtilitySheet. Where does the link live?"
  2. "Who is on your team, and does everyone use it the same way?"
  3. "After the sheet comes back, exactly where does it go, as a link or a PDF, and to whom?"
  4. "What happens when a seller does not fill it out?"
  5. "Who pays for your software, and what else do you pay for monthly?"
  6. "If this disappeared tomorrow, what would you go back to, and what would that cost you?"
  7. For companies, price anchors: "Would a company plan with one shared form, routing, and delivery tracking at $X per month be a yes, a maybe, or a no?" Test two or three anchors across calls.
- **Smallest useful action.** Email the two power accounts and three other paid accounts this week, asking for 20 minutes. Record anonymized findings in `docs/product-feedback/`.
- **Success metric.** At least 5 completed conversations, with clear answers on buyer role, company size, delivery channel, and stalled-seller handling. At least 3 companies respond to a price anchor.
- **Decision unlocked.**
  - Whether to fund the company-owned form (bet 4) or buyer-side delivery (bet 5).
  - Whether to draft a company offer and annual billing (bet 6).
  - Whether solo TCs or companies define the roadmap.

### Action 3: Ship automatic seller follow-up

- **Type.** Implementation, preceded by a small measurement check. It needs its own implementation plan and owner authorization.
- **Intended outcome.** More requests complete without the TC chasing, which closes the most visible gap between the product's promise and its behavior.
- **Why it comes next.** It is a PRD MVP requirement that was never built, and it serves every segment regardless of how Actions 1 and 2 resolve. Its building blocks already exist: seller reminder email, manual remind route with cooldown, `reminder_sent` events, and cron infrastructure. It is small and reversible.
- **Evidence needed.**
  - From Action 1: the count of unsubmitted non-demo requests with seller email or phone, by age.
  - The 90-day 7-day-submission baseline.
- **Smallest useful action.**
  - One automatic reminder about 48 hours after a request is sent or opened but not submitted, only where seller contact exists.
  - A workspace-level toggle (default on for new workspaces after owner review) and a per-request stop.
  - Respect the existing reminder cooldown. Log `reminder_sent` with `source = automatic`.
  - Surface stalled files in the existing "needs attention" list.
  - Evaluate before adding a second reminder.
- **Success metric.** 7-day submission rate for eligible requests rises versus the pre-launch baseline. Set the threshold after Action 1; at current volumes, require at least 50 eligible requests before judging. Guardrails: seller complaint or unsubscribe rate, and TC opt-out rate.
- **Decision unlocked.** Whether to add a second automatic reminder and a TC stalled-file digest, and whether reminder eligibility justifies collecting seller contact earlier in the reusable-link flow.

---

## 21. Important unanswered questions and evidence gaps

| # | Question | Why it matters | Fastest reliable way to answer |
| --- | --- | --- | --- |
| 1 | Are the two power accounts TC companies or solo coordinators? | Decides whether companies are the ICP | Action 2 conversations plus organization membership query |
| 2 | What are current paid counts by plan, MRR, and paid churn? | No revenue or churn data is in the repository | Action 1 (database plus Stripe dashboard, aggregates only) |
| 3 | What is account and organization retention by cohort? | Retention is asserted from testimonials and two accounts, not measured | Action 1 |
| 4 | Do packets reach buyer-side professionals, and as links or PDFs? | Determines Loop A's reality and bet 5 | Action 2, then `packet_viewed` and PDF-link tracking (bet 7) |
| 5 | Does the closing-exposure loop produce any activated accounts? | The primary loop may be near zero | Action 1: read the existing 90-day funnel |
| 6 | What fraction of unsubmitted requests have seller contact? | Caps reminder impact | Action 1 |
| 7 | What would TC companies pay, and for what? | No willingness-to-pay evidence exists | Action 2 price anchors, then written offers to 3 to 5 companies |
| 8 | How does lock-to-upgrade conversion perform? | It is the main monetization moment | Action 1 (approximate), then a `plan_changed` record |
| 9 | Where does the "Nearly 86%" figure come from? | Public claim without a reproducible source | Locate or recreate the query; otherwise remove the claim |
| 10 | How accurate are provider suggestions after the July fixes? | Accuracy is the product's trust base | Existing AI telemetry: acceptance rate, free-text rate, and later dashboard edits by category (`docs/ai-telemetry.md` queries) |
| 11 | Do customers run distinct transaction types (such as short-term-rental sales)? | Decides form profiles | 60 days of `question_requests` plus preset selection test |
| 12 | How large is the reachable TC-company market? | Bounds the upside | No reliable public headcount found. Use community membership counts and educator cohort sizes as rough proxies. Treat as unknown. |
| 13 | Are signups from TC communities qualified practitioners or curious non-TCs? | Explains the signup-to-activation gap | Action 1 source-to-activation data, plus a one-question role field (Validate first) |
| 14 | Is the demo's handling of non-address input hurting conversion? | Screenshot evidence only | Browser check with invalid input, then measure demo-to-signup in Vercel Analytics |

### Stated plainly

This audit could not measure retention, conversion, willingness to pay, revenue, or market size. Its strongest conclusions are about product structure and contradictions, which are verified in code. Its strategic direction (company standard, delivery, automated follow-up) is well-reasoned but depends on Actions 1 and 2. If those show that power users are solo TCs, and that packets stay inside transaction-management systems, the company and delivery bets should be dropped. Effort would then go to activation timing and solo-TC acquisition.
