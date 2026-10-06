# Required Water and Sewer, Trash Always Asked, and "Same as Internet"

- Status: Accepted
- Date: 2026-10-06
- Decision owner: Product owner, recorded by Claude Code
- Related plan: `.ai/plans/2026-10-06-seller-form-required-basics-trash-cable.md`. Evidence: `.ai/plans/2026-10-06-ux-form-logic-review.md` ("Findings 10 and 11: data check").
- Builds on: `2026-10-01-hoa-questions-in-home-basics.md`, `2026-09-14-submitted-sheet-utility-status.md`, `2026-10-06-read-only-after-submission-and-reopen.md`.

## Context

Water Source and Sewer Type were preselected as "Not Sure", although they decide which provider steps appear. Trash sat behind an opt-in tick box labelled "Optional", and 31% of sheets that requested trash had no trash row. Internet and Cable/TV named the same provider on 79% of sheets that had both.

## Decision

1. Water Source and Sewer Type start unanswered and are required on Home Basics. "Not Sure" is a deliberate answer. The HOA question stays skippable.
2. Trash & Recycling is asked whenever the request includes it. "I'm not sure" stays. "No trash service at this home" stores no trash row, which keeps trash off the sheet. The tick boxes cover Internet and Cable/TV only.
3. Cable/TV offers "Same as Internet: <name>" first when Internet has a named provider. It is never preselected and copies the name only, as a typed entry, so contact details are resolved for Cable/TV itself. No equivalent for Sewer after Water (names matched on only 28% of sheets).
4. The unanswered state and the no-service answer exist only in the seller wizard. The submission schema, seller route, storage, packet, PDF and coordinator editor are unchanged.

5. A reopened sheet whose request includes trash but has no trash row opens on the trash step, then goes to Review (owner decision, same day; it replaced a first build that prefilled "No trash service"). A missing row cannot be told apart from never having been asked, and the form must not show an answer the seller did not give. A seller who did answer "No trash service" confirms it with one tap.

## Implementation choices made by the implementing agent (owner may revisit)

- A reopened sheet with an empty water or sewer value opens on Home Basics and then returns to Review, stopping only at provider steps that have no answer.
- A local draft saved before this change keeps its "Not Sure" values. If it is past a trash step it was never asked, the seller is taken to that step first.

## Consequences

- Every seller makes two more deliberate taps on Home Basics, and one more step when the request includes trash.
- Going forward, no trash row on a sheet that requested trash means the seller said there is no service. Sheets stored before this change stay ambiguous, which is why a reopen asks again.
- `home_basics.optional_utilities` in the question inventory lists Internet and Cable/TV; the trash section reads "Always asked when Trash & Recycling is included".
- Analytics: `seller_utility_skipped` gains the reason `no_service`.
