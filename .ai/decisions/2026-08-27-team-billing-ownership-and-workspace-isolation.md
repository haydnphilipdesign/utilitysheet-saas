# Team Billing Ownership and Workspace Isolation

- Status: Accepted
- Date: 2026-08-27
- Decision owner: Product owner, implemented by OpenAI Codex
- Related plan: `.ai/plans/2026-08-27-teams-upgrade-and-workspace-switching.md`

## Context

UtilitySheet stores personal Pro billing on an account and Team billing on an
organization. The original `Start Teams` path always created an organization
Checkout subscription, so a Pro admin could retain the personal subscription
and start a second Team subscription. Existing users can join multiple
organizations, but only one active organization is rendered and there was no
supported switcher.

## Decision

1. A Pro-to-Team upgrade converts the existing Stripe subscription in place.
   The existing subscription item is replaced with the Team price and explicit
   seat quantity. Stripe creates prorations for the next invoice; the billing
   date, customer, payment method, and subscription identity are preserved.
2. Billing ownership is singular. After conversion, the organization owns the
   Stripe customer and subscription identifiers and the account's personal Pro
   billing identifiers/status are cleared. Subscription metadata identifies
   the organization so webhooks can complete or repair the transfer
   idempotently.
3. Free-to-Team continues to use Stripe Checkout and writes the same
   organization ownership metadata onto the created subscription.
4. Membership does not merge data. Workspaces remain separate authorization
   and data scopes, and a membership-guarded workspace switcher is the supported
   way to reach an existing user's prior workspace.
5. Company/domain similarity never grants membership or triggers an automatic
   merge. Joining continues to require an explicit invitation and exact-email
   authenticated acceptance.

## Rationale

- Reusing the existing subscription prevents double billing and preserves the
  customer's established payment method and invoice history.
- Deferred prorations avoid granting a partially applied upgrade when an
  immediate off-session payment needs additional authentication.
- Metadata-first routing removes the customer-lookup ambiguity during the
  moment billing ownership moves from account to organization.
- Keeping workspaces separate avoids irreversible guesses about which requests,
  branding, reusable defaults, or public links should become company-owned.

## Alternatives considered

- Create a new Team subscription and automatically cancel Pro: rejected because
  it temporarily creates two subscriptions, complicates credits/refunds, and
  fragments billing history.
- Automatically move the invitee's prior records into the Team workspace:
  rejected because ownership and privacy intent cannot be inferred from invite
  acceptance.
- Automatically join users based on email domain: rejected because domains are
  not sufficient authorization and consumer email addresses do not reliably
  identify company relationships.

## Consequences

- Conversion must verify the exact current Pro subscription/item before any
  Stripe update and reject unexpected shapes.
- Route and webhook database writes must be idempotent and safe in either order.
- Team invoice history is accessed through the organization portal after
  conversion; a personal Pro portal is no longer needed because no personal Pro
  subscription remains.
- Users may see the same account identity across several isolated workspaces
  and must select the intended workspace before working with scoped data.
