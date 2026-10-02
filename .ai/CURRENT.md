# Current task: Individual request question settings shipped to main

- Date: 2026-10-02. Agent: Codex. Branch: `main`.
- Status: Complete. No required implementation, migration, commit, or push work
  remains. Feature commit `735ddb0` pushed to GitHub main with owner authorization.
- Plan: `.ai/plans/2026-10-02-request-question-settings.md` (Completed).
- Decision: `.ai/decisions/2026-10-02-request-question-overrides.md` (Accepted).
- Added free HOA/condo and electric meter switches in individual creation,
  initialized from account defaults and persisted as explicit request choices.
  Preview, seller GET/POST, and editor meter visibility honor those choices.
  Existing and reusable requests inherit live preferences through NULL values.
  Updated question inventory, Settings copy, account export, schema, and tests.
- Migration applied to verified prior Neon target on 2026-10-02: two nullable
  boolean columns; 962 requests before and after; zero explicit overrides after
  migration. Only aggregate/catalog checks; no production seller data writes.
- Final validation: 951 tests across 171 Vitest files passed; TypeScript and
  affected-file lint clean; production build succeeded; 24 mocked Playwright
  runs passed across desktop and both mobile browsers; staged security scan and
  diff checks passed. Runtime available: Node 22.22.2 (CI uses Node 20).
- Prior reply draft edits and untracked `user-feedback/` excluded from all
  commits. Preserve them; customer material must not be committed.
- No concurrent editing known, no PR requested. Application changes are committed.
- Optional next action: verify authenticated creation after the automatic
  deployment completes. Deployment completion and a real production seller
  submission were not independently checked. No required follow-up remains.
