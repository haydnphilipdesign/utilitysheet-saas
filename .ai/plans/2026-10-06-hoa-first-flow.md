# HOA-first seller flow

- Status: completed, 2026-10-06, Codex. Approved by owner in chat.
- Verified: HomeBasicsStep currently asks water/sewer/heating before HOA; SellerWizard owns persisted draft state and preview uses the same wizard. Only water/sewer have HOA billing choices.
- Scope: move membership gate first, retain conditional details below heating with a heading; hide HOA choices only when enabled and No. Never infer billing from Yes. Preserve disabled/unanswered/Not sure behavior.
- Conflicts: clear only HOA water/sewer selections, require explicit reselection (Not Sure remains valid), announce why. Persist pending reselection through drafts; return conflicting resumed drafts to Home Basics. Do not modify saved packets, APIs, schema or coordinator edits.
- Files: components/seller-form/{SellerWizard.tsx,steps/HomeBasicsStep.tsx}, tests/unit/seller-wizard-hoa-flow.test.tsx, existing preview browser test if useful.
- Acceptance: first question order, details placement, option matrix, both/single conflicts, unaffected answers, restoration and disabled behavior, successful corrected submission and provider navigation.
- Validation: focused Vitest, TypeScript, focused ESLint, mocked saved-form preview Playwright desktop/mobile; diff check.
- Decision: amend `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md` to document conditional seller choices without changing historical data.
- Existing unrelated local changes: SellerLayout, FormEditor, FormsWorkspace, saved-seller-forms preview sizing assertions. Preserve.

## Outcome

Implemented all acceptance criteria. Question inventory ordering/help now matches the seller flow. Draft-only reselection markers are excluded from submitted payloads. Existing API, historical packets and coordinator editing are unchanged.

Validation: 57 focused tests passed across HOA wizard (17), advanced wizard (7), inventory (23), and question dialog (10). New mocked preview Playwright passed Desktop Chrome and Mobile Chrome (2 tests). TypeScript passed; focused ESLint passed with six pre-existing SellerWizard hook warnings; diff check passed. An initial test-only TypeScript option mismatch and provider test that omitted the always-present electric step were corrected. No live writes or deployments. Runtime Node 22.22.2 (available PATH; CI uses 20).

No required work remains. Next: owner review of local changes.
