# AI generation, exposure and accepted-choice lineage

- Date: 2026-10-14. Status: owner approved A-E in chat; implemented/validated, live migration applied/verified and 977d6c9 published on origin/telemetry-slice-8 under later explicit owner authorization.
- Plan: `../plans/2026-10-14-telemetry-slice-8-lineage.md`.
- Related policies: `2026-10-13-telemetry-report-definitions.md`, `2026-10-13-seller-diagnostic-observations.md`, `2026-10-13-auxiliary-observation-budgets.md`, `2026-10-14-telemetry-retention.md`.

## Context

Current shared suggestion/search generation records only the first consumer's context. Cache reads lose original source/model/prompt metadata; selection matches the latest provider name instead of an exposed item. Run and item inserts can be partial. Pass counts omit transport retries and recovered failures.

## Approved decisions

- A: one generation with atomic run/items, separate request-scoped consumer exposures and immutable accepted-choice observations. Author an additive migration and schema mirror locally. New tables: ai_result_exposures and ai_selection_observations.
- B: optional opaque run/item/exposure references, server ownership/membership checks, compatible v1/v2 advisory render observations, no latest-name fallback for exact lineage. Missing, stale or malformed references never block otherwise valid seller answers. References confer no read/write capability.
- C: server exposure/accepted-choice records have explicit 365-day retention rules and cascade on request hard deletion. Browser render acknowledgments remain solely in existing 90-day diagnostic events. This extends the retention policy with two named server-table rules; implementation must update retention.ts, tests and privacy documentation together. No production pruning or migration is authorized.
- D: bounded per-generation transport/pass/usage-completeness summary, disabled/reached-skip contact coverage and versioned estimates using current price constants. No separate attempt ledger, raw prompts/responses/grounding URLs, invoice completeness claim or R12 contact-trust change.
- E: first incorporate completed UX main commit 68fbf38 into the isolated Slice 8 worktree, then implement contracts/server and browser wiring with combined regression validation. Recheck current ownership/status before integration.

## Rationale and alternatives

One generation per consumer would duplicate usage and complicate denominators. Mutating only an item's selection flag would lose per-consumer/reopen history. A permanent render summary on exposures would extend the approved browser retention. A separate attempt table adds volume and joins without a current reader need. The approved split preserves these boundaries while keeping observations auxiliary.

## Consequences and authorization

Collection remains best effort: writeAuxiliary, one attempt, 500 ms per consumer operation, no retry or detached writes. Browser acknowledgment never gates navigation; selection observation never gates accepted submission. Missing evidence is unknown. Legacy rows retain historical semantics without inferred backfill. More schema/reader work is accepted; no promise of complete usage, human viewing or provider accuracy.

Owner approval authorizes local integration and implementation with fixtures/mocked models. It does not authorize migration execution, live database queries/writes, production settings/data, real model/provider calls, emails, commits, pushes or deployment. Read-only production queries require a separate ask, aggregates only in a read-only transaction. Main source remains untouched; preserve owner notes and existing worktree documentation.

## Verified local implementation

UX 68fbf38 was fast-forwarded first without a new commit, preserving task documents. One SQL statement owns run/items/first exposure; followers have one 500 ms budget including shared persistence plus their query. Cache namespaces advance actual base v9/v8/v3 to envelope v10/v9/v4. Immutable choices, advisory v1/v2 browser memberships, explicit retention, aggregate Admin lineage/change proxies and versioned estimate coverage are implemented. Validation uses disposable PostgreSQL and intercepted installed SDK/Neon HTTP, with no live actions. Full results and limitations are in the completed plan and CURRENT.

## Later execution authorization

On 2026-10-14 the owner explicitly requested the live migration and commit/push
of the completed worktree. The additive migration was applied transactionally
and verified using schema metadata only. Implementation 977d6c9 was committed
and pushed on telemetry-slice-8, with the remote hash verified. Earlier live/
publication restrictions are superseded for those completed actions only;
main merge, deployment, production settings/pruning and real model/email calls
remain outside this authorization. Final operational evidence is in CURRENT.
