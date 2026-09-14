# Current Work

- Task: Evaluate and improve submitted-sheet editing (edit seller answers, download updated PDF).
- Status: Completed 2026-09-14. No required work remains. Committed and pushed to origin/main at the user's request on 2026-09-14 (see git log); a push to main may trigger a production deploy. No migration or production data change was made.
- Agent: Claude Code.
- Branch: main.
- Plan: .ai/plans/2026-09-14-submitted-sheet-editing.md (Completed; see Outcome).
- Decision: .ai/decisions/2026-09-14-submitted-sheet-utility-status.md.

## Outcome

- Editor rebuilt (`components/requests/SubmittedSheetEditor.tsx`): per-utility Provider / Not sure / Leave off sheet, "Not sure" summary, editable Home Basics, sticky save bar with status, discard and conflict dialogs, save-and-download, inline validation, accessibility and mobile fixes.
- Bug fixed: unrelated saves no longer delete "Not sure" utility rows; `entry_mode = 'unknown'` preserved.
- Server: optional `status` and `homeBasics` in `submittedSheetUpdateBodySchema` (legacy payloads inferred); route and `updateSubmittedRequestData` update home basics only when sent. Authorization, plan gating, optimistic locking, and audit event unchanged. No schema change.
- Refactors without behavior change: `buildPacketUtilities()` exported from `lib/packet/packet-data.ts`; editor payload builder moved to `lib/submitted-sheet/editor.ts`.

## Validation

Vitest 151 files / 796 tests pass; tsc pass; build pass; security scan pass. Lint: one pre-existing error in untouched `components/admin/EventLogTable.tsx`. Browser QA at 1440px and 390px (360px overflow) and production PDF inspection passed using a temporary harness, now deleted. Not verified in a signed-in dashboard session against a real database (local `DATABASE_URL` is production).

## Other work in the tree (preserve)

- OpenAI Codex (Astra) acquisition recovery strategy (docs only) is paused and incomplete: `.ai/plans/2026-09-10-acquisition-recovery-strategy.md` still "In progress"; report `docs/growth/2026-09-10-acquisition-recovery-strategy.md` not written. Resume from that plan's "Next action".
- Untracked September 10 audit plans, `docs/audits/`, and `output/playwright` screenshots are intentional existing work.
- Port 3000 on this machine is the sibling `norma` project's dev server.

## Recommended next action

Owner review of the diff; optionally a signed-in check on a non-production database or a test account before committing. Optional follow-ups are listed in the plan.
