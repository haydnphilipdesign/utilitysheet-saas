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

## Weekly Scoreboard

| Week ending | Targeted signups | Links copied | First live submissions | Reached 3 submissions | New paid | Team invites | Referral signups | Founder hours | Cash spent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-07-21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0 |

Replace the zeroes with verified counts at the July 21 review. Until the product-growth dashboard ships, use database/admin counts plus a manual source tally; label untraceable registrations `unknown`.

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
