# Current task: Individual request question settings ready to push

- Date: 2026-10-02. Agent: Codex. Branch: `main`.
- Status: Implementation complete; final validation and commit/push in progress.
- Plan: `.ai/plans/2026-10-02-request-question-settings.md`.
- Decision: `.ai/decisions/2026-10-02-request-question-overrides.md`.
- Added free HOA/condo and electric meter switches in individual creation,
  initialized from account defaults and persisted as explicit request choices.
  Preview, seller GET/POST, and editor meter visibility honor those choices.
  Existing and reusable requests inherit live preferences through NULL values.
  Updated question inventory copy, account export, schema, and focused tests.
- Owner authorized migration, commit, and push to GitHub main.
- Migration applied to verified prior Neon target on 2026-10-02: two nullable
  boolean columns; 962 requests before and after; zero explicit overrides after
  migration. Only aggregate/catalog checks; no production seller data writes.
- Validation so far: full Vitest 946 passed, added seller API and editor route
  tests passed, TypeScript clean, affected-file lint clean, production build
  passed, 24 mocked Playwright runs passed, staged security scan passed.
  Final full Vitest/build rerun covers the last editor consistency change.
- Runtime: available Node 22.22.2 (CI uses Node 20).
- Preserve prior reply-draft edits and untracked `user-feedback/`. Both excluded
  from staging. No concurrent editing known; no PR requested.
- Next action: finish final checks, commit only this feature, push main, and
  finalize completion records. Deployment/live authenticated UI not yet verified.
