# Post-Signup Referral Code

## Status

Completed and fully validated locally as of 2026-08-07. No commit, deployment,
migration, or production data action was performed.

## Outcome

- Settings now accepts a missed referral code for 30 days after account signup.
- The claim is authenticated, normalized, one-time, and rejects unknown or
  self-referral codes.
- Existing first-touch attribution fields are preserved.
- A late claim after one or more real seller submissions immediately schedules
  the existing idempotent referral-credit award and redemption path.
- Existing referral-trial behavior automatically recognizes the claimed code.

## Validation Results

- Focused Vitest: 5 files / 50 tests passed.
- Full Vitest: 134 files / 685 tests passed.
- `npm exec tsc -- --noEmit` passed.
- Focused ESLint passed.
- `npm run build` passed.
- `npm run security:scan` passed.
- `git diff --check` passed with line-ending warnings only.

No required implementation or validation remains.

## Goal

Allow an authenticated account to attach a valid referral code after signup when
the signup referral link was missed, without weakening referral-credit or trial
eligibility safeguards.

## Verified Current Behavior

- Referral codes are reusable-intake-link slugs stored on the account's single
  `growth_attributions` row.
- The referred account receives a referral-qualified 30-day Pro trial when it
  has no prior Stripe subscription history.
- The referrer earns one credit after the referred account's first real seller
  submission; self-referrals, duplicate awards, demo submissions, and the
  rolling 12-credit cap are already enforced server-side.
- Settings already has a Referrals tab backed by `GET /api/referrals`.
- The existing schema can represent a post-signup claim; no migration is needed.

## Approach

1. Add referral claim-state and one-time claim queries under the existing
   referral query boundary.
2. Extend `/api/referrals` to return claim state and accept a validated code.
3. Add an accessible claim form/status to the existing referral settings card.
4. Add focused query, route, and UI tests, then run proportional TypeScript,
   lint, Vitest, build, and security validation.

## Guardrails

- Authenticate and resolve the account on the server; never accept an account
  identity from the client.
- Accept only normalized intake-link slug syntax.
- Reject unknown and self-referral codes.
- Never replace an existing referral attribution.
- Permit claims for 30 days after signup, including after activation, and run
  the existing idempotent award path immediately after a successful claim.
- Preserve existing first-touch marketing fields when adding a referral code to
  an existing attribution row.
- Do not run a migration or modify production data.

## Acceptance Criteria

- An eligible signed-in user can enter a valid referral code in Settings and
  receives a durable claimed state.
- Existing attribution fields remain unchanged except for the newly attached
  referral code.
- Invalid, self, and duplicate/replacement claims receive safe, actionable
  errors; late claims follow the approved eligibility window.
- The normal referral trial and activation-award paths recognize the claimed
  code through the existing queries.
- Focused tests and affected static checks pass.

## Expected Areas

- `app/api/referrals/route.ts`
- `components/referrals/referral-credit-card.tsx`
- `lib/neon/queries/referral-credits.ts`
- `lib/neon/queries/index.ts`
- `tests/unit/referrals-route.test.ts`
- `tests/unit/referral-credits-query.test.ts`
- `tests/unit/settings-referral-credit-card.test.tsx`
