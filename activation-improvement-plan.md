# Activation Improvement Plan

## Goal

Reduce the number of users who create an auth identity but never become an active UtilitySheet user.

For this app, "active" should mean:

- the user has successfully authenticated
- the app has created their `accounts` row
- the user can access the dashboard
- the user has enough defaults provisioned to take a first meaningful action

Today, those steps are separated, which creates drop-off.

## Current Problem

There are two distinct funnel breaks in the current implementation:

1. Auth user created, but no app account exists yet
2. App account exists, but the user does not complete onboarding

### Why the mismatch happens

The admin dashboard reads from the app's `accounts` table, not from the auth provider user list.

Relevant code:

- [lib/admin/index.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\lib\admin\index.ts): admin user list queries `accounts`
- [lib/neon/queries/accounts.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\lib\neon\queries\accounts.ts): `getOrCreateAccount(...)` inserts the app account lazily
- [app/api/account/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\account\route.ts): account materialization occurs when this route is hit
- [app/dashboard/layout.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\dashboard\layout.tsx): dashboard access also materializes the account

This means a user can sign up in auth but still never appear as an app user if they do not fully complete the post-signup path.

## Opinion: Is the current onboarding deterring users?

Yes, likely.

The current onboarding adds friction at the exact moment users are deciding whether the product is worth continuing with.

Current flow:

1. Create auth identity
2. Sign in
3. Materialize app account
4. Complete 5-step onboarding
5. Reach first real product value

The 5-step onboarding lives here:

- [app/onboarding/page.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\onboarding\page.tsx)

The gating happens here:

- [app/dashboard/layout.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\dashboard\layout.tsx)

The likely issue is not that the onboarding is "bad" UI. The issue is that it is too much required setup before the first win.

Branding, preview, and contact enrichment are valuable, but they are not essential to proving product value in the first session.

## Product Strategy Recommendation

Redefine activation as:

"The user successfully authenticates and the app provisions the minimum needed defaults automatically."

After that:

- setup should be progressive
- branding should be optional
- preview should be optional
- first-request creation or seller-link sharing should be the main CTA

## Concrete Implementation Plan

### Phase 1: Make app account creation immediate

#### Objective

Ensure every successful auth session creates a corresponding `accounts` row as early as possible.

#### Current behavior

The app account is created lazily by `getOrCreateAccount(...)`.

Relevant code:

- [lib/neon/queries/accounts.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\lib\neon\queries\accounts.ts)
- [app/api/account/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\account\route.ts)
- [app/dashboard/layout.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\dashboard\layout.tsx)

#### Change

Move account materialization to the earliest safe post-auth moment.

Preferred options:

1. auth callback / webhook if available in your auth stack
2. first successful authenticated redirect target
3. explicit post-signup activation route

#### Deliverable

- every verified/authenticated new user gets an `accounts` row immediately
- admin counts and auth counts stay much closer

### Phase 2: Auto-provision the minimum defaults

#### Objective

Remove setup burden from first-session users.

#### Provision automatically

1. Default organization
2. Default brand profile
3. Reusable intake link

#### Existing endpoints and logic to reuse

- [app/api/onboarding/organization/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\onboarding\organization\route.ts)
- [app/api/onboarding/brand-profile/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\onboarding\brand-profile\route.ts)
- [app/api/intake-link/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\intake-link\route.ts)

#### Suggested defaults

- organization name:
  - `user.displayName`
  - else email local part
  - else generic fallback like `"My Workspace"`
- brand profile:
  - organization name as brand name
  - existing default colors
  - contact name and email from account/auth data
- intake link:
  - create immediately for every account

#### Deliverable

- newly authenticated users can reach a meaningful dashboard state without manual setup

### Phase 3: Stop blocking dashboard access on full onboarding

#### Objective

Make the dashboard the primary landing area, not the reward for finishing setup.

#### Current behavior

Users are redirected away from the dashboard if `onboarding_completed_at` is missing.

Relevant code:

- [app/dashboard/layout.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\dashboard\layout.tsx)

#### Change

Relax the gating rule:

- if account exists and defaults are provisioned, allow dashboard access
- reserve onboarding only for truly missing core setup

#### Better rule

Only route users to setup if they have no usable workspace state at all.

#### Deliverable

- more users reach the product faster
- fewer abandon during forced setup

### Phase 4: Replace the 5-step onboarding with progressive setup

#### Objective

Move from required setup to optional enhancement.

#### Current steps

1. Welcome / organization
2. Branding
3. Contact info
4. Preview
5. Launch

Relevant code:

- [app/onboarding/page.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\onboarding\page.tsx)

#### Proposed replacement

Replace the full-screen onboarding with either:

1. a short one-step "Finish setup" page
2. a dashboard checklist
3. contextual prompts in Settings and Request creation

#### Keep optional

- brand customization
- contact enrichment
- preview
- seller-link copy tutorial

#### Make primary CTAs

- "Create first request"
- "Copy seller link"

#### Deliverable

- first product value arrives earlier
- setup becomes assistive instead of blocking

### Phase 5: Instrument the activation funnel properly

#### Objective

Measure where users actually drop.

#### Current state

There is `signup_started`, but the funnel is not fully instrumented.

Relevant code:

- [lib/analytics/events.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\lib\analytics\events.ts)

#### Add events

- `signup_completed`
- `signup_verification_required`
- `signup_verified`
- `account_created`
- `defaults_provisioned`
- `dashboard_first_view`
- `onboarding_step_viewed`
- `onboarding_step_completed`
- `onboarding_completed`
- `first_request_started`
- `first_request_created`
- `seller_link_copied`

#### Key funnel questions to answer

- How many users create auth identities?
- How many successfully verify/sign in?
- How many get an app account row?
- How many reach dashboard?
- How many start first request?
- How many finish first request?

#### Deliverable

- visibility into the exact drop-off point
- evidence for future product decisions

### Phase 6: Backfill and reconcile current auth-only users

#### Objective

Clean up the existing auth/app mismatch and avoid reporting confusion.

#### Change

Build a small reconciliation script or admin job that:

- finds auth users with no `accounts` row
- creates missing `accounts` rows where appropriate
- optionally tags backfilled users for analysis

#### Deliverable

- current 111 vs 89 mismatch becomes understandable and fixable

### Phase 7: Add re-engagement for incomplete users

#### Objective

Recover users who authenticate but do not activate.

#### Tactics

- email reminder 15 minutes after incomplete signup
- follow-up the next day
- direct link to:
  - create first request
  - copy seller link
  - resume setup

#### Messaging angle

Lead with the first value:

- "Your seller link is ready"
- "Create your first utility request"
- "You are one step from a shareable utility sheet"

#### Deliverable

- better recovery of near-activated users

## Suggested Rollout Order

1. Immediate account creation
2. Auto-provision defaults
3. Remove dashboard gating
4. Simplify onboarding UI
5. Add analytics
6. Backfill auth-only users
7. Add re-engagement

## Highest-ROI First Change

If only one change is made first, it should be:

Create the `accounts` row and provision defaults on first successful auth, then land the user directly in the dashboard.

That should reduce the auth-to-active drop significantly and remove the biggest source of confusion in user counts.

## File-by-File Impact Areas

Likely files to touch:

- [app/auth/signup/page.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\auth\signup\page.tsx)
- [app/auth/login/page.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\auth\login\page.tsx)
- [app/dashboard/layout.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\dashboard\layout.tsx)
- [app/onboarding/page.tsx](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\onboarding\page.tsx)
- [app/api/account/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\account\route.ts)
- [app/api/onboarding/organization/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\onboarding\organization\route.ts)
- [app/api/onboarding/brand-profile/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\onboarding\brand-profile\route.ts)
- [app/api/intake-link/route.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\app\api\intake-link\route.ts)
- [lib/neon/queries/accounts.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\lib\neon\queries\accounts.ts)
- [lib/analytics/events.ts](C:\Users\haydn\Documents\norma_suite\utility-sheet\lib\analytics\events.ts)

## Success Metrics

Track these before and after rollout:

- auth signups per day
- app accounts created per day
- auth-to-account conversion rate
- dashboard first-view rate
- first-request start rate
- first-request completion rate
- onboarding completion rate
- seller-link copy rate

## Short Answer

Yes, the current onboarding is probably deterring some users from sticking around.

Not because it is poorly designed, but because it asks for too much before the user gets the product's first payoff.

The strongest fix is to make users active immediately after successful auth, auto-create their defaults, and make setup optional afterward.
