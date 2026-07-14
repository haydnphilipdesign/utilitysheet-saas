# UtilitySheet 90-Day Growth Campaign Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acquire and activate independent transaction coordinators and small TC teams through useful community content, founder-assisted workflow setup, transaction referrals, and qualified partnerships.

**Architecture:** Run one founder-led campaign system with a shared acquisition asset, source-tagged links, behavior-based outreach, and a weekly experiment review. Store campaign materials and results in focused Markdown files so the operating system remains usable without adding a marketing platform.

**Tech Stack:** Markdown campaign assets, UtilitySheet product analytics, Vercel Analytics, email, Facebook communities, Google Sheets or the existing admin dashboard for weekly reporting

---

## File Structure

### Create

- `docs/growth/tc-utility-handoff-kit.md` — the flagship free resource.
- `docs/growth/customer-proof-library.md` — approved public customer proof organized by use case.
- `docs/growth/community-content-bank.md` — ready-to-publish educational and product posts.
- `docs/growth/founder-activation-playbook.md` — lifecycle triggers and personal outreach scripts.
- `docs/growth/partner-outreach-playbook.md` — partner qualification, offer, and scripts.
- `docs/growth/experiment-log.md` — the first two experiments and weekly scoreboard.
- `docs/growth/90-day-calendar.md` — dated execution checklist from July 15 through October 12, 2026.

### Inputs

- `docs/superpowers/specs/2026-07-14-utilitysheet-growth-design.md`
- `fb-posts-may-2026.md`
- `lib/marketing-content.ts`
- The public testimonials currently published on `https://www.utilitysheet.com/`
- The product-growth foundation plan in `docs/superpowers/plans/2026-07-14-product-growth-foundation.md`

## Operating Rules

- Optimize for first live seller submissions, not registrations.
- Work only in communities where participation and the specific post comply with group rules.
- Do not mass-DM group members or scrape member lists.
- Use only approved public testimonials; obtain written approval for new quotations or business results.
- Never publish customer email addresses, seller information, property addresses, or request links.
- Run at most two experiments at once.
- Stop channels that produce registrations without live usage after a fair sample.
- Keep founder time between four and six hours per week.
- Keep 90-day cash spend below $500.

### Task 1: Establish the baseline and campaign link convention

**Files:**
- Create: `docs/growth/experiment-log.md`

- [ ] **Step 1: Record the baseline snapshot**

Create the file with this opening section:

```markdown
# UtilitySheet Growth Experiment Log

## Baseline

- Snapshot date: July 14, 2026
- Historical auth signups in May 4 export: 120
- Estimated accounts used on a real transaction: 10-30
- Known high-frequency behavior: several paying accounts use UtilitySheet multiple times to dozens of times per week
- Strongest known acquisition sources: TC Facebook groups and exposure on the other side of a closing
- Primary metric: accounts receiving their first real seller submission each week
- First 90-day target: 45-100 newly activated accounts

## Campaign Link Convention

Use lowercase kebab-case values:

`https://www.utilitysheet.com/auth/signup?utm_source={community-or-partner}&utm_medium={facebook-or-partner}&utm_campaign=90-day-tc-growth&utm_content={asset-name}`

Examples:

- Facebook case study: `https://www.utilitysheet.com/auth/signup?utm_source=tc-collective&utm_medium=facebook&utm_campaign=90-day-tc-growth&utm_content=case-study`
- Handoff kit: `https://www.utilitysheet.com/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta`
- Partner workshop: `https://www.utilitysheet.com/auth/signup?utm_source=partner-name&utm_medium=partner&utm_campaign=90-day-tc-growth&utm_content=live-workshop`

Do not reuse a source value for two unrelated communities. Record the actual community name in the private experiment log; public URLs may use a short neutral slug.
```

- [ ] **Step 2: Capture the first live funnel counts**

Record one row using the current admin data:

```markdown
## Weekly Scoreboard

| Week ending | Targeted signups | Links copied | First live submissions | Reached 3 submissions | New paid | Team invites | Referral signups | Founder hours | Cash spent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-07-21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0 |
```

Replace the zeroes with verified counts at the July 21 review. Until the product-growth dashboard ships, use database/admin counts plus a manual source tally; label untraceable registrations `unknown`.

- [ ] **Step 3: Commit the baseline**

```bash
git add docs/growth/experiment-log.md
git commit -m "docs: establish UtilitySheet growth baseline"
```

### Task 2: Produce the TC Utility Handoff Kit

**Files:**
- Create: `docs/growth/tc-utility-handoff-kit.md`

- [ ] **Step 1: Create the resource with this exact introduction**

```markdown
# The TC Utility Handoff Kit

A practical, copy-and-paste workflow for collecting seller utility information without rebuilding the process on every file.

Use these templates as-is, customize them for your business, or replace the form step with your reusable UtilitySheet link.
```

- [ ] **Step 2: Add the seller email template**

```markdown
## Seller Email Template

**Subject:** Quick utility information for your closing

Hi [Seller First Name],

Please complete our short utility information form for [Property Address]:

[UTILITY FORM LINK]

It works from your phone and should only take a few minutes. If you are unsure about a provider, choose “Not sure” and continue—you do not need to research anything before submitting.

Thank you!

[TC Name]
[TC Company]
```

- [ ] **Step 3: Add the text-message template**

```markdown
## Seller Text Template

Hi [Seller First Name]—when you have a moment, please complete this short utility form for [Property Address]: [UTILITY FORM LINK]. It works from your phone, and “Not sure” is completely fine if you do not know an answer. Thank you! —[TC Name]
```

- [ ] **Step 4: Add the utility handoff checklist**

```markdown
## TC Utility Handoff Checklist

- Add the utility-form link to the listing-side seller email template.
- Send the link when the file reaches the point your process normally requests utility information.
- Confirm that the seller opened or submitted the form.
- Send one reminder if the form remains incomplete.
- Review provider names and contact details for obvious errors.
- Correct formatting or missing public contact information when needed.
- Save the finished sheet or PDF in the transaction file.
- Share the approved utility sheet with the intended closing participants.
- Never ask the seller to send account numbers, passwords, or copies of utility bills.
```

- [ ] **Step 5: Add workflow insertion instructions**

```markdown
## Add the Link Once

### Email template

Replace `[UTILITY FORM LINK]` with your permanent seller link and save the message in your email templates.

### Dotloop, SkySlope, or Brokermint

Add a checklist task named `Send seller utility form`. Paste the permanent link into the task instructions so the coordinator does not need to look it up.

### TC checklist

Place the task beside the point where you currently request seller disclosures, closing details, or move-out information.

### UtilitySheet

Your reusable seller link is available on the dashboard. Sellers enter the property address, complete the guided flow, and the resulting sheet returns to the same workspace.
```

- [ ] **Step 6: Add the CTA without gating the resource**

```markdown
## Want the Automated Version?

The templates above are free to use with any workflow. UtilitySheet replaces the blank form and manual cleanup with one reusable seller link, guided utility questions, completion tracking, and a clean web sheet plus PDF.

[Create your seller link](https://www.utilitysheet.com/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta)
```

- [ ] **Step 7: Review the kit for the product constraints**

Verify that it never asks sellers to upload bills, research provider contacts, provide passwords, or submit utility account numbers. Verify that it can be useful without creating a UtilitySheet account.

Expected: all five checks pass.

- [ ] **Step 8: Commit the kit**

```bash
git add docs/growth/tc-utility-handoff-kit.md
git commit -m "docs: create TC utility handoff kit"
```

### Task 3: Organize the existing customer proof

**Files:**
- Create: `docs/growth/customer-proof-library.md`
- Input: `lib/marketing-content.ts`
- Input: current public UtilitySheet homepage

- [ ] **Step 1: Create four proof cards using only public statements**

Use this structure:

```markdown
# UtilitySheet Customer Proof Library

Only use quotations already approved for the public UtilitySheet website. Preserve the speaker's name, title, and company exactly as published.

## Proof Card 1: Blank forms did not come back

- Customer: Kaylin Nunn
- Role: Owner & Director of Transaction Coordination
- Company: Precision Leverage Solutions
- Before: Blank forms sent through Dotloop or DocuSign rarely came back completed.
- After: One templated seller link leads to a completion notification and downloadable finished sheet.
- Best use: activation outreach, partner demonstrations, and a community post about replacing blank forms.

## Proof Card 2: Last-minute provider chasing

- Customer: Courtney Bownes
- Role: Owner | Lead Transaction Manager
- Company: FastForward Transaction Management
- Before: Utility details were requested through email and providers were tracked down at the last minute.
- After: Sellers receive the UtilitySheet link and completion has been strong.
- Best use: pain-focused community posts and the Utility Handoff Kit.

## Proof Card 3: Manual spreadsheet cleanup

- Customer: Agatha Aquilia
- Role: Transaction Manager
- Company: Aquilia Associates
- Before: A local-provider spreadsheet was copied into emails.
- After: The co-op agent can send the seller form, and the branded PDF improves the TC company's client experience.
- Best use: transaction-exposure and branded-output messaging.

## Proof Card 4: Chasing vague seller answers

- Customer: Debbie O'Brien
- Role: Transaction Coordinator
- Company: PA Real Estate Support Services, LLC
- Before: Utility details arrived through texts and emails with vague answers requiring cleanup.
- After: One guided link produces a clean sheet that is easier to review and share.
- Best use: founder story and workflow education.
```

- [ ] **Step 2: Add proof-use rules**

```markdown
## Use Rules

- Link to or reproduce the approved public quotation when quotation marks are used.
- Paraphrases must not introduce numerical results the customer did not provide.
- Do not describe a customer as paid, high-volume, or a team unless that fact is approved for publication.
- Do not expose seller or property information in screenshots.
- Ask for written approval before publishing a new result, screenshot, or quotation.
```

- [ ] **Step 3: Commit the proof library**

```bash
git add docs/growth/customer-proof-library.md
git commit -m "docs: organize UtilitySheet customer proof"
```

### Task 4: Build the first six weeks of community content

**Files:**
- Create: `docs/growth/community-content-bank.md`
- Input: `fb-posts-may-2026.md`
- Input: `docs/growth/customer-proof-library.md`
- Input: `docs/growth/tc-utility-handoff-kit.md`

- [ ] **Step 1: Add the publishing rules**

```markdown
# UtilitySheet Community Content Bank

## Publishing Rules

- Confirm the group's promotion policy before every original post.
- Publish no more than one UtilitySheet-related original post per group per week.
- Do not paste the same post into multiple groups on the same day.
- Remove the product link when a group allows education but not promotion.
- Answer comments as a working TC/founder; do not convert every reply into a pitch.
- Track each allowed link with the community-specific source slug.
```

- [ ] **Step 2: Add Post 1 — workflow discussion**

```markdown
## Post 1: How are TCs collecting utilities now?

TCs: what are you currently sending sellers when you need utility information—a blank PDF, Google Form, email checklist, something inside your transaction platform, or nothing formal?

I used to end up with answers scattered across texts and emails, then clean everything up right before it needed to be shared. I am curious which version of this workflow is actually working well for people now.

CTA: No product link. Respond to the workflow people describe.
```

- [ ] **Step 3: Add Post 2 — free kit**

```markdown
## Post 2: Free TC Utility Handoff Kit

I turned the utility-collection workflow I use into a small copy-and-paste kit for TCs:

- seller email template
- seller text template
- utility handoff checklist
- instructions for adding the link to your existing checklist or transaction platform

You can use the templates whether or not you use UtilitySheet. If the admins are okay with it, I will add the link in the comments.

CTA when allowed: community-tagged link to the kit.
```

- [ ] **Step 4: Add Post 3 — blank form case study**

```markdown
## Post 3: The blank-form problem

One TC-company owner described the old utility workflow perfectly: they sent blank forms through Dotloop or DocuSign, and the forms rarely came back completed.

The useful change was not “more reminders.” It was replacing the blank document with one phone-friendly seller link inside the email template. The seller submits it, the TC gets notified, and the finished sheet is ready to review.

If your current form comes back incomplete, I would look at the format before adding another follow-up task.

CTA when allowed: `Try the seller flow` with a tagged `/demo` link.
```

- [ ] **Step 5: Add Post 4 — workflow demonstration**

```markdown
## Post 4: The 66-second workflow

Here is the entire utility handoff in about a minute:

1. The TC sends the permanent seller link from an existing template.
2. The seller enters the address and confirms or types the providers.
3. The TC receives a clean sheet and PDF.

The main goal is not fancy software. It is removing one repeated chase-and-cleanup loop from every listing file.

CTA when allowed: tagged UtilitySheet demo video or demo-page link.
```

- [ ] **Step 6: Add Post 5 — build from feedback**

```markdown
## Post 5: What active TCs changed in UtilitySheet

The most useful UtilitySheet improvements did not come from a feature brainstorm. They came from TCs using it on real files:

- edit a sheet after the seller submits
- reuse one seller link across files
- download the PDF directly
- handle unit numbers and addresses more cleanly
- attach the finished PDF to the completion email

If you tried an earlier version and bounced off something, I would genuinely like to know what it was. That feedback is more useful than a polite review.

CTA: Invite comments or direct replies; link only if requested or permitted.
```

- [ ] **Step 7: Add Post 6 — other side of the closing**

```markdown
## Post 6: A workflow spreads across the closing

An unexpected way people discover UtilitySheet is by being on the other side of a closing where a TC already used it.

That makes sense: a clean utility sheet is easiest to understand when it arrives as part of a real file. There is no abstract software pitch—the recipient can see the completed result.

For TCs who send a utility sheet forward, what does the receiving side usually need from it? Provider names only, contact details, move-in notes, or something else?

CTA: Discussion only. Use replies to learn what makes the shared output more useful.
```

- [ ] **Step 8: Commit the content bank**

```bash
git add docs/growth/community-content-bank.md
git commit -m "docs: prepare TC community content bank"
```

### Task 5: Create the founder-assisted activation playbook

**Files:**
- Create: `docs/growth/founder-activation-playbook.md`

- [ ] **Step 1: Define the lifecycle and response times**

```markdown
# UtilitySheet Founder Activation Playbook

## Objective

Help a qualified TC insert their reusable UtilitySheet link into an existing live-file workflow and receive the first real seller submission.

## Lifecycle Triggers

| State | Response window | Goal |
| --- | --- | --- |
| Signed up, no link activity | within 1 business day | identify current process |
| Copied link, no submission after 3 days | same business day | place link on a real file |
| First seller submission | within 1 business day | reinforce the repeatable workflow |
| Third submission in 30 days | within 2 business days | ask about teammates and referral |

Maximum: two unanswered personal activation messages per account in 14 days. Existing automated verification or service emails do not count as founder messages.
```

- [ ] **Step 2: Add the signed-up/no-activity script**

```markdown
## Message 1: Current workflow

**Subject:** Where should your UtilitySheet link go?

Hi [First Name]—Haydn here from UtilitySheet.

What are you currently sending sellers when you request utility information: an email, PDF, Google Form, or something inside your transaction platform?

If you send me the template or describe the step, I will show you exactly where the reusable link fits. No call needed.

—Haydn
```

- [ ] **Step 3: Add the copied-link/no-submission script**

```markdown
## Message 2: First live file

**Subject:** Your seller link is ready for a live file

Hi [First Name]—I saw that you got your reusable seller link set up.

The fastest way to test UtilitySheet is to place that link into the seller email or checklist you already use and send it on one current listing. The seller enters the property address, so you can keep using the same link.

If you reply with the message you normally send, I am happy to tighten it up for you.

—Haydn
```

- [ ] **Step 4: Add the first-submission script**

```markdown
## Message 3: Reinforce success

**Subject:** Your first UtilitySheet came through

Hi [First Name]—your first seller submission came through. Nice!

The biggest time-saver is adding that same link permanently to the email or checklist step you use on every listing. You should not need to create a new link for the next property.

Was anything confusing for you or the seller on this first one?

—Haydn
```

- [ ] **Step 5: Add the habitual/team script**

```markdown
## Message 4: Team expansion

**Subject:** Should anyone else share this workflow?

Hi [First Name]—you have now used UtilitySheet across several files, so I wanted to ask: are you the only person handling these submissions, or should someone else on your team have access too?

If a shared setup would help, I can configure a 30-day team pilot with your branding and defaults. The goal would be to test it on live files, not sit through a sales presentation.

—Haydn
```

- [ ] **Step 6: Add the weekly activation queue procedure**

```markdown
## Weekly Queue

Every Monday:

1. Pull qualified signups from the previous 14 days.
2. Exclude admins, test accounts, bounced emails, and users who opted out.
3. Assign each account to exactly one lifecycle state.
4. Send no more than ten personal messages that week.
5. Log the date, state, message number, response, and next action.
6. At Friday review, count first live submissions among messaged and comparable unmessaged accounts.
```

- [ ] **Step 7: Commit the playbook**

```bash
git add docs/growth/founder-activation-playbook.md
git commit -m "docs: create founder activation playbook"
```

### Task 6: Create and begin the partner motion

**Files:**
- Create: `docs/growth/partner-outreach-playbook.md`

- [ ] **Step 1: Add qualification and the initial lead list**

```markdown
# UtilitySheet Partner Outreach Playbook

## Qualified Partner

A qualified partner has an active audience of independent TCs or TC-company owners, publishes practical workflow education, and can place UtilitySheet inside a course, resource library, workshop, newsletter, or community discussion.

## Initial Research List

1. Transaction Coordinator Academy — https://www.transactioncoordinatoracademy.com/home/
2. Empowering TCs — https://www.empoweringtcs.com/
3. Top Tier Transaction Coordinator — https://www.toptiertc.com/
4. Atlas TC Collective — https://www.atlastcservices.com/atlastccollective1
5. True North Transaction Services community — https://www.truenorthtransactionservices.com/connect

These are research leads, not confirmed fits or endorsements. Review the current program, audience, contact route, and promotion policy before outreach.
```

- [ ] **Step 2: Add the partner offer**

```markdown
## Offer

- Free Utility Handoff Kit for every member
- A practical 20-minute workshop: “Stop chasing sellers for utility information”
- Live demonstration using a fictional property and seller
- Extended Pro trial for members who want to test it on live files
- Optional tracked partner link
- No upfront sponsorship fee during the validation phase

The workshop teaches the manual workflow first and shows UtilitySheet as the automated version.
```

- [ ] **Step 3: Add the outreach email**

```markdown
## Initial Email

**Subject:** Free utility-handoff workflow for your TC community

Hi [Name],

I built UtilitySheet from a real TC workflow: instead of chasing utility details through texts, blank forms, and email, the TC sends one reusable seller link and gets a clean sheet back.

I also turned the process into a free Utility Handoff Kit with the email, text, and checklist templates. It is useful even for members who never use the software.

Would a practical 20-minute session on setting up this workflow be useful for your community? I can teach the manual process first, demonstrate the seller flow with fictional data, and give members the kit plus an extended trial if they want it.

No sponsorship ask—I am looking for a few communities where this solves a real repeated problem.

—Haydn
UtilitySheet.com
```

- [ ] **Step 4: Add the follow-up limit**

```markdown
## Follow-Up

Send one follow-up after seven days:

Hi [Name]—following up once on the Utility Handoff Kit and short TC workshop. If utility collection is not a recurring issue for your audience, no worries at all. If it is, I can send the complete kit and a two-minute outline before you decide.

Do not send another message without a reply.
```

- [ ] **Step 5: Research and contact five partners**

For each lead, record:

- Audience focus
- Current active program or community
- Public contact route
- Evidence that workflow tools are relevant
- Date contacted
- Outcome

Expected: five individually researched messages, not one bulk send.

- [ ] **Step 6: Commit the playbook**

```bash
git add docs/growth/partner-outreach-playbook.md
git commit -m "docs: prepare TC partner outreach"
```

### Task 7: Run the first two controlled experiments

**Files:**
- Modify: `docs/growth/experiment-log.md`

- [ ] **Step 1: Add Experiment 1 — founder activation**

```markdown
## Experiment 1: Founder-Assisted Workflow Placement

- Start: July 22, 2026
- End: August 4, 2026
- Hypothesis: offering to place UtilitySheet inside the TC's existing seller-email or checklist workflow will produce a first live seller submission for at least 35% of targeted signups receiving the offer.
- Audience: qualified TC signups from the previous 14 days with no live seller submission.
- Intervention: Message 1 or Message 2 from the Founder Activation Playbook, selected by lifecycle state.
- Comparison: qualified signups from the immediately preceding comparable cohort that did not receive personal workflow-placement help.
- Primary metric: percentage receiving a first non-demo seller submission within 14 days.
- Guardrail: unsubscribe, complaint, or negative-reply rate.
- Minimum sample: 20 messaged accounts. If fewer than 20 are eligible, extend the experiment until 20 are reached and keep the intervention unchanged.
- Decision rule: expand at 35% or higher without guardrail issues; revise at 20-34%; stop below 20% or after material complaints.
```

- [ ] **Step 2: Add Experiment 2 — case study versus kit**

```markdown
## Experiment 2: Community Offer

- Start: July 29, 2026
- End: August 25, 2026
- Hypothesis: the free Utility Handoff Kit will produce more qualified activated accounts per post than a direct product-update post.
- Audience: two comparable TC communities where each post complies with the rules.
- Variant A: Post 2, the free Utility Handoff Kit.
- Variant B: Post 5, improvements built from TC feedback.
- Primary metric: first live seller submissions attributed to each post within 21 days.
- Secondary metric: qualified signups.
- Guardrail: deleted posts, moderation warnings, or negative sentiment.
- Minimum sample: two posts per variant across at least two communities; do not post both variants in the same community during the same week.
- Decision rule: expand the variant producing more first live submissions; if both produce zero, revise the offer before increasing posting volume.
```

- [ ] **Step 3: Commit the experiment definitions**

```bash
git add docs/growth/experiment-log.md
git commit -m "docs: define initial UtilitySheet growth experiments"
```

### Task 8: Create and run the dated 90-day calendar

**Files:**
- Create: `docs/growth/90-day-calendar.md`

- [ ] **Step 1: Create the calendar**

```markdown
# UtilitySheet 90-Day Growth Calendar

## Week 1 — July 15-21

- Record baseline funnel counts.
- Create the campaign link convention.
- Draft and review the TC Utility Handoff Kit.
- Select three communities where current rules permit participation.
- Time budget: 5 hours.

## Week 2 — July 22-28

- Finalize the customer proof library.
- Start Experiment 1 with the first eligible founder-activation cohort.
- Publish Community Post 1 as a discussion with no link.
- Research the first five partner leads.
- Time budget: 5 hours.

## Week 3 — July 29-August 4

- Publish the Utility Handoff Kit where permitted.
- Start Experiment 2.
- Send no more than ten lifecycle-based founder messages.
- Contact the first two qualified partners.
- Review first-submission attribution on August 4.
- Time budget: 6 hours.

## Week 4 — August 5-11

- Publish the blank-form case study in a different qualified community.
- Send the remaining three individually researched partner messages.
- Ask one active power user for an introduction to another TC.
- Update the scoreboard and founder-hours count.
- Time budget: 5 hours.

## Week 5 — August 12-18

- Publish the 66-second workflow demonstration where permitted.
- Continue the founder-activation cohort without changing its message.
- Follow up once with non-responsive partners contacted in Week 3.
- Invite one habitual solo user to a guided team pilot.
- Time budget: 5 hours.

## Week 6 — August 19-25

- Publish the “built from TC feedback” post.
- Close Experiment 2 if the minimum sample is met.
- Select the strongest content offer by first live submissions.
- Schedule a partner workshop if a qualified partner accepts.
- Time budget: 5 hours.

## Week 7 — August 26-September 1

- Republish the winning concept with a new customer story, not identical copy.
- Ask two active users for one relevant introduction each.
- Start up to two team pilots for high-volume solo accounts.
- Update the Utility Handoff Kit from repeated user questions.
- Time budget: 6 hours.

## Week 8 — September 2-8

- Run or rehearse the first partner workshop.
- Publish the other-side-of-closing discussion post.
- Review packet-referral signups if the product-growth foundation is live.
- Stop one activity that has produced registrations without activation.
- Time budget: 5 hours.

## Week 9 — September 9-15

- Turn the strongest workshop question into a community post.
- Follow up with team-pilot participants.
- Contact five additional partners only if the first partner batch produced replies or useful feedback.
- Update the scoreboard.
- Time budget: 5 hours.

## Week 10 — September 16-22

- Publish the strongest case study with a new hook.
- Ask newly habitual users what placed UtilitySheet into their repeated workflow.
- Document the most common activation path.
- Evaluate whether founder activation can be partially automated.
- Time budget: 5 hours.

## Week 11 — September 23-29

- Run a second partner workshop or community demonstration if the first produced qualified signups.
- Ask each successful team pilot for a go/no-go decision.
- Publish one educational post with no product CTA.
- Update the scoreboard.
- Time budget: 5 hours.

## Week 12 — September 30-October 6

- Calculate conversion by source from signup to first live submission.
- Calculate first submission to three submissions within 30 days.
- Identify the one community, one message, and one partner motion to continue.
- Draft the next 90-day recommendation from verified results.
- Time budget: 5 hours.

## Week 13 — October 7-12

- Complete the final 90-day review.
- Compare baseline and stretch targets with actuals.
- Decide expand, revise, or stop for each channel.
- Thank customers and partners who contributed proof or interviews.
- Publish no new campaign until the review decision is recorded.
- Time budget: 4 hours.
```

- [ ] **Step 2: Add the weekly recurring checklist**

```markdown
## Every Monday

- Select the ten highest-priority activation contacts.
- Schedule no more than two original community posts.
- Confirm every target group's current rules.
- Reserve one block for user or partner conversations.

## Every Friday

- Update the weekly scoreboard.
- Record founder hours and cash spend.
- Attribute first live submissions conservatively.
- Decide whether each active experiment continues unchanged.
- Write one sentence explaining the week's most important learning.
```

- [ ] **Step 3: Commit the calendar**

```bash
git add docs/growth/90-day-calendar.md
git commit -m "docs: schedule UtilitySheet 90-day growth campaign"
```

### Task 9: Verify the campaign system before launch

**Files:**
- Verify all files in `docs/growth/`.

- [ ] **Step 1: Scan for prohibited placeholders and sensitive data**

Run:

```bash
rg -n "TBD|TODO|FIXME|seller email address|property address|request token|account number|password" docs/growth
```

Expected: no placeholders or real sensitive data. Template labels such as `[Seller First Name]` and `[Property Address]` are acceptable because they are explicitly copy-and-paste fields, not unfinished plan content.

- [ ] **Step 2: Check every UtilitySheet campaign URL**

Run:

```bash
rg -n "utilitysheet.com" docs/growth
```

Expected: acquisition URLs use HTTPS and carry the approved campaign parameters; ordinary product references may use the clean homepage URL.

- [ ] **Step 3: Check the workload**

Add the weekly time budgets from `90-day-calendar.md`.

Expected: no week exceeds six founder hours and the average remains between four and six hours.

- [ ] **Step 4: Check budget commitments**

Expected maximum commitments:

- Customer interview thank-you gifts: $150
- Referral product credits: $200 in non-cash value
- Optional tools: $100
- Reserved measured experiment: $50
- Broad advertising: $0

Total cash maximum: $300 when product credits are non-cash; total promotional value maximum: $500.

- [ ] **Step 5: Commit verification corrections if needed**

Stage only corrected files under `docs/growth/` and commit with:

```bash
git commit -m "fix: finalize UtilitySheet growth campaign assets"
```

Skip this commit when verification requires no corrections.
