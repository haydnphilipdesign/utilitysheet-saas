# Handoff answers print from one definition, and an irrigation No hides stored details at print time

- Date: 2026-10-06. Decided by the owner. Plan: `.ai/plans/2026-10-06-packet-handoff-value-formatting.md`.

## Context

The seller's Review step printed handoff answers with `getAdvancedAnswerRows` (`lib/packet/modules.ts`), while the public packet and the PDF used a second formatter in `lib/packet/packet-data.ts`. The sheet showed `mon, wed`, `apr` and `not_sure`, and it capitalized any typed answer that happened to be `yes` or `no`.

Since 2026-10-06 a No to "Is there an irrigation system?" is stored without the detail answers. Sheets stored earlier can hold a No next to a provider, days, months or notes, because the seller form hid those fields under No but still sent them.

## Decision

1. `getAdvancedAnswerRows` is the only place that turns stored handoff answers into display text. Review, the public packet API, the web packet and the PDF all use its rows. Only the four coded fields are translated (irrigation choice, watering days, season start and end month). Every other field is printed exactly as stored.
2. The packet and PDF apply the irrigation rule at print time: when the question is included and the stored answer is No, only the No is printed. Stored data is never rewritten by rendering.

## Rationale

- One function means the three views cannot drift.
- The hidden details are ones the seller could not see when answering No, and a sheet that says No and names a provider contradicts itself in front of the buyer. Review and the coordinator editor already hide them.

## Alternatives rejected

- Print the stored details next to the No: keeps old shared sheets unchanged but leaves them contradictory and different from Review.
- Clean the stored sheets: not authorized, and unnecessary because the next coordinator save already normalizes a sheet.

## Consequences

- An already-shared link to an older sheet with No plus details now shows only the No. The details remain in the database. In the coordinator editor, changing the answer to Yes shows them again; saving the sheet while it still says No removes them, as it did before this decision.
- A new coded handoff field must be added to `ADVANCED_CODED_FIELD_LABELS`; nothing else needs to change for the packet or PDF.
- The seller form and the coordinator editor still keep their own option label lists for the inputs. They match today; they are not derived from the display labels.
