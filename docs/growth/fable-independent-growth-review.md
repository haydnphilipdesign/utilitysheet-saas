# UtilitySheet Independent Growth Review

**Author:** Claude (Fable 5), independent review conducted inside this repository
**Date:** July 15, 2026
**Status:** For founder decision. No product code was modified during this review.

**Method note:** Phases were run in order: (1) product and repo investigation before reading any growth strategy documents, (2) external market research, (3) reading and challenging the existing strategy, (4) this report. Claims are labeled **[Fact]** (verified in repo, on the live site, or in a cited source), **[Assumption]** (reasonable belief, not verified), or **[Hypothesis]** (testable claim).

---

## 1. Diagnosis: the current growth constraint

UtilitySheet's constraint is not product quality, positioning, or price. It is that **activation depends on an event the new user does not fully control: a real seller submitting a form on a live file.**

The chain of evidence:

- **[Fact]** The product is genuinely differentiated. External search for "utility information form software real estate" surfaces only static substitutes: [pdfFiller fillable sheets](https://seller-utility-information-sheet.pdffiller.com/), [Etsy Canva templates](https://www.etsy.com/listing/1672742266/utility-sheet-real-estate-utilities-list), [DocHub forms](https://www.dochub.com/fillable-form/53060-real-estate-utility-information-sheet). No direct SaaS competitor appeared, and utilitysheet.com already ranks in those results.
- **[Fact]** Retention after activation is strong. Three named TC-company owners describe replacing Dotloop/DocuSign blank forms, email chases, and provider spreadsheets ([components/landing/SocialProofBar.tsx:33-60](../../components/landing/SocialProofBar.tsx)), and several paying accounts use it multiple times to dozens of times per week (founder-reported baseline in [docs/growth/experiment-log.md](experiment-log.md)).
- **[Fact]** The top of the funnel exists but leaks: roughly 120 auth signups by May 4, 2026 against an estimated 10 to 30 accounts ever used on a real transaction (experiment log baseline; `users_sync.csv` contains 119 data rows). That is an all-time signup-to-real-use rate of roughly 10 to 25 percent. **[Assumption]** on the exact rate, since "used on a real transaction" is an estimate.
- **[Fact]** Onboarding already lands the user on their reusable link within seconds ([app/onboarding/page.tsx](../../app/onboarding/page.tsx), [app/dashboard/page.tsx](../../app/dashboard/page.tsx) first-run card). Copying a link is easy. What the funnel cannot manufacture is a listing-side file at the utility step in the days after signup.
- **[Fact]** The automated re-engagement runs at 15 minutes and 1 day after signup ([lib/email/email-service.ts:1387-1404](../../lib/email/email-service.ts), [app/api/cron/activation-reengagement/route.ts](../../app/api/cron/activation-reengagement/route.ts)). **[Hypothesis]** Both messages fire before most TCs have a live file that needs utilities, so the current lifecycle window is misaligned with transaction rhythm, not merely under-messaged.

So the constraint, stated precisely: **too few new signups reach a first real seller submission, because the product's "aha" is gated on transaction timing, and the loop that should recruit the next TC (exposure across a closing) is present but under-built and unmeasured.**

## 2. Independent growth thesis

**The job customers hire UtilitySheet for** is not "collect utility info." It is two jobs at once:

1. **Stop being human middleware.** Remove one recurring chase-and-cleanup loop from every listing file (the pain every testimonial describes).
2. **Look premium to the agents who hire them.** The branded, buyer-ready sheet is a service-quality artifact. Agatha Aquilia's quote says it directly: "the completed branded PDF helps level up my TC company's service" ([SocialProofBar.tsx:47](../../components/landing/SocialProofBar.tsx)). Independent TCs win business by looking more professional than the next TC; the deliverable is marketing for *their* business.

**Why high-frequency users retain:** once the reusable link is pasted into the TC's templated listing email or checklist task, usage recurs automatically with every file at near-zero marginal effort. Retention is template embedding, not habit formation. This is why activation (first real submission, which proves the template placement works) predicts everything downstream.

**The structural growth asset nobody else has:** every completed UtilitySheet is *seen by other transaction professionals with a guaranteed, timely need*: the co-op TC, buyer's agent, listing agent, title/escrow. The business context confirms "the other side of a closing" is already one of two proven acquisition sources, with zero deliberate engineering behind it today. A power user producing dozens of sheets a week is producing dozens of perfectly targeted impressions a week. No Facebook post can match that targeting.

**Therefore my thesis:**

> UtilitySheet should grow by (a) collapsing time-to-first-submission so activation stops depending on transaction luck, and (b) engineering and measuring the closing-exposure loop so that every activated account mechanically recruits the next one. Founder hours should concentrate on the one audience segment where a single win multiplies: TC company owners, who bring seats, volume, and the packets that power the loop. Community posting and partnerships are support acts, not the engine.

The existing strategy and I agree on the destination (activated accounts, not registrations). We differ on emphasis: the existing plan spends most founder time on community content and manual outreach, while I believe the two highest-leverage moves are product changes that this repository can ship this week.

## 3. What the market investigation found

- **[Fact]** The dedicated TC population is small but real: roughly 6,000+ payroll transaction coordinators in the US per [ListedKit's 2026 salary guide](https://www.listedkit.com/resources/transaction-coordinator-salary-guide-2026); independents charge $300 to $600 per closed file ([AgentUp pricing guide](https://www.agentup.com/blog/real-estate-transaction-coordinator-pricing)). **[Assumption]** Payroll data undercounts independent solo TCs; the reachable TC universe (independents, TC-company staff, team admins) is plausibly 15,000 to 40,000 people. That supports 1,000+ activated accounts but "thousands of users" requires the adjacent audience.
- **[Fact]** The adjacent audience is enormous: US existing-home sales run at a ~4.1M annual rate as of June 2026 ([NAR via Yahoo Finance](https://finance.yahoo.com/real-estate/articles/u-existing-home-sales-fall-141636457.html)), and every listing-side closing has this utility handoff. Listing agents and team admins already appear as a secondary persona in the repo ([app/(marketing)/utility-sheet-for-real-estate-agents](../../app/(marketing)/utility-sheet-for-real-estate-agents)).
- **[Fact]** The ecosystem is dense and reachable: Facebook groups ([Transaction Coordinator Collective](https://www.facebook.com/groups/TransactionCoordinatorCollective/), [Transaction Coordinators and Admins for Real Estate](https://www.facebook.com/groups/transactioncoordinatorsforrealestate/)), educators ([Transaction Coordinator Academy](https://www.transactioncoordinatoracademy.com/), [Elite TC Training bootcamp](https://elitetctraining.com/waitlist/)), podcasts and communities ([The TC Exchange](https://open.spotify.com/show/0mfvGSTDZUsfcy6RmLABJR), [True North mastermind](https://www.truenorthtransactionservices.com/blog)).
- **[Fact]** TC platform software is priced far above UtilitySheet: Open To Close $99 to $399/mo, Paperless Pipeline from $65/mo, DocJacket $29/seat ([ListedKit comparison](https://www.listedkit.com/best-tc-software), [DocJacket comparison](https://www.docjacket.com/blog/best-transaction-coordinator-software)). UtilitySheet at $9/mo Pro and $7/seat Teams ([lib/marketing-content.ts:73-123](../../lib/marketing-content.ts)) is an impulse purchase for this audience. Growth, not monetization, is correctly the focus; but note the flip side: at $9/mo, referral rewards and affiliate payouts have little cash headroom, so the referral currency should be product credit and status, not money.
- **[Fact]** Buyer-side "utility concierge" services ([Citizen Home Solutions](https://www.citizenhomesolutions.com/), [Move Concierge](https://www.moveconcierge.com/), [Updater](https://updater.com/blog/updater-for-mortgage-professionals)) are free to agents and funded by provider referral fees. They are a *complement*, not a competitor: they need exactly the provider list UtilitySheet collects. **[Hypothesis]** A "help the buyer set up utilities" partnership on the packet page could become both a buyer-value add and a self-funding revenue stream, but it is exploratory and should not distract the next 90 days.
- **[Fact]** There is purchase intent for this exact artifact in template marketplaces: TCs and agents buy static "utility sheet" Canva templates on Etsy ([listing](https://www.etsy.com/listing/1672742266/utility-sheet-real-estate-utilities-list)). People pay $5 to $15 for a worse version of UtilitySheet's free tier.

## 4. Challenge to the existing strategy

I read [the growth design spec](../superpowers/specs/2026-07-14-utilitysheet-growth-design.md), [the campaign execution plan](../superpowers/plans/2026-07-14-growth-campaign-execution.md), [the product growth foundation plan](../superpowers/plans/2026-07-14-product-growth-foundation.md), and all of `docs/growth/` after forming the thesis above.

### Where I independently agree

- Primary metric: accounts receiving a first real seller submission each week. I arrived at the same metric before reading the spec.
- Activation over registration, demos excluded from activation counts (correctly enforced in [lib/admin/activation-funnel.ts:117,137,143,195](../../lib/admin/activation-funnel.ts)).
- The two proven channels (TC communities, transaction exposure) are the right starting set; no paid ads during validation.
- Ungated Handoff Kit as the flagship asset; it is live and well made ([app/(marketing)/tc-utility-handoff-kit/page.tsx](../../app/(marketing)/tc-utility-handoff-kit/page.tsx)).
- First-touch attribution with `unknown` as the honest default ([lib/growth/attribution.ts](../../lib/growth/attribution.ts)).
- The experiment protocol (two at a time, minimum samples, decision rules) is genuinely good discipline and better than most funded startups manage.

### Weak assumptions and missing evidence

1. **The 90-day target (45 to 100 newly activated) assumes an unproven multiplier.** Baseline: ~120 signups over roughly 20 weeks (about 6/week) with maybe 20 percent ever activating. Hitting 45 activated in 13 weeks requires signups to roughly double or triple AND activation to reach 30 to 35 percent simultaneously. Possible, but the plan does not say which target absorbs the miss. My revision: treat 25 to 60 as the honest range and pre-commit to the priority order if reality lands low (see section 10).
2. **The founder-activation experiment (35 percent threshold) cannot reach its minimum sample quickly.** It needs 20 messaged qualified TC signups from the previous 14 days; at ~6 signups/week of mixed quality, reaching sample takes most of the 90 days. The plan acknowledges extension but underweights how slow this will be.
3. **"Links copied" as the setup milestone is close to a vanity step.** The link is on the first screen and copy is one click; the meaningful setup milestone is *the link placed into an external template or checklist*, which is currently unobservable. A "test send" or self-report would measure it (see product improvements).
4. **The transaction-exposure loop is declared but not instrumented for its denominator.** There is a click event ([packet_referral_cta_clicked in lib/analytics/events.ts:142-145](../../lib/analytics/events.ts)) but no impression event, so click-through rate is uncomputable, and the CTA itself is a footnote-sized underlined line ([components/packet/transaction-referral-cta.tsx:16-27](../../components/packet/transaction-referral-cta.tsx)). The plan treats this loop as shipped; I consider it barely started.
5. **Vercel Analytics is the wrong tool for funnel questions.** Events go to `@vercel/analytics` custom events ([lib/analytics/events.ts:3,256](../../lib/analytics/events.ts)), which are aggregate counts without per-account journeys. The admin DB scoreboard covers activation correctly; everything the campaign needs to *decide* should come from the DB, and the plan should say so explicitly to avoid wasted analysis time.

### Important opportunities the strategy overlooks

1. **The recipient of a completed sheet gets no designed experience.** Today the co-op TC sees a packet page with a small footnote link. Nothing tells them what UtilitySheet is, that the sheet was produced in minutes without chasing, or that they can have this on their next listing file. This is the single strongest overlooked asset (detailed in section 6).
2. **New users cannot experience the payoff without a live file.** The demo at `/demo` shows the *seller's* flow, but the TC's payoff moment is receiving the completion email with the finished PDF. The `is_demo` scaffolding exists ([migrations-onboarding-demo.sql](../../migrations-onboarding-demo.sql)) and the funnel already excludes demo submissions, but there is no "send yourself a test submission" path in onboarding. This is the cheapest attack on the timing gap.
3. **The testimonials reveal the real ICP and the plan does not act on it.** All four public testimonials are TC-company owners or lead transaction managers, not solo TCs. Owners bring seats (Teams plan exists at $7/seat), enforce workflow across staff, and generate the packet volume that powers the exposure loop. The plan treats team expansion as a late-stage "ask a habitual solo user" motion; I would make TC-company owners the explicit outbound target from week one.
4. **Purchase-intent flanking (Etsy and template marketplaces) is absent.** The plan's search foundation is entirely on-domain SEO. A $10 Etsy listing ("Utility Sheet template, includes free automated version") reaches buyers at the exact moment of intent for near-zero effort. Unconventional, cheap, measurable.
5. **Nobody is told they have a referral code.** The intake slug doubles as an advocate code in packet URLs ([product-growth-foundation plan, packet meta](../superpowers/plans/2026-07-14-product-growth-foundation.md)), but no in-app surface shows the user a shareable "invite a TC" link or any reason to use one.

### Activities likely to consume founder time without producing activated accounts

- **Fifteen community comments per week** (spec section 8). Comments build familiarity but rarely convert without a follow-up channel; at 5 to 6 total hours/week this quota can eat a third of the budget. Halve it and only comment where a workflow question is being asked.
- **Five partnership introductions per week starting week 2.** The spec itself argues partnerships are a second layer, then the calendar front-loads them. Educator partnerships pay off in months. Two carefully chosen conversations in the first month is enough.
- **One customer story or workflow demonstration per week.** Producing net-new stories weekly will exhaust the four approved testimonials immediately and push toward manufacturing weak content. Reuse the four proof cards; produce new stories only when a new customer volunteers a result.
- **Six distinct community post types.** Posts 1, 2, and 3 (discussion, kit, blank-form case study) carry the value; posts 4 to 6 can wait for evidence.

### What I would remove, reorder, or test differently

- **Reorder:** ship the recipient experience and the self-serve test-drive *before* scaling community posting. Marketing should fill a funnel that no longer leaks on timing.
- **Remove (for now):** the weekly partnership quota; the comment quota as written; Post 4 to 6 production.
- **Test differently:** Experiment 2 (kit vs product-update post) measures the wrong contrast. Both variants are founder posts in the same channel. The more decision-relevant contrast is *channel vs channel*: kit post in community vs recipient-loop conversions vs TC-company outreach, all measured in first live submissions per founder-hour.
- **Keep unchanged:** founder-assisted activation messages (Experiment 1), the proof library, the operating rules on community conduct, the budget discipline.

## 5. Path to 100 / 1,000 / thousands

All projections below are planning estimates with stated assumptions, not forecasts.

**To 100 activated accounts (target: within 6 to 9 months).**
Needed: ~75 more activated accounts. At an improved 30 percent signup-to-activation rate (from product changes), that is ~250 additional qualified signups, or ~10/week for six months. Sources: community posting (proven, ~5 to 15 signups per good kit post **[Assumption]**), recipient loop (grows with packet volume), TC-company pilots (each win adds 2 to 10 activated seats at once). This stage is founder-led and mostly measured, not scaled.

**To 1,000 activated accounts (target: 18 to 30 months).**
Founder posting cannot produce this; it must come from mechanisms that scale with usage and other people's audiences:
- Recipient loop at measurable reproduction. Illustrative math **[Assumption]**: 300 activated accounts producing ~6 packets/month each is ~1,800 packets/month; if each packet page is viewed by 2 professionals, ~3,600 professional impressions/month; at 1 percent signup and 30 percent activation that is ~11 new activated accounts/month from the loop alone, compounding as the base grows. The point of instrumenting now is to replace these assumed rates with measured ones.
- TC educator placement: the Handoff Kit inside 2 or 3 course resource libraries ([Transaction Coordinator Academy](https://www.transactioncoordinatoracademy.com/), [Elite TC Training](https://elitetctraining.com/)) reaches every new TC cohort without weekly founder effort.
- Teams expansion: 50 TC companies at 4 seats average is 200 activated users from perhaps 50 founder conversations.
- Search/template flanking compounding in the background.

**To several thousand users.**
The TC-only universe likely caps in the low tens of thousands **[Assumption]**. Crossing "thousands of activated users" requires the adjacent listing-side audience: listing agents and team admins doing their own coordination (millions of transactions per year, [NAR data](https://finance.yahoo.com/real-estate/articles/u-existing-home-sales-fall-141636457.html)). The expansion path is already latent in the product (agent-facing marketing page exists; the recipient loop naturally exposes agents). The decision to invest in the agent segment should be triggered by evidence: when a meaningful share of recipient-loop signups are agents rather than TCs, follow the demand.

## 6. Five growth levers, ranked

Scores: impact on activated accounts (1 to 5), confidence, founder effort per week, cash, time to first evidence.

| # | Lever | Impact | Confidence | Founder effort | Cash | Time to evidence |
|---|-------|--------|-----------|----------------|------|------------------|
| 1 | **Engineer the closing-exposure loop** (recipient experience, visible CTA, impression tracking, completion-email footer, in-app "invite a TC" surface) | 5 | High that the channel is real (already produces users organically); medium on magnitude | ~0 (code) | $0 | 2 to 4 weeks (power users already generate packet views) |
| 2 | **Collapse time-to-aha: self-serve test drive** (send yourself the seller flow, receive the real completion email + PDF as `is_demo`) plus lifecycle emails re-timed to transaction rhythm (day 3, 10, 21: "put the link on your next listing file") | 4 | Medium-high (attacks the measured leak directly) | ~0 (code) | $0 | 2 to 3 weeks of new signups |
| 3 | **TC-company owner wedge** (founder outbound to TC companies, guided 30-day team pilot; in-product teammate-invite prompt after third submission) | 4 | Medium (testimonials are all owners; pilots unproven) | 2 to 3 h/week (this is where founder time goes) | <$100 (pilot credits) | 30 to 60 days |
| 4 | **Focused community motion** (kit post + blank-form case study only, one group/week, existing playbooks; halve the comment quota) | 3 | High (proven channel) | 1.5 to 2 h/week | $0 | 1 to 3 weeks per post |
| 5 | **Purchase-intent flanking** (Etsy template listing pointing at the free tier; 2 or 3 state-specific "utility transfer checklist" pages feeding the kit) | 2 | Medium | ~1 h one-time each | <$20 listing fees | 60 to 90 days |

Explicitly deprioritized: broad paid ads (agreed with existing plan), utility-concierge partnership (exploratory note only), pricing changes (revisit after validation; $9 Pro is likely underpriced relative to [category norms](https://www.listedkit.com/best-tc-software) but repricing mid-validation adds noise).

## 7. The single best growth wedge

**Make every completed closing a measured acquisition event (Lever 1), shipped this week, so that Levers 2 to 4 fill a funnel that recruits on its own.**

Why this wedge and not founder outreach or community first:

- It is the only channel whose volume scales with *existing customers' success* rather than founder hours. The power users sending dozens of sheets weekly are already generating the impressions; today those impressions land on a footnote.
- Targeting is perfect and timing is perfect: the viewer is a transaction professional looking at a utility sheet during a live closing, the exact moment the pain is salient.
- It cannot be copied away by a competitor post or algorithm change, and it compounds: each recruited TC generates more packets.
- It respects the white-label promise: the CTA renders only where powered-by branding is already visible ([app/packet/[token]/page.tsx:277-281, 666-668](../../app/packet/%5Btoken%5D/page.tsx)), so paid white-label output stays clean. **Why it creates activated accounts, not just signups:** a recipient who signs up has, by definition, an active real estate business and a live demonstration of the finished product; their path to a first submission is shorter than a cold community signup's.

Honest caveat **[Assumption]**: at today's base (10 to 30 activated accounts) the loop's absolute yield will be small, perhaps a few signups per month initially. The reason to build it now is that it is one-time code, its yield rises with every activated account, and its measured rates (view → click → signup → activation) are the single most important input to the 1,000-account plan.

## 8. At least two valuable ideas missing from the existing plan

1. **A designed recipient experience.** A `/from-a-closing` (or similar) landing page that packet CTAs and completion-email footers link to: "You just received a UtilitySheet. Here is what it is, here is how [Brand] produced it without chasing the seller, create your own reusable seller link." Plus a `packet_referral_cta_viewed` impression event and a visible (but tasteful) CTA treatment on free-plan packet pages. The existing plan shipped the plumbing (ref codes, attribution) but not the persuasion or the denominator.
2. **Self-serve test drive in onboarding.** "Send yourself a test UtilitySheet" button: opens their own intake link flagged `is_demo`, they play seller for 90 seconds on their phone, and they receive the real completion email with the finished PDF. The aha moment (a finished sheet arriving without work) happens in minutes instead of weeks, and it teaches exactly what their seller will experience, which reduces hesitation to send the link on a real file. Excluded from activation metrics by the existing `is_demo` machinery.
3. (Bonus) **Etsy flank.** List a polished static "Seller Utility Sheet template" on Etsy where TCs already buy them ([evidence](https://www.etsy.com/listing/1672742266/utility-sheet-real-estate-utilities-list)); the download includes "the automated version of this template is free" with a tracked link. Near-zero cost, reaches buyers with proven purchase intent outside Facebook.
4. (Bonus) **Named ICP shift to TC-company owners** as the primary outbound target (all four public testimonials are owners/leads), with the Teams plan and a guided pilot as the offer, rather than treating teams as a late-stage upsell of solo users.

## 9. Product-led growth improvements implementable in this repository

In priority order. None modify the paid white-label behavior.

1. **Recipient loop v2:** impression event, stronger CTA block on the free packet page, recipient landing page, completion-email footer for free-plan accounts, and recipient-source columns already supported by `getGrowthSourceStats` ([lib/admin/activation-funnel.ts:186](../../lib/admin/activation-funnel.ts)).
2. **Onboarding test drive:** "Send yourself a test sheet" step using the existing intake link and `is_demo` flag; completion email delivered for the demo so the payoff is felt.
3. **Lifecycle re-timing:** extend activation outreach stages beyond `after_15m`/`after_1d` ([lib/email/email-service.ts:1387](../../lib/email/email-service.ts)) with day-3, day-10, day-21 messages written around "your next listing file," reusing the founder playbook language so manual and automated messaging stay consistent.
4. **In-app referral surface:** a small "Invite another TC" card in dashboard/settings exposing their existing slug-based referral link, with product-credit reward copy once the founder defines the credit.
5. **Teammate-invite prompt:** after an account's third submission (the spec's own habitual threshold), show a one-time prompt suggesting a teammate invite; Teams infrastructure already exists ([app/api/organization/invites](../../app/api/organization/invites)).
6. **"Link placed" milestone measurement:** ask one question after first link copy ("Where did you put it?") or detect first intake visit from a non-owner device, so the funnel's real setup milestone becomes observable.

## 10. Founder-led actions that code cannot do

- Send the personal activation messages (playbook Messages 1 to 4) and hold the weekly ten-message cap.
- Post in TC Facebook groups under real identity, follow group rules, answer comments as a working founder.
- Recruit and run TC-company pilots: identify 10 TC companies (the testimonial customers can name peers; nationwide TC companies are publicly listed, e.g. [Be Happy TC](https://www.behappytc.com/), [Real Estate Paper Pushers](https://realestatepaperpushers.com/)), offer the guided 30-day team pilot.
- Ask the four testimonial customers for one introduction each (warmest possible outbound).
- Approve any new testimonial or numerical claim in writing before publication.
- Qualify and contact at most two educator partners in month one ([TCA](https://www.transactioncoordinatoracademy.com/), [Elite TC Training](https://elitetctraining.com/)) with the kit-plus-workshop offer already scripted in the partner playbook.
- Decide the referral reward (recommend: one free month of Pro per activated referral, as product credit).

## 11. Seven-day action plan (July 15 to July 21)

| Day | Action | Owner |
|-----|--------|-------|
| 1 | Approve/amend this review; decide the referral reward and the first implementation project | Founder |
| 1-2 | Implement Recipient Loop v2 (section 9.1) behind a PR; includes impression tracking | Claude Code |
| 2 | Record the true baseline scoreboard row from admin data (replaces the zeros in [experiment-log.md](experiment-log.md)) | Founder (10 min) |
| 3 | Send the first ten founder activation messages per the playbook (Experiment 1 starts) | Founder (1.5 h) |
| 3-4 | Implement onboarding test drive (section 9.2) behind a second PR | Claude Code |
| 4 | Publish Post 1 (no-link workflow discussion) in one qualified group | Founder (30 min) |
| 5 | Review, verify, and deploy both PRs after founder approval | Founder + Claude Code |
| 6 | Build the 10-company TC-pilot target list with contact routes | Founder (1 h) + Claude (research) |
| 7 | Weekly review: scoreboard, hours, first learnings | Founder (30 min) |

Founder time: about 4.5 hours. Cash: $0.

## 12. Revised 30/60/90-day plan

**Days 1 to 30.** Ship levers 1 and 2 (recipient loop, test drive, lifecycle re-timing). Run Experiment 1 (founder activation) continuously. Publish the kit post in two groups. Open five TC-company pilot conversations. Baseline every funnel rate.
*Exit criteria:* funnel rates measured end to end; ≥8 newly activated accounts; ≥1 pilot verbally agreed.

**Days 31 to 60.** Ship levers 4 support (referral surface, teammate prompt). Start 1 or 2 team pilots. One educator conversation with the workshop offer. Etsy flank listed. Community cadence steady at one post per week, winner-only.
*Exit criteria:* ≥20 cumulative newly activated; recipient loop view→click→signup rates known; test-drive cohort activation delta known.

**Days 61 to 90.** Double down on whichever of {recipient loop, community, pilots} produces the most first submissions per founder-hour; stop the weakest. Convert pilots to paid Teams. Draft the next cycle from measured rates.
*Exit criteria and honest targets:* 25 to 60 cumulative newly activated accounts (revised from the spec's 45 to 100; the low end is still 2x the historical rate). If below 25, the failure review must name which stage broke: signup volume, signup quality, or activation conversion, using the measured funnel.

## 13. Metrics, experiments, thresholds, stop/continue rules

**Scoreboard (weekly, from admin DB, not Vercel Analytics):** targeted signups by source, signup→link-copy rate, link-copy→first live submission within 21 days, first-submission→3 submissions within 30 days, packet CTA impressions/clicks/signups/activations, pilot count, paid conversions, founder hours, cash.

**Experiment A (existing, keep): founder-assisted activation.** As written in [experiment-log.md](experiment-log.md). Continue threshold ≥35 percent messaged-cohort activation; revise 20 to 34; stop below 20.

**Experiment B (new): recipient loop.** Hypothesis: ≥2 percent of packet-page recipients who see the CTA click it, and ≥10 percent of those clicks become signups. Minimum sample: 500 CTA impressions. Stop rule: <0.5 percent click rate after 1,000 impressions triggers a CTA redesign, not channel abandonment (the channel is proven organically; only the treatment would be failing).

**Experiment C (new): test drive.** Hypothesis: signups who complete the test drive activate (first live submission ≤21 days) at ≥10 percentage points above the trailing pre-launch cohort. Minimum sample: 30 test-drive completers. Stop rule: if completion of the test drive itself is <20 percent of new signups after 50 signups, redesign placement before judging the hypothesis.

**Experiment D (new): TC-company pilots.** 10 outreaches → ≥3 conversations → ≥1 pilot with ≥2 members submitting on live files within 45 days. Stop rule: 10 outreaches with zero conversations means the offer or list is wrong; rewrite before contacting more.

**Global stop/continue:** any channel with a fair sample (defined per experiment) producing signups but zero first live submissions is stopped, per the existing operating rules. Community posting drops to maintenance (one post/month) if two consecutive winning-variant posts produce <3 targeted signups each.

## 14. First implementation project recommended for Claude Code

**Project: Recipient Loop v2 ("every closing recruits").** One PR, reviewed before deploy:

1. `packet_referral_cta_viewed` impression event (typed, in [lib/analytics/events.ts](../../lib/analytics/events.ts)) plus a DB-side impression counter so the denominator lives in admin data, not Vercel.
2. Redesigned CTA block on the free packet page: small card ("This utility sheet was collected automatically with UtilitySheet. Coordinating a closing? Create your free seller link.") replacing the footnote link, still rendered only when `show_powered_by` is true.
3. `/from-a-closing` recipient landing page with the sender's brand name as social proof, a 3-step explanation, and the tracked signup CTA.
4. Completion-email footer variant for free-plan accounts with the same tracked link.
5. Admin scoreboard: add impressions and view→click→signup→activation columns to the existing growth source stats.
6. Unit tests mirroring the existing referral CTA and packet-data test patterns.

Rationale: smallest diff with the highest compounding payoff, zero founder-time cost, fully measurable within weeks, and it directly serves the proven "other side of the closing" channel.

## 15. What would prove me wrong?

- **If packet pages are viewed almost exclusively by sellers and buyers, not professionals**, the recipient loop's targeting premise fails. The impression event and click-through data will show this within 1,000 impressions.
- **If test-drive completers activate at the same rate as everyone else**, the activation gap is not about experiencing the payoff; it is signup quality (curious non-practitioners from Facebook) or template placement friction, and effort should shift to qualification and the "link placed" milestone.
- **If TC-company pilots stall because owners demand white-label everywhere including the recruitment surfaces**, the Teams wedge and the exposure loop are in tension, and the loop math must rely on free-tier users only (smaller multiplier).
- **If community posts continue to produce most activations per hour even after the product loops ship**, my reordering was wrong and the existing plan's community-first weighting was right; the calendar should revert to its original cadence.
- **If signups stay near 6/week despite all levers**, the reachable TC market via these channels is thinner than assumed, and the agent-segment expansion decision moves up from "when evidence appears" to a deliberate test.

## 16. Recommended next action

**Approve the Recipient Loop v2 project (section 14) and have Claude Code open that PR now**; everything else in the seven-day plan hangs off decisions the founder can make while it is being built.
