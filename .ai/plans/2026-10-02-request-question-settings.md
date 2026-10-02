# Individual request question settings

- Status: Implementation complete; final validation and push pending. Authorized
  by owner 2026-10-02.
- Scope: expose HOA/condo and electric meter switches during individual request
  creation, free on all plans. Other existing request configuration stays intact.
- Verified: both seller GET/POST currently use live account preferences; request
  creation preview reads those preferences but offers no switches. Reusable
  intake uses the same request creator without question-setting arguments.
- Persistence: nullable `requests.collect_hoa_questions` and
  `requests.collect_electric_meter_number`. Explicit booleans override account
  defaults; NULL/absent retains live inheritance for old and reusable requests.
- Creation initializes controls from account settings, sends both choices,
  and saves them. Older clients omitting the fields retain inheritance.
- Shared resolver used by seller GET/POST; server enforcement cannot rely on UI.
- Expected areas: creation page/API/schema, request query/types, seller API,
  shared resolver, root migration/schema snapshot, focused tests, coordination.
- Acceptance: preview and seller agree; true and false persist independently;
  account changes do not alter explicit overrides; old/reusable behavior stays;
  hidden HOA answers do not overwrite prior answers; meter writes respect flag.
- Validation: focused resolver/API/UI/query tests, existing HOA tests, TypeScript,
  affected-file lint, full Vitest, production build, security scan, focused
  Playwright. Verify database identity and apply migration with owner authorization.
- Deployment order: apply additive migration before deploying application code.
  Owner authorized migration, commit, and push to GitHub main during this task.
- Decision: `.ai/decisions/2026-10-02-request-question-overrides.md`.

## Implementation record

- Implemented nullable request flags, resolver, creation switches/payload,
  server validation, seller GET/POST enforcement, and editor meter visibility.
  Account export includes flags; question inventory and Settings copy explain
  defaults versus request choices. Reusable intake still passes no overrides.
- Added UI, resolver, creation API/query, seller GET/POST, editor coverage.
  Tests include both boolean values against opposite account defaults and null
  inheritance. UI preview tracks toggles; no account preferences are written.
- Two nullable BOOLEAN columns applied to verified prior Neon target on
  2026-10-02 with owner authorization. Catalog and aggregate checks: 962 rows
  before/after, all overrides NULL; no production seller submissions created.
- Final Vitest: 951 passed across 171 files. TypeScript and affected-file lint
  clean; 24 mocked Playwright runs passed across desktop and mobile; staged
  security scan passed. Production build rerun succeeded.
- Runtime available: Node 22.22.2 versus CI Node 20. Real authenticated creation
  and production deployment are not independently verified by local tests.
- No substantive scope deviations. Editor meter consistency and export shape
  were included to preserve the request setting across existing consumers.
