# Plan: HOA questions on/off setting, and the product update

- Status: **Setting completed 2026-10-01** and pushed to `main` with owner
  authorization. No required engineering work remains. **The product update is
  the owner's to publish** through `/admin/updates`; copy is in section 3. See
  section 8 for the implementation record.
- Created: 2026-10-01
- Author: Claude Opus 5.5 (Claude Code)
- Requested by: product owner, 2026-10-01, after the HOA question group shipped:
  add a setting to turn the new questions off, decide whether turning them off
  is a paid capability, and publish a product update.
- Related: `.ai/plans/2026-09-19-hoa-question-group.md` (Completed),
  `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md` (Accepted; its
  "no per-customer opt-out" clause is what this plan would amend).

---

## 1. Verified repository facts (2026-10-01, `main` at `ed910bb`)

- **There is no setting today.** The HOA gate is asked on every seller form. The
  decision record says so deliberately.
- **The closest precedent is free on every plan.** "Collect electric meter
  number" is a switch under Settings, Seller Form, "What sellers are asked"
  (`app/dashboard/settings/page.tsx:1288-1300`). It is stored as
  `collect_electric_meter_number` in `accounts.notification_preferences`, saved
  through `PATCH /api/account`, and is not gated. The utility-category
  checkboxes beside it are also not gated.
- **What is gated to Pro / Teams in that section:** the custom form URL, the
  Property Handoff Packet mode, and the handoff modules and per-question
  controls (`intakeCanCustomize`; server check in `app/api/intake-link/route.ts`).
  So the existing rule is: Free chooses which basic sections sellers see; paid
  unlocks the handoff packet and its per-question controls.
- **The meter preference is read live, not copied per request.** The seller
  route reads the request owner's account preferences on GET and POST
  (`app/api/seller/[token]/route.ts:371-376, 486-497`). Flipping it changes
  forms already sent.
- **`SellerQuestionConfiguration` already carries `collectElectricMeterNumber`**
  (`lib/packet/seller-questions.ts`), so the question preview and inventory have
  a slot for this kind of preference.
- **Product updates have two channels.** `FEATURED_PRODUCT_UPDATES` in
  `lib/product-updates.ts` is hardcoded, ships with a deploy, and a new first
  entry re-surfaces the dashboard banner for everyone. `/admin/updates` writes
  database rows and needs an admin session, a reason, and an audit entry.
  `tests/unit/provider-incident-product-update.test.ts` asserts on
  `FEATURED_PRODUCT_UPDATES[0]` and must be updated when an entry is added
  above it.

## 2. Recommended design

One switch, default on, available on every plan.

- **Setting:** "Ask about HOA or condo association", next to the meter switch.
  Stored as `collect_hoa_questions` in `accounts.notification_preferences`
  (absent means on). No migration.
- **Seller form:** GET returns the flag; `HomeBasicsStep` hides the question and
  `ReviewStep` hides its row when it is off.
- **Server:** POST ignores HOA answers when the flag is off, and leaves stored
  answers alone, the same path already used for a form that sends no HOA keys.
- **Already collected answers keep printing.** The switch controls asking, not
  the packet. A coordinator who wants an answer off a sheet edits it (Pro) or
  leaves it; nothing is deleted by flipping a setting.
- **Editor:** the HOA section stays, so existing answers remain editable.
- **Preview and inventory:** the "See what sellers are asked" dialog shows the
  HOA questions as not included when off, mirroring the meter question.
- **Granularity:** one switch. No per-field control in this slice.

### Why not gate it

1. It matches the precedent in the same panel. The meter switch and the utility
   categories are free; a paid-only "off" beside them would be the odd one out.
2. Paid plans sell additions (the handoff packet, branding, editing). Charging
   to remove a question that was just added to every Free user's form reads as
   taking something away to sell it back.
3. Default-on keeps the data. Most accounts will not touch it, so the Yes rate
   in telemetry stays meaningful.
4. The upgrade pull is close to zero either way. Nobody upgrades to remove one
   optional tap.

A defensible alternative, if a paid angle is wanted later: keep on/off free and
make per-field control of the detail questions a Pro capability, consistent with
the handoff per-question controls.

## 3. Product update

**Owner decision, 2026-10-01:** publish through the existing admin system at
`/admin/updates` (save a draft with a reason, then publish as a separate audited
action). `FEATURED_PRODUCT_UPDATES` is not used and was not changed, so
`tests/unit/provider-incident-product-update.test.ts` needs no change. An agent
cannot publish this: it requires an admin session, and writing the row directly
would bypass the audit log.

The setting shipped first, so the announcement can say how to turn it off. Copy
for the owner to paste (category Feature):

> **New: Seller forms now ask about HOA and condo associations**
>
> Every seller form now asks whether the home is part of an HOA or condo
> association.
>
> - A No or Not sure is one tap for the seller.
> - A Yes collects the association name, management company, a contact (name,
>   phone, email), dues, and where dues are paid or documents are found.
> - The answers appear on the info sheet and the PDF. Pro and Team workspaces
>   can correct them after submission.
> - Included on every plan. It is on by default; turn it off under Settings,
>   Seller Form.
>
> We also reworded the water and sewer option that used to read "HOA / Condo".
> It now reads "Included in HOA / Condo Fee", so sellers no longer skip the
> provider question by mistake.

Category `feature`. If the setting is not approved, drop the last sentence of
the fourth bullet.

## 4. Acceptance criteria

1. With the setting on (or never set), behavior is exactly today's.
2. With it off, the seller form does not show the HOA question, the review step
   does not show its row, and a submission does not change stored HOA answers.
3. The setting saves automatically like the meter switch and survives reload.
4. The seller question preview reflects the setting.
5. The server enforces it; a client that still sends HOA answers while the
   setting is off does not write them.
6. The product update appears at the top of `/dashboard/updates` and re-surfaces
   the dashboard banner; the existing incident-update test is repointed.
7. Decision record amended: opt-out exists, default on, and the gating choice.
8. Lint, type-check, full Vitest; Playwright seller specs on mobile.

## 5. Decisions

1. **Gating:** **free on every plan.** Decided by the owner, 2026-10-01.
2. **Scope of "off":** stops asking only. The owner did not answer this one, so
   the recommended default was built. **Assumption to confirm.**
3. **Team workspaces:** each request follows its owner's own setting, as the
   meter switch does. Also the recommended default, also **an assumption to
   confirm**. A workspace-wide setting would be a follow-up.
4. **Product update:** published by the owner through `/admin/updates`.

## 6. Expected files

`app/dashboard/settings/page.tsx`, `app/dashboard/requests/new/page.tsx`
(preview config), `app/api/seller/[token]/route.ts`, `app/s/[token]/page.tsx`,
`components/seller-form/SellerWizard.tsx`, `steps/HomeBasicsStep.tsx`,
`steps/ReviewStep.tsx`, `lib/packet/seller-questions.ts`,
`lib/product-updates.ts`, tests beside each, the decision record, and
`.ai/CURRENT.md`. Verify the list against the code before starting.

## 7. Risks

- The setting is live, not copied per request, so turning it off changes forms
  already sent. Same as the meter switch; say so in the helper text.
- A paid-only "off" would need a server check and a locked control with an
  upgrade prompt, and would be awkward to introduce after shipping it free.
  Decide before shipping.
- The update banner reaches every account. Copy must be accurate on Free.

## 8. Implementation record (2026-10-01)

Built as designed in section 2.

- `lib/packet/hoa.ts`: `collectsHoaQuestions(preferences)` (on unless explicitly
  false) and `resolveHoaSubmission(body, collectHoaQuestions)`, the single
  decision of whether a seller submission writes HOA answers.
- `app/api/seller/[token]/route.ts`: GET returns `collect_hoa_questions`; POST
  writes HOA answers only when the setting is on and the body carries them, and
  only counts `has_hoa` in telemetry when it was actually stored.
- `SellerWizard.tsx`, `HomeBasicsStep.tsx`, `ReviewStep.tsx`,
  `app/s/[token]/page.tsx`: the question and its review row are hidden when off.
- `app/dashboard/settings/page.tsx`: the switch, beside "Collect electric meter
  number", not gated, saved through the existing preferences call.
- `lib/packet/seller-questions.ts`, `app/dashboard/requests/new/page.tsx`: the
  seller question preview drops the nine HOA questions when off; the full
  inventory still lists them, marked not included.
- No migration. `accounts.notification_preferences` is JSONB and
  `PATCH /api/account` already accepts boolean keys.
- Unchanged on purpose: the packet page, the PDF, and the submitted-sheet
  editor. Existing answers keep printing and stay editable.
- `FEATURED_PRODUCT_UPDATES` unchanged (section 3).

Acceptance criteria 1 to 5, 7, and 8: met. Criterion 6 (the update appears in
the dashboard) is the owner's publish step.

Validation: Vitest **933 passed across 167 files**; `tsc` clean; `npm run build`
succeeded; `npm run security:scan` passed; lint shows only the two pre-existing
unrelated errors; Playwright seller, packet, intake, and test-drive specs pass
on desktop and both mobile browsers (39 runs, mocked APIs), including a new case
with the setting off; the exact seller `UPDATE` statement was re-executed
against in-memory Postgres built from `schema.sql`.

Not verified: the switch on the live Settings page with a real account. The
settings component test covers a Free account turning it off and the saved
payload.
