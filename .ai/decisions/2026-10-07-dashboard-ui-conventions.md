# Dashboard UI conventions: confirmations and locked actions

Date: 2026-10-07. Owner decision in chat, made during the Seller forms polish
(`.ai/plans/2026-10-07-seller-forms-ux-polish.md`). The owner intends to polish
the rest of the product the same way, so these apply to every customer-facing
dashboard screen from now on.

## Decisions

1. **Confirmations use the shared dialog.** Use
   `components/ui/confirm-dialog.tsx` (`ConfirmDialog`) for any yes/no
   confirmation. Do not add `window.confirm`. A flow with its own consequences
   list or request (for example `DeleteRequestDialog`) keeps its own dialog.
2. **A locked action leads to billing.** When a plan does not include an
   action, keep it visible and clickable: lock icon, the normal label, an
   "Upgrade" badge, and a click that opens `/dashboard/settings?tab=billing`.
   Do not show a disabled "(Pro Only)" item with no way forward. Server-side
   plan enforcement is unchanged and remains the real gate.
3. **Save feedback on a page with a sticky save bar goes in the bar**, not in a
   toast. On phones the toast sits on top of the bar and blocks Save.

## Rationale

Non-technical users should never hit a dead end or a browser-styled prompt that
looks unlike the rest of the product. A locked item that goes nowhere hides the
one thing the user can do about it.

## Where this is applied

- Seller forms list and editor (confirmations, locked "Rename link").
- Branding list menu (locked Duplicate, Set Default, Delete).
- Settings (`components/settings/`): team and sign-in confirmations use
  `ConfirmDialog`. Settings has no sticky save bar, so decision 3 is applied in
  its general form: save, autosave and failure feedback sits beside the control
  it belongs to (`InlineStatus` in `settings-ui.tsx`), not in a toast.
  Sign-in, export and account-closure results still use toasts.

## Known places still to convert

Verify with a search before relying on this list
(`window.confirm`, `Pro Only`, disabled plan-locked controls).

- `app/dashboard/requests/new/page.tsx`: `window.confirm` when switching the
  seller form replaces request-only question changes. The browser spec
  `tests/saved-seller-forms.spec.ts` drives it with `page.once('dialog')` and
  must change with it.
- Disabled plan-locked inputs that are not menu items (for example the "Link
  ending" field and the "Property Handoff Packet" choice in the form editor)
  already sit beside a billing link; review them case by case.

Remove an entry here when it is converted.
