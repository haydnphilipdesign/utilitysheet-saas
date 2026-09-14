# Submitted-Sheet Utility Status: Provider, Not Sure, or Left Off

- Status: Accepted
- Date: 2026-09-14
- Decision owner: Product owner, implemented by Claude Code
- Related plan: `.ai/plans/2026-09-14-submitted-sheet-editing.md`

## Context

A seller's "I'm not sure" provider answer is stored as a `utility_entries` row
with `entry_mode = 'unknown'` and no provider name; the web packet and PDF print
"Not sure". A utility the seller skipped has no row and is omitted. The editor
showed both as the same blank provider field, and saving rewrote rows in a way
that silently dropped nameless rows or made them impossible to remove.

## Decision

1. Each editable utility has an explicit status that maps onto existing storage,
   with no schema change and no separate visibility flag:
   - `provider`: a named row (`entry_mode = 'free_text'`). A name is required.
   - `not_sure`: a nameless `entry_mode = 'unknown'` row, printed as "Not sure".
     Phone, website, meter, and trash details are kept and still print.
   - `not_included`: no row; the utility is omitted from the packet and PDF.
2. Correcting an answer means choosing `provider` and entering the name.
   Clearing a provider name means `not_sure`. Hiding a utility means
   `not_included`.
3. `status` is optional in the update schema. When absent (an editor tab loaded
   before this change) the server infers the previous meaning: name present is
   `provider`; other details without a name is `not_sure`; nothing is
   `not_included`.
4. Home Basics (water source, sewer type, heating type) are editable. "Not set"
   stores null and omits the item. The `homeBasics` payload is optional, so an
   older client cannot clear these values.

## Alternatives considered

- A row that prints a blank provider cell (for example, a trash schedule with no
  provider name). Rejected for now: existing re-saved "Not sure" rows use the
  same stored shape, so it would need a new flag, and "Not sure" is the
  established representation for an unknown provider.
- A general per-field visibility system. Rejected as unnecessary; row presence
  already expresses inclusion.

## Consequences

- Packet and PDF renderers are unchanged; only the data they receive changes.
- Any future editor, import, or API that writes `utility_entries` should
  preserve these three meanings.
