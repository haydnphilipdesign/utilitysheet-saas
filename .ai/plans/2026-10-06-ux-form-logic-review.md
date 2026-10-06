# UX, form logic, and ease-of-use review

- Status: completed. Findings 2 to 9 implemented and validated on 2026-10-06 (Claude Opus), committed and pushed with finding 1; see "Implementation plan: findings 2 to 9" and its outcome. Finding 1: owner chose policy B on 2026-10-06 (reopen on Free, Pro and Teams); implemented, validated, migration applied to production, committed and pushed to `origin/main` on 2026-10-06. See "Finding 1 implementation plan" and its outcome at the end. Findings 10 and 11 deferred.
- Type: investigation and recommendation only. No product code, commit, push, deploy, migration, live database access, or email.
- Scope: request creation and saved forms, the seller flow (mobile first), drafts and changed answers, review and submit, and the coordinator's receive/edit/share steps.
- Baseline: `main` at 164ccb4, clean worktree.

## How this was checked

- Code reading of the files cited per finding.
- A mocked browser run on the local dev server (iPhone 14 emulation, Chromium). Every `/api` call was fulfilled by the test script and every non-local request was aborted, so no database row, event log, or email was touched. The script and screenshots lived in the session scratch directory, not the repository.
- "Verified" below means seen in code and, where marked (UI), also observed in that run. Server-side effects were verified by reading the route, never by executing it.
- Not checked: real Safari (the iOS zoom point rests on computed font sizes), screen-reader output, the authenticated dashboard in a browser, PDF output.

## Ranked shortlist

| # | Finding | Kind | Impact | Effort |
|---|---------|------|--------|--------|
| 1 | A submitted link is still writable, reopens blank, and can wipe the sheet | Verified (UI + code) | High, data loss | S to M |
| 2 | Provider steps forget the answer when revisited; one edit from Review costs 8 extra taps | Verified (UI) | High, friction and silent answer changes | M |
| 3 | Irrigation details survive a "No" answer | Verified (UI + code) | Medium, contradictory sheet | S |
| 4 | Review shows raw field keys and raw values | Verified (UI) | Medium, trust at the submit moment | S |
| 5 | "5 quick questions" becomes "1 of 11" | Verified (UI) | Medium, expectation | XS |
| 6 | 14px inputs and small tap targets on mobile | Verified sizes, zoom not observed | Medium on iPhone | S |
| 7 | Submitted request page still leads with the seller link | Verified (code) | Medium | XS |
| 8 | Wrong helper under "primary heat source" | Verified (UI + code) | Low | XS |
| 9 | Meter number asked twice; one button erases it | Verified (code) | Low | XS |
| 10 | "Same as Internet" style shortcut for paired utilities | Hypothesis | Medium if common | S to M |
| 11 | Water and sewer start preselected as "Not Sure" | Hypothesis | Unknown, needs data | S |

**Recommended first three: 1, 2, and 3 (do 4 with 3, same file).**

## Findings

### 1. A submitted link is still writable, reopens blank, and can wipe the sheet

1. **Situation.** After submitting, the success screen says "The link is now read-only" and offers "Want a copy? We'll email you a link so you can revisit what you submitted anytime." Marketing copy and a product update say the same. None of it is enforced:
   - `POST /api/seller/[token]` has no status check (only test-drive requests short-circuit). It always overwrites Home Basics and runs `DELETE FROM utility_entries` before reinserting.
   - `GET` returns `status`, but `app/s/[token]/page.tsx` ignores it. Only HOA and handoff answers are prefilled. Home Basics and providers are not.
   - The "copy" email is the reminder template, sent through `send-link`, linking to the same form.
   - The local draft is deleted on success, then rewritten 250ms later by the autosave effect with `currentStep` = Success. (UI: draft present after submit, still containing the garage code typed earlier.)
2. **Why it matters.** In the same browser the seller sees "All Done!" forever, which looks fine by accident. On any other device (phone to laptop, or the emailed "copy" link) they get a blank Welcome screen for a home they already finished. If they tap through, the server replaces every provider with what they just sent. (UI: second submission went out with `electric: unknown`, water and sewer `not_sure`.) That also discards corrections the coordinator made in the submitted-sheet editor, and sends a second completion email. A leftover draft holding access codes on a shared computer is a smaller privacy concern.
3. **Change.** Make the promise true.
   - Server: refuse `POST` with 409 when `status === 'submitted'` (keep the existing test-drive idempotent path).
   - Page: when `GET` says submitted, show an "Already submitted" screen with the agent's contact details instead of the wizard.
   - Wizard: stop autosaving once on Success, so the draft really is removed.
   - Copy: replace "Want a copy? ... revisit what you submitted" with something the product does, or remove the box.
   - Before: laptop revisit shows "Tell us about the home's utilities ... Get Started". After: "You already sent this on Oct 6. Need to change something? Contact Jordan at ...".
4. **Edge cases and tradeoffs.** This reverses a behavior the HOA decision record relies on ("prefills a resubmission"), so it needs an owner decision. The alternative is to keep resubmission and prefill everything, which is larger, and still lets a seller overwrite coordinator edits. Free-plan coordinators cannot edit a submitted sheet, so with read-only links their only correction path is asking the seller to redo it; a coordinator "reopen for seller" action may be wanted later. A tab left open on Review from before submission would get the 409 and needs a clear message. `in_progress` requests are unaffected.
5. **Impact and effort.** High (prevents silent loss of a finished sheet). S to M: one route guard, one screen, one effect condition, copy, tests.
6. **Files.** `app/api/seller/[token]/route.ts` (476, 554 to 582), `app/s/[token]/page.tsx`, `components/seller-form/SellerWizard.tsx` (225 to 252, 595 to 613), `components/seller-form/steps/SuccessStep.tsx` (201, 205 to 232), `app/api/seller/[token]/send-link/route.ts`, `components/landing/FeatureSection.tsx:64`, `lib/product-updates.ts:60`. Previously noted, unfixed: `docs/design/UTILITYSHEET_UX_UI_AUDIT.md:208`.

### 2. Provider steps forget the answer when revisited

1. **Situation.** A provider step in its default view offers suggestions, "Search for another", and "I'm not sure". It never shows the answer already given and has no Continue. (UI: returning to Water showed no selected marker and no Continue button.) Editing a provider from Review, or editing Home Basics from Review, restarts the linear walk. Handoff sections already have a "Save & Return to Review" mode; utilities do not.
2. **Why it matters.** Going Back one step means answering again to move forward. Fixing only the electric provider from Review cost 8 further taps through Water, Sewer, Gas, Oil, Internet, Cable and both handoff sections. Each of those taps is a fresh answer, so a careless tap changes a provider or turns it into "Not sure" without the seller meaning to. The trash schedule screen is also re-walked.
3. **Change.**
   - When a step already has an answer, show it at the top with one primary button: "Your answer: PPL Electric Utilities. Keep and continue", with the existing choices below as "Change".
   - Reuse the `review_edit` idea for utilities: an edit launched from Review returns to Review after that one step.
   - After editing Home Basics from Review, go to the first newly added, unanswered utility, or straight back to Review when none was added.
   - Before: edit electric, then 8 taps. After: edit electric, 1 tap, back on Review.
4. **Edge cases and tradeoffs.** Electric with the meter step and trash with the schedule step should return to Review after their detail screen. If Home Basics edits remove a utility, nothing more is needed (it is already hidden and not stored). A resumed draft should land on the same "keep" view. Slightly more state in the wizard.
5. **Impact and effort.** High for anyone who corrects anything. M: `UtilityStep` view state, one navigation mode, unit tests alongside the existing wizard tests.
6. **Files.** `components/seller-form/steps/UtilityStep.tsx` (325 to 437), `components/seller-form/SellerWizard.tsx` (473 to 550, 750 to 754).

### 3. Irrigation details survive a "No" answer

1. **Situation.** This is the same shape as the HOA problem just fixed. Answering "No" to "Has irrigation system" hides the provider, days, season and notes fields but keeps their values. (UI: after entering a provider and two days, then choosing No, the submitted body was `{"irrigation_provider_name":"GreenSprout Irrigation","watering_days":["mon","wed"],"has_irrigation_system":"no"}` and Review listed all three.) No code in the route, `lib/packet`, or `lib/pdf` drops them.
2. **Why it matters.** The stored sheet says there is no irrigation system and also names its provider and schedule. Packet rendering was not run here, but nothing filters these fields on the way to it.
3. **Change.** Normalize in one shared helper, as `normalizeHoaAnswers` does: when the answer is `no`, keep only `has_irrigation_system`. Apply it on the seller write and in Review. Keep the values in wizard state so switching back to Yes restores them. Before: "No" plus provider and days. After: "No" only.
4. **Edge cases and tradeoffs.** The select displays "Not sure" when nothing is stored, so an untouched question stores nothing; leave that. If the coordinator excluded `has_irrigation_system`, never clear. The submitted-sheet editor has its own irrigation handling (line 1090) and should use the same helper. Existing stored rows stay as they are unless the owner wants a cleanup.
5. **Impact and effort.** Medium. S.
6. **Files.** `components/seller-form/steps/AdvancedDetailsStep.tsx` (147 to 148, 243 to 380), `app/api/seller/[token]/route.ts` (529 to 543), `lib/packet/modules.ts`, `components/requests/SubmittedSheetEditor.tsx:1090`.

### 4. Review shows raw field keys and raw values

1. **Situation.** Handoff rows on Review print the storage key and value: "has irrigation system: no", "watering days: mon, wed", "garage door code: 4321", months as "apr". Fuels print as "Oil" while the question said "Heating Oil". (UI.)
2. **Why it matters.** Review is where the seller decides the answers are right. Lower-case keys and codes read as unfinished and are harder to scan than the labels they just saw.
3. **Change.** Use the labels in `ADVANCED_MODULE_FIELD_METADATA`, `getFuelSourceLabel`, and day and month formatting. Before: "watering days: mon, wed". After: "Watering Days: Mon, Wed".
4. **Edge cases.** Hide rows cleared by finding 3. Check whether the packet already has formatters to share rather than adding new ones.
5. **Impact and effort.** Medium, S.
6. **Files.** `components/seller-form/steps/ReviewStep.tsx` (153 to 172, 283 to 320), `lib/packet/modules.ts`.

### 5. "5 quick questions" becomes "1 of 11"

1. **Situation.** Welcome counts steps before the seller has said which utilities exist, so it assumes one. (UI: "5 quick questions, about 3 to 4 minutes", header "1 of 5", then "1 of 11" once Home Basics was answered.) It also calls steps "questions"; Home Basics alone has five or more.
2. **Why it matters.** The first promise is broken on the first screen, and the time estimate is low for a full home.
3. **Change.** Drop the count from Welcome ("A few short steps, about 3 to 5 minutes") and base minutes on the requested categories. In the header, show the step total only after Home Basics, or keep the percentage alone on that step.
4. **Tradeoffs.** A range is less punchy than a number but is true.
5. **Impact and effort.** Medium, XS.
6. **Files.** `components/seller-form/SellerWizard.tsx` (445 to 454, 681 to 698), `components/seller-form/steps/WelcomeStep.tsx` (25 to 30, 81 to 85), `components/seller-form/SellerLayout.tsx:269`.

### 6. Mobile inputs and tap targets

1. **Situation.** Verified sizes at phone width: meter number input 14px, every handoff field 14px (also the Review meter field, the save-link email, and the success email field by class). Review edit pencil 26x26. Watering presets 27px tall. HOA detail inputs are already 16px on mobile.
2. **Why it matters.** iPhone Safari zooms the page when a focused input is under 16px, which was not observed here because the run used Chromium. Small targets cause mis-taps, and on Review a mis-tap starts the re-walk in finding 2.
3. **Change.** `text-base sm:text-sm` on those inputs (the HOA fields show the pattern); 44px minimum hit areas for the pencil and presets. Same pass: add `wizardFocusRing` to the handoff step buttons, give the icon-only pencil an `aria-label` instead of `title`, and wrap the Home Basics button groups in `role="group"` with `aria-labelledby` (their `<label>` elements point at nothing). When Continue is disabled for a pending HOA reselection, repeat the reason next to the button; today the explanation is a full screen above it on a phone.
4. **Tradeoffs.** None of substance. Visual check on desktop.
5. **Impact and effort.** Medium on iPhone, S.
6. **Files.** `AdvancedDetailsStep.tsx` (61 to 104, 294 to 302, 611 to 635), `UtilityStep.tsx:569`, `ReviewStep.tsx` (236 to 243, 259), `SellerLayout.tsx:108`, `SuccessStep.tsx:218`, `HomeBasicsStep.tsx` (124, 150 to 154, 158, 185, 490 to 498).

### 7. Submitted request page still leads with the seller link

1. **Situation.** On a submitted request the first header button is still "Copy Seller Link". The info sheet link sits lower in a Links list, and Download PDF is in a side card.
2. **Why it matters.** After submission the coordinator's job is sharing the sheet. The most prominent action copies a link that, until finding 1 is fixed, can erase it.
3. **Change.** When status is submitted, make the header action "Copy info sheet link" and list the info sheet first. Before: [Copy Seller Link] [Delete]. After: [Copy info sheet link] [Delete].
4. **Edge cases.** Locked requests already use a separate view. Keep the seller link visible in the list.
5. **Impact and effort.** Medium, XS.
6. **Files.** `app/dashboard/requests/[id]/page.tsx` (301 to 334, 367 to 427).

### 8. Wrong helper under "primary heat source"

1. **Situation.** With two fuels the form asks "Which is the primary heat source?" and says "This determines which heating provider we ask about next." It does not: every selected fuel gets a provider step (UI: gas and oil were both asked). The answer is what prints as Heating Type. It is also preselected to whichever fuel was tapped first.
2. **Why it matters.** The seller is told the wrong consequence, and may leave an accidental default that becomes the sheet's heating type.
3. **Change.** Helper: "Shown as the home's heating type on the sheet." Update the matching inventory text.
4. **Tradeoff.** Removing the preselection would add a required tap; not recommended without evidence.
5. **Impact and effort.** Low, XS.
6. **Files.** `HomeBasicsStep.tsx` (234 to 243, 275), `lib/packet/seller-questions.ts:290`.

### 9. Meter number asked twice; one button erases it

1. **Situation.** The meter number has its own screen after the electric provider and an editable field on Review. The screen has "Continue" and "Continue without meter number"; the second clears whatever was typed.
2. **Why it matters.** Two buttons for an optional field, one of them destructive, and the same field again later.
3. **Change.** One Continue on the meter screen. Keep the Review field as the place to add it late.
4. **Tradeoff.** Loses an explicit "skip" label; "(optional)" already says it.
5. **Impact and effort.** Low, XS.
6. **Files.** `UtilityStep.tsx` (269 to 276, 577 to 592), `ReviewStep.tsx` (247 to 263).

### 10. Hypothesis: "Same as Internet" shortcut

1. **Situation.** Internet and Cable/TV, and Water and Sewer, are asked as separate steps with separate suggestion lists. In the mocked run the seller picked the same company twice.
2. **Why it might matter.** When the earlier answer is the right one, the seller searches or scans a second time.
3. **Change.** On Cable/TV, when Internet has a named provider, offer "Same as Internet: Service Electric" as the first choice. Same for Sewer after Water.
4. **Tradeoffs.** Water and sewer are different authorities in many towns, so this must stay an offer and never a default. Contact details differ by service, so reuse the name only and let contact resolution run per category.
5. **Impact and effort.** Unknown until measured. S to M. Check first: how often the two names match in existing submissions (an owner-authorized aggregate query).
6. **Files.** `UtilityStep.tsx`, `SellerWizard.tsx` (712 to 726).

### 11. Hypothesis: water and sewer start as "Not Sure"

1. **Situation.** Both questions open with "Not Sure" already selected (UI), so Continue works on an untouched page and Review shows "Not Sure" as if answered. Trash, Internet and Cable are opt-in below a divider labelled Optional.
2. **Why it might matter.** A seller who scrolls straight to Continue is never asked for water or sewer providers, and optional utilities the coordinator requested are skipped unless noticed.
3. **Change to consider.** No preselection for water and sewer, with Continue asking for a tap (Not Sure stays one tap).
4. **Tradeoffs.** Two more required taps for everyone. Fewer questions is not the goal here, accurate answers are, but this should be decided on data.
5. **Evidence needed.** The share of submissions with both values `not_sure`, and of requested optional utilities with no entry. The Admin telemetry reports may already answer this.
6. **Files.** `SellerWizard.tsx` (150 to 165), `HomeBasicsStep.tsx` (366 to 429).

## Looked at and not recommended

- Creation and saved forms: the saved-form preview runs the real `SellerWizard`, so the preview and the live form cannot drift in questions or order. The preview has no provider suggestions (it shows the "Help us find your provider" state), which is acceptable for a preview. Revision conflicts and unsaved changes already have recovery paths.
- Request configuration locks once the seller opens the link, so a stale local draft cannot disagree with a later configuration change.
- Submitted-sheet editor: unsaved-change guard and "needs attention" list exist. It allows HOA "No" with water "Included in HOA / condo fee"; the 2026-10-06 decision deliberately left coordinator editing alone. A non-blocking hint is possible later.
- Reusable intake address step: validation, focus handling and recovery are sound.

## Suggested implementation order

1. Finding 1. Needs the owner's call between read-only (recommended) and prefilled resubmission, and a decision record amendment because it changes the resubmission behavior described in `2026-10-01-hoa-questions-in-home-basics.md`. Public route: keep token checks and rate limiting as they are.
2. Finding 2.
3. Findings 3 and 4 together.
4. Findings 5 to 9 as one small polish change.
5. Findings 10 and 11 only after the data check.

Validation for any of these: focused Vitest beside `tests/unit/seller-wizard-hoa-flow.test.tsx`, the mocked `tests/seller-wizard-journey.spec.ts` on Desktop Chrome and a mobile project, TypeScript, focused ESLint.


## Independent verification by Codex (2026-10-06)

Status: verification complete; no product implementation authorized or performed. Baseline main at 164ccb4; original Opus findings above preserved. Owner should use the qualifications below when approving implementation.

### Method and evidence

Read seller GET/POST, seller page, wizard/navigation/autosave, utility/advanced/review/welcome/success components, request detail actions, send-link, submitted-sheet gating and merge helpers, packet data formatting, and related tests. Three temporary Vitest checks used the existing seller-route mock setup, with database, email, rate limits, telemetry and referral side effects mocked. All three passed, confirming current problematic behavior:

1. An ordinary request already marked submitted returns 200 and calls DELETE FROM utility_entries.
2. Irrigation No plus a synthetic provider and watering days survives parsing/filtering and is passed to the request UPDATE.
3. An injected utility INSERT failure returns 500 after the route has already issued the submitted-status UPDATE and provider DELETE as separate calls.

The temporary test was removed after execution. These prove application control flow/payload behavior, not actual database rollback or concurrent transaction behavior. No database/network/email actions, browser rerun, real Safari, screen reader or PDF rendering in this verification pass. Original Opus UI measurements remain attributed to that audit, including the eight-tap count and exact pixel sizes.

### Verdict and required implementation refinements

- **1 confirmed; proposed fix incomplete and effort understated.** The current link is not read-only, and missing provider/Home Basics prefill makes repeat submission destructive. A preliminary status check alone is insufficient: two submissions can both read in_progress, and the route currently sets submitted before deleting/inserting providers. A later write failure followed by a read-only guard would strand an incomplete sheet. Require atomic request/provider persistence, concurrency-safe status enforcement, safe handling of retry after a lost response, and completion side effects only for the accepted submission. Put database changes under lib/neon, using supported transaction patterns; no live migration is authorized. Cover simultaneous submissions, injected persistence failure, already-submitted stale tabs and retry-after-commit. Do not apply the new guard alone as a quick patch.
- **1 product policy remains undecided.** Read-only is consistent with displayed promises, but not the only existing intent: the route's metering comment explicitly anticipates resubmissions, HOA tests/decision records do too, and customer reminder tests explicitly permit reminders on submitted requests. Reconcile those behaviors/copy and tests. The generic authenticated request PATCH currently accepts status changes, so define whether an owner-controlled reopening is intended. The claim that a new request is the only correction path is a statement about the visible workflow, not all API capabilities. Do not silently introduce reopening or change paid editing entitlements. Do not invent a submission date or guarantee contact details: current seller GET does not supply a submitted timestamp and branding contact fields are optional.
- **2 confirmed with wording correction.** Provider values remain in WizardState; the UI resets to view mode and does not reflect them or provide Keep/Continue. Review editing then follows linear navigation. Test suggested/search/manual/unknown answers, retained meter/trash details, and Back/cancel/resume. After editing Home Basics, account for newly enabled handoff modules as well as newly applicable utilities before returning to Review; the proposed utility-only shortcut can skip new handoff sections.
- **3 confirmed.** Shared conditional normalization should cover seller writes, Review and the authenticated editor write boundary, while preserving reversible in-memory Yes/No edits. Exclusion handling matters: mergeAdvancedPacketDataPreservingExcluded deliberately restores excluded existing fields. Define normalization order so a hidden old No cannot erase visible answers and excluded stored fields are not accidentally destroyed. Test gate-excluded, details-excluded, No-to-Yes, and ordinary No cases. No historical-data cleanup authorized.
- **4 confirmed.** Review derives labels from storage keys and joins raw values. Metadata should drive labels; use field-specific formatting for enums/days/months, leaving free text and access codes untouched. Packet formatting currently also joins arrays and only special-cases Yes/No, so do not assume a complete shared formatter already exists.
- **5 confirmed.** Totals depend on selected utilities, and Welcome calls steps questions. Fix that mismatch; any new fixed minute range is an estimate, not validated completion-time data.
- **6 supported by source classes; exact dimensions/Safari zoom not independently reproduced.** Input typography, small edit controls and missing explicit group labelling warrant polish. A title supplies a fallback accessible name, so the pencil is not proven unnamed; an explicit aria-label is still clearer. Do not call this a completed accessibility audit.
- **7 and 8 confirmed.** Header action unconditionally copies the seller link, and fuel provider steps are driven by all selected fuels, not primary heating type.
- **9 behavior confirmed; lower-priority design choice.** Continue without meter number explicitly clears the value. An editable Review field is useful and is not inherently a second required question. Simplify the meter step while retaining late correction on Review.
- **10/11 remain hypotheses.** Existing preselection is verifiable, but its abandonment/accuracy impact is not. Do not automatically copy provider identities or add required answers without a product decision. No production aggregate query authorized here.

Recommendation: approve 2, 3/4 and the bounded 5-9 polish after these refinements. Treat 1 as the highest-priority data-integrity workstream with an explicit post-submission/correction policy and a stronger implementation plan before editing. No required verification work remains; product fixes remain unimplemented and await owner scope/policy selection.


## Implementation plan: findings 2 to 9 (authorized 2026-10-06, Claude Opus)

Status: completed 2026-10-06, committed and pushed with finding 1. Owner authorized findings 2 to 9 with Codex's qualifications. Not authorized: finding 1 (proposal only, below once written), findings 10 and 11, production queries, billing or entitlement changes, historical cleanup, migrations, commit, push, deploy, real email.

### Batch A: irrigation normalization and Review labels (findings 3, 4)

- One shared helper in `lib/packet/modules.ts`: when the irrigation gate question is visible under the request's exclusions and the submitted answer is `no`, keep only the gate answer from the submitted visible data.
- Order at both write boundaries (seller `POST`, coordinator `PATCH submitted-data`): filter by exclusions, then normalize, then `mergeAdvancedPacketDataPreservingExcluded`. Consequences, each covered by a test:
  - ordinary No: visible details are not stored;
  - gate excluded: nothing is cleared, so a hidden stored No cannot erase visible answers;
  - details excluded: stored excluded fields are still restored by the merge, untouched;
  - No then Yes in the form: values stay in wizard or editor memory and are sent again.
- Review uses the same helper for display, labels from `ADVANCED_MODULE_FIELD_METADATA`, and a formatter limited to the choice, weekday and month fields. Free text and access codes pass through unchanged. Fuel names use `getFuelSourceLabel`.
- Known side effect, not a cleanup: a stored sheet that already holds No plus details loses the visible details the next time a coordinator saves it. No bulk rewrite.
- Packet and PDF renderers are not changed.

### Batch B: provider answers and navigation (finding 2)

- `UtilityStep`: when the category already has an answer, show it with "Keep this answer" above the existing choices. Keep leads to the meter or trash detail screen where one applies, otherwise onward. Works after Back, cancelled search, "Change provider", and a restored draft, because it reads wizard state.
- `SellerWizard`: one navigation mode replaces the advanced-only one.
  - `review_edit`: an edit started from a Review row (provider or handoff section) returns to Review after that step, including its meter or trash screen.
  - `catch_up`: after Home Basics is edited from Review, Continue goes to each newly applicable provider step with no answer, then each handoff section that was not enabled before the edit, then Review. If there are none it returns straight to Review.
- The mode and the pre-edit handoff list are saved in the local draft. Old drafts (`advancedNavigationMode`) still restore.

### Batch C: copy, sizing, links, meter (findings 5 to 9)

- 5: Welcome no longer states a question count or a minute estimate. The header shows "N of M" only after Home Basics, when the total is known.
- 6: 16px inputs on phones for handoff fields, meter fields, and the two email fields; 44px targets for Review edit controls and watering chips; focus rings on handoff buttons; explicit `aria-label` on icon-only edit buttons (title kept); Home Basics choice groups labelled with `role="group"`; the reason Continue is disabled is repeated beside the button. This is polish, not an accessibility audit.
- 7: on a submitted, unlocked request the header action copies the info sheet link and the info sheet row is listed first. The seller link stays available in the list.
- 8: helper under primary heat source now says what the answer is used for, in the form and the question inventory.
- 9: the meter screen has one Continue. The editable Review field stays.

### Validation

Focused Vitest for each batch (new and updated), `tsc --noEmit`, ESLint on changed files, mocked Playwright seller journey on Desktop Chrome and Mobile Chrome, `git diff --check`.

### Outcome (2026-10-06)

All three batches are implemented as planned. No required work remains for findings 2 to 9.

Deviations and additions, recorded honestly:

- Draft resume fix (not in the original plan). The list of applicable provider steps was computed in an effect, one render after a draft was restored, so a draft saved on a later provider step was clamped back to the first one. It is now derived during render. Found by the new draft-restoration test.
- The coordinator editor also hides the irrigation detail fields while the answer is No and says they are left off the sheet. Without this the fields would stay visible and then vanish on save.
- Finding 5: the minute estimate was removed from the seller Welcome screen rather than replaced. Older copy elsewhere still says "about 2 minutes" or "2 to 3 minutes" (reusable intake page, dashboard share text, test-drive card). Those were not touched; they are existing claims, not new ones.
- Finding 7 has no automated test. The request detail page needs a signed-in session, and no fixture exists for it. Verified by type-check, lint and reading the diff only.
- Packet and PDF output still print handoff values with their own formatting (for example "mon, wed"). Review now reads better than the packet for those fields. Changing the packet is a PDF-system change and was out of scope.
- Observed, not changed: each wizard step slides in from 20px to the right, which makes the page 4px wider than a phone screen for the length of the animation.

Files changed:

- `lib/packet/modules.ts` (normalizer, Review row builder), `lib/packet/seller-questions.ts`
- `app/api/seller/[token]/route.ts`, `app/api/requests/[id]/submitted-data/route.ts`
- `components/seller-form/SellerWizard.tsx`, `SellerLayout.tsx`, `steps/{UtilityStep,ReviewStep,HomeBasicsStep,AdvancedDetailsStep,WelcomeStep,SuccessStep}.tsx`
- `components/requests/SubmittedSheetEditor.tsx`, `app/dashboard/requests/[id]/page.tsx`
- New tests: `tests/unit/advanced-conditional-answers.test.ts`, `tests/unit/seller-wizard-review-navigation.test.tsx`, `tests/seller-wizard-review-edit.spec.ts`. Updated: `tests/unit/utility-step-meter-flow.test.tsx`, `tests/unit/submitted-data-route.test.ts`.

Validation (Node 22.22.2; CI uses 20):

- Full Vitest: 192 files passed, 1 skipped; 1242 tests passed, 8 skipped.
- `tsc --noEmit`: clean.
- ESLint on every changed and new file: 0 errors, 8 warnings, all pre-existing (6 hook-dependency warnings in SellerWizard, 2 `<img>` warnings in SellerLayout).
- Playwright, mocked APIs, Desktop Chrome and Mobile Chrome: seller flow, wizard journey, the new review-edit spec, saved-form preview, and intake. 37 passed, 1 skipped by design (the phone-size check does not run on desktop).
- `git diff --check`: clean.
- Not run: Mobile Safari project, real iPhone, screen reader, PDF rendering, the signed-in dashboard in a browser, `next build`.

## Finding 1 proposal: what happens after a seller submits (not authorized, decision needed)

Status: superseded where it differs by "Finding 1 implementation plan (policy B)" below. Kept as the record of what was proposed.

### Verified starting point

- `POST /api/seller/[token]` issues separate statements: update the request and set `submitted`, delete all provider rows, then insert them one at a time. A failure after the first statement leaves a request marked submitted with missing providers. There is no status condition on the update.
- `updateSubmittedRequestData` in `lib/neon/queries/requests.ts` already shows the supported pattern: one statement with chained CTEs inside `sql.transaction`, conditional on status, that updates the request, replaces provider rows from a JSON recordset, and writes the event.
- The generic `PATCH /api/requests/[id]` accepts any of the four statuses. No current dashboard screen was found calling it with a status.
- The customer reminder route still allows reminding a submitted request (a test asserts this). The Admin reminder path refuses submitted requests.
- "Want a copy?" and "Email me this link" both send the reminder email through `send-link`.
- The seller `GET` returns HOA and handoff answers to anyone holding the seller link, before and after submission.

### Recommended policy: final on submit, with a coordinator-controlled reopen

1. Once a submission is accepted, the seller link is read-only. This is what the success screen, the marketing page and the product update already say.
2. Corrections happen in one of two ways: the coordinator edits the sheet (Pro and Teams, as today), or the coordinator reopens the request so the seller can correct it, starting from the stored answers.
3. A reopened request goes back to `in_progress`, keeps its `metered_at` so it is never counted twice, and becomes read-only again when resubmitted.

Tradeoffs against the alternatives:

| Policy | For | Against |
|--------|-----|---------|
| A. Final, no reopen | Smallest change. Coordinator edits can never be overwritten. | A Free customer's only correction path is a new request, which uses another monthly submission. |
| B. Final, coordinator can reopen (recommended) | Promise kept. Free customers have a correction path. The coordinator decides when their edits may be replaced. | A new action to build and explain. Needs a decision on whether Free gets it. |
| C. Seller can always resubmit, with everything prefilled | No coordinator action needed. Matches the older HOA decision text. | The read-only promise must be withdrawn everywhere. A seller can silently replace coordinator edits. Every resubmission sends another completion email. |

### 1. Atomic persistence

- New `submitSellerRequest` in `lib/neon/queries/requests.ts`, modelled on `updateSubmittedRequestData`: one CTE statement in `sql.transaction` that updates the request with `WHERE id = ... AND status IN ('draft', 'sent', 'in_progress') AND deleted_at IS NULL RETURNING *`, deletes that request's provider rows, inserts the new rows from a JSON recordset (including `canonical_id` and `confidence_score`, which the editor path does not write), and inserts the `seller_submitted` event. Either all of it is stored or none of it.
- The route computes everything first (validation, normalization, the Free-limit lock decision), then makes that one call.
- Work that calls other services stays outside the transaction and runs only after it commits: provider contact lookup (it already only fills contact fields afterwards), AI suggestion marking, referral credit, emails. A failure there never affects what was stored.
- No schema change is required for this part.

### 2. Simultaneous submissions

- The conditional `UPDATE` takes the row lock. A second submission waits, then re-checks the status, matches no row, and returns nothing. That caller is the loser.
- The loser causes no deletes, no inserts, no event, no email, and no referral credit, because all of those hang off the returned row.
- Not solved by this, and already true today: two different requests submitted at the same moment can both pass the Free monthly limit check. Worth a separate look, not part of this change.

### 3. Retry after a committed submission whose response was lost

- The wizard creates a random submission key the first time Submit is pressed, keeps it in the local draft, and sends it with every attempt.
- The key is stored in the `seller_submitted` event data, inside the same transaction. No new column, so no migration. It is random, not personal data.
- When the conditional update matches no row, the route looks for a `seller_submitted` event on that request with the same key. Found: answer `200` with `alreadySubmitted: true` and run no side effects. Not found: answer `409 ALREADY_SUBMITTED`.
- A wizard tab loaded before this ships sends no key and gets the 409; the page then shows the already-submitted screen. Its answers were stored the first time.
- Alternative if event data is the wrong home: a nullable `submission_key` column on `requests`. That needs a migration and separate authorization.

### 4. Screens, stale tabs, drafts, email and copy

- `GET` for a submitted request returns only what the screen needs: address, branding, status. It stops returning HOA and handoff answers once submitted.
- `/s/[token]` shows an "Already submitted" screen when the status is submitted. No invented date (there is no submission timestamp column) and no promised contact details: it shows the brand's email or phone when they exist, otherwise "contact your agent".
- A stale tab that receives the 409 switches to the same screen and clears its draft.
- Drafts: stop autosaving once on the success screen (today the draft is rewritten after submission and keeps every answer, including access codes), and clear any draft when `GET` reports submitted.
- "Want a copy?": remove it. It sends a reminder to fill in the form and cannot show a copy. A real confirmation email would be a new template and a separate decision.
- `send-link` refuses submitted requests, so the reminder template is never sent for a finished form.
- Success copy stays "The link is now read-only", which becomes true. The marketing line and product update need no change under A or B. Under C all three must be rewritten.

### 5. Existing status-change and reminder paths

- Generic `PATCH /api/requests/[id]`: stop it from moving a request into or out of `submitted`. Entering `submitted` belongs to the seller submission, leaving it belongs to reopen.
- Reopen (policy B only): a dedicated authenticated action, authorized server-side against the request's account or workspace, that sets `in_progress`, writes a `request_reopened` event, and leaves stored answers and `metered_at` alone.
- Customer reminders: refuse a submitted request, matching the Admin path. A reopened request is `in_progress`, so it can be reminded. The test that asserts the old behavior changes with it.
- Admin status corrections (decision record 2026-10-05) should be checked against the same rule before implementation.

### 6. Corrections for Free customers and protection of coordinator edits

- Under B, reopen is the Free correction path. It adds a capability to Free and does not change submitted-sheet editing, which stays Pro and Teams. Whether Free gets reopen is the owner's call.
- On a reopened request the seller form is prefilled from the stored sheet (Home Basics, providers, meter, trash schedule, HOA, handoff answers). The seller starts from the current sheet, including any coordinator corrections, so nothing changes unless the seller changes it.
- The reopen dialog says plainly that the seller's next submission replaces the sheet.
- Prefill needs a mapping from stored provider rows back to wizard state, with tests for "Not sure", typed-in names and hidden categories.

### Suggested phases

1. Integrity, no policy choice beyond "final": sections 1 to 4, the PATCH restriction, the reminder change, and tests for simultaneous submissions, an injected persistence failure, a stale tab, and retry after commit. No migration.
2. Reopen and prefill (policy B), after the owner decides who gets it.

Phase 1 alone is policy A. It is safe to ship first, but until phase 2 a Free customer who needs a correction has to send a new request.

### Decision needed from the owner

Choose A, B or C. If B: is reopen available on the Free plan, or Pro and Teams only? A decision record should amend `2026-10-01-hoa-questions-in-home-basics.md`, which describes resubmission as intended.


## Finding 1 implementation plan (policy B, authorized 2026-10-06)

Status: completed 2026-10-06 (Claude Opus). Migration applied, committed and pushed on owner authorization. Decision record: `.ai/decisions/2026-10-06-read-only-after-submission-and-reopen.md`.

Owner decision: a submitted request is read-only until an authorized coordinator reopens it. Reopen is available on Free, Pro and Teams. Resubmitting the same request never uses another monthly submission. Direct coordinator editing keeps its existing paid-plan rule. Reopening sends no email; a reminder stays a separate action. Built as one feature, not a read-only phase followed later by reopen.

Constraints kept from the owner's interrupted first message, enforced server-side: property address, owner account, workspace, `metered_at` and an existing over-limit lock never change through reopen or resubmission, and a locked sheet cannot be reopened. A different property needs a new request.

### Editing sessions (changes the earlier proposal)

- Each request has a `seller_edit_version` on its own row, starting at 0. Reopen and "close without changes" each add 1.
- The seller form receives the version from `GET` and sends it back with the submission. The submission statement locks the request row and accepts only when the request is not submitted and the version matches.
- Why a column and not a count of reopen events: a tab from the old session that submits at the same instant as a reopen would wait on the row lock, then compare against an event count taken before the reopen committed, and be accepted. A value on the locked row is re-read after the wait, so that tab is refused.
- The retry key moves from event data to `seller_submission_key` on the same row, for the same reason. It is cleared on reopen, and a retry counts as a duplicate only when the request is submitted, the version matches, and the key matches. A key from an earlier session can never match.
- Local drafts are stamped with the version. A draft with a different version (or none, when the server version is above 0) is discarded and the form starts from the stored answers, so an old draft cannot override coordinator corrections. A draft from the current session is kept.

### Migration (prepared, not run)

`migrations-seller-edit-sessions.sql`: two additive columns on `requests`, `seller_edit_version INTEGER NOT NULL DEFAULT 0` and `seller_submission_key TEXT`. Mirrored in `schema.sql`. It must be applied before this code is deployed, because the submission statement reads both columns; the currently deployed code ignores them, so applying first is safe. Running it needs separate owner authorization.

### Server

- `lib/neon/queries/seller-submission.ts`, statements in the executor style so they run unchanged against the embedded PostgreSQL test database:
  - `submitSellerRequest`: one statement. Lock the row, decide (accepted, duplicate, already submitted, stale session, not found), then update the request, replace provider rows, and write the `seller_submitted` event. It never writes address, owner, workspace, tokens or configuration. `metered_at` is set only when empty, and the lock columns only when this first counted submission is over the limit, exactly as today.
  - `reopenSubmittedRequest` and `cancelRequestReopen`: one statement each, with an event (`request_reopened`, `request_reopen_cancelled`). Refused for deleted, test-drive, locked, or wrong-status requests.
- Seller `POST`: validate and compute first, one persistence call, then side effects (contact lookup, suggestion marking, referral credit, emails) only for an accepted submission. A persistence failure stores nothing and sends nothing. On a resubmission a contact the sheet already had is kept instead of being replaced by lookup.
- Seller `GET`: returns the version. For a submitted request it returns only address, branding and status. For a reopened request it also returns the stored answers for prefill.
- `send-link` refuses submitted requests.
- `POST` and `DELETE /api/requests/[id]/reopen`: signed-in, authorized against the request's owner or active workspace like the other request routes, no request body read, rate limited, no email.
- Generic `PATCH /api/requests/[id]` can no longer move a request into or out of submitted.
- Customer reminders refuse a submitted request (matching Admin). After a reopen the request is in progress and can be reminded by the coordinator. Admin reminders keep their stricter rule and still refuse any metered request.
- Admin status correction is unchanged: it can already restore a metered in-progress request to submitted, which now also acts as an Admin-side close of a reopen.

### Seller form

- Submitted: an "Already submitted" screen, and the local draft is cleared.
- Reopened: starts on Review with the stored answers and a short notice. Providers map back from stored rows; fuel choices are rebuilt from the stored heating type and fuel providers.
- A stale tab gets a clear message and a Reload button, or the already-submitted screen.
- One retry key per Submit press, reused on retry, kept in the draft.
- No autosave after success. "Want a copy?" is removed.

### Dashboard

- Submitted, unlocked request: "Reopen for Seller" with a confirmation that states the consequences (seller link editable again, info sheet link unavailable until resubmitted, the next submission replaces the sheet, no extra submission used, no email sent).
- Reopened request: a notice with "Close Without Changes", which restores the sheet as it was.

### Known consequences to state plainly

- While reopened, the public info sheet and PDF are unavailable, because they require a submitted request. "Close Without Changes" is the way back.
- A resubmission replaces the whole sheet. A provider the coordinator added under a utility the form does not ask about for that home (for example a water company on a well) is not carried through.

### Tests

Embedded PostgreSQL against the real schema plus the migration: acceptance, atomic rollback on a failing provider row, already submitted, stale version, duplicate key, key from an earlier session, repeated reopen and resubmit cycles, metering and lock preserved, address and ownership unchanged, reopen refusals, cancel. Route tests: side effects only on acceptance, crafted payloads ignored, authorization, no email on reopen, minimal `GET` when submitted, prefill when reopened, reminder and status-change rules. Wizard tests: prefill, stale and current drafts, stale-tab responses, retry key reuse, no autosave after success. Mocked browser tests on desktop and mobile. Two-connection lock behavior cannot be shown in the single-connection test database; that needs the separate concurrency harness and a real PostgreSQL.

### Outcome (2026-10-06)

The whole feature is implemented: atomic submission, editing sessions, read-only screen, coordinator reopen and close, prefill from the stored sheet, and the dashboard actions. No required implementation work remains. One release step remains and is the owner's: apply the migration, then deploy.

Release order, which matters:

1. Apply `migrations-seller-edit-sessions.sql`. Not run. It is additive and the code deployed today ignores the new columns.
2. Deploy this code. If it is deployed first, every seller submission and every reopen fails with an error (nothing is corrupted, and the seller's answers stay in their browser draft), because the statements read columns that do not exist yet.

Deviations and additions:

- The retry key and session number are columns on the request row, not event data, as explained under "Editing sessions". This is the reason a migration is needed.
- "Close Without Changes" was added. Without it a mistaken reopen would leave the info sheet offline until the seller submitted again.
- The already-submitted screen names the agent and relies on the existing page footer for contact details, instead of repeating them.
- A reopened form opens directly on Review with a short notice, not on Welcome.
- The retry key is tied to a fingerprint of the answers: an unchanged retry reuses it, changed answers get a new one.
- On a resubmission, a provider contact that came from the stored sheet is kept and is not replaced by the contact lookup.
- Tests that inspected the old route text (`test-drive-seller-safety`, `award-referral-credit`) and two that mocked its individual statements now point at the single persistence call.
- Customer reminders refuse submitted requests; the test that asserted the opposite was changed, and the reminder decision record is amended.

Files added: `migrations-seller-edit-sessions.sql`, `lib/neon/queries/seller-submission.ts`, `lib/seller-form/prefill.ts`, `app/api/requests/[id]/reopen/route.ts`, `components/requests/ReopenRequestDialog.tsx`, `components/seller-form/steps/SellerStatusNotice.tsx`, and tests `tests/unit/{seller-submission-atomic,seller-post-submission-routes,seller-wizard-reopen}.test.ts(x)`, `tests/unit/reopen-request-dialog.test.tsx`, `tests/seller-reopen.spec.ts`.

Files changed: `schema.sql`, `types/index.ts`, `lib/validation/schemas.ts`, `app/api/seller/[token]/{route,send-link/route}.ts`, `app/api/requests/[id]/{route,remind/route}.ts`, `app/s/[token]/page.tsx`, `app/dashboard/requests/[id]/page.tsx`, `components/seller-form/{SellerWizard.tsx,steps/ReviewStep.tsx,steps/SuccessStep.tsx}`, `tests/concurrency/{run.ts,README.md}`, and the adjusted tests named above.

Validation (Node 22.22.2; CI uses 20):

- Full Vitest: 196 files passed, 1 skipped; 1304 tests passed, 8 skipped. This includes 18 tests of the real statements against embedded PostgreSQL loaded from `schema.sql` plus the migration (which also shows the migration applies cleanly on top of the snapshot).
- Concurrency harness (`tests/concurrency/run.ts`) against a disposable local PostgreSQL 18 with two real connections: all 20 checks passed, 8 of them new. They cover simultaneous submissions, the same key twice, an old-session submission waiting behind an uncommitted reopen and then being refused, an old-session retry key, two reopens at once, and a resubmission racing a close. The harness packages were installed in the session scratch directory, not the repository.
- `tsc --noEmit` clean. ESLint on every changed and new file: 0 errors, 8 pre-existing warnings.
- Playwright with mocked APIs on Desktop Chrome and Mobile Chrome: 43 passed, 1 skipped by design.
- `git diff --check` clean. `npm run security:scan` passed; new files read for secrets, none.

Not verified:

- Nothing ran against Neon. The Neon HTTP driver executes each statement as its own transaction, which is what the tests model, but the statements have not run on the hosted database.
- The request detail page (reopen button, reopened notice, close action) has no browser test, because there is no signed-in fixture for it. Its dialog has a unit test and the routes behind it are tested.
- Mobile Safari, a real iPhone, screen readers, PDF output, and `next build` were not run.

Remaining limitations:

- While a request is reopened its public info sheet and PDF are unavailable.
- A resubmission replaces the whole sheet. A provider stored under a utility the form does not ask about for that home is not carried through. The stored list of fuels is rebuilt from the heating type and fuel providers, since only one heating type is stored.
- Admin reminders still refuse a reopened request (it is metered). Coordinator reminders work.
- Two different requests submitted at the same moment can still both pass the Free monthly limit check. Unchanged by this work.
- Admin request pages do not label the two new timeline events (`request_reopened`, `request_reopen_cancelled`) specially.
- No customer-facing announcement or help text was written.

### Release (2026-10-06)

The owner authorized applying the migration and pushing to GitHub `main`. Done in the required order: migration first, then commit and push.

- Production migration applied 2026-10-06 by Claude Opus on explicit owner authorization: `migrations-seller-edit-sessions.sql`, 2 statements in one Neon HTTP transaction against the `.env.local` target (`neondb/public`, PostgreSQL 17.11, sanitized host fingerprint `79d6a988e446`, the same target as earlier recorded production migrations). Preflight: neither column existed. After: `seller_edit_version` (integer, not null, default 0) and `seller_submission_key` (text, nullable) present; all 972 requests at version 0 with no key; counts unchanged (160 accounts, 972 requests, 768 submitted, 3537 utility entries, 11022 events).
- Committed on `main` on top of 164ccb4 as "Make submitted requests read-only with coordinator reopen and smooth the seller form", containing findings 2 to 9 and finding 1, and pushed to `origin/main`.
- Not verified from here: whether the push produced a healthy production deployment, and the feature running against the hosted database.
