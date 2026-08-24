# Admin Panel (UtilitySheet)

## Routes
- `/admin` business totals, recent request and signup activity, standing backlogs, and request lifecycle
- `/admin/users` user search, account inspection, and audited controls
- `/admin/requests` request search, lifecycle inspection, and audited support actions
- `/admin/growth` activation funnel, acquisition sources, and packet referral instrumentation
- `/admin/organizations` workspace search and Team/personal workspace totals; Team organizations are distinguished from personal/default workspaces in Admin copy
- `/admin/abandonment` seller-progress monitoring (route retained for compatibility)
- `/admin/testimonial-candidates` customer outreach and advocacy-candidate review (route retained for compatibility)
- `/admin/updates` draft, review, publication, and deletion of customer-facing Product Updates
- `/admin/audit-logs` audit log viewer

## Navigation

Admin uses a left sidebar grouped as Operations, Customers, Growth & Content, and Security. `Growth`
sits in Growth & Content alongside Customer Outreach and Updates. Below the `lg`
breakpoint the same sidebar becomes a slide-over opened from the header. Routes are unchanged; several nav
labels intentionally differ from their URL (`Seller Progress` → `/admin/abandonment`, `Workspaces` →
`/admin/organizations`, `Customer Outreach` → `/admin/testimonial-candidates`).

## Overview and Growth Split

`/admin` carries only what an operator checks daily: total customer accounts, paying accounts, total
requests, seller submissions in the last 7 days, the newest requests and signups, the standing backlog
chips, and the request lifecycle bar. Analysis that is consulted occasionally lives on `/admin/growth`:
the full activation funnel, acquisition sources, and packet referral instrumentation. Adding a metric to
`/admin` means removing one, or it belongs on `/admin/growth`.

Business totals come from `lib/admin/operations-overview.ts`. Its `paid_accounts` predicate deliberately
mirrors the `paid_accounts` predicate in `lib/admin/activation-funnel.ts` and the `plan=paying` list
filter, so the overview, the growth funnel, and the user list cannot disagree. Both modules count only
`role = 'user'` accounts.

## List Filters

Every clickable metric on `/admin` and `/admin/growth` links to a list filtered to the rows it counted.
The predicates behind these filters mirror `lib/admin/activation-funnel.ts` and
`lib/admin/operations-overview.ts`; changing one side requires changing the other.

`/admin/users` accepts `q`, `role`, `plan`, `activation`, `sort`, `dir`, `page`, `pageSize`.

- `plan=paying` matches a Pro entitlement override **or** an active workspace on Team billing. It is
  deliberately broader than `plan=pro`.
- `activation=no-setup` matches accounts with no completed onboarding and no non-deleted, non-demo request.
- `activation=missing-defaults` matches accounts missing an active workspace, brand profile, or intake link.
- `activation=activated-7d` matches accounts whose first live seller submission landed in the last 7 days.
- `activation=habitual` matches accounts with 3 or more submitted requests in the last 30 days.

Overview links to these filters also carry `role=user`, because the activation funnel counts only
`role = 'user'` accounts.

`/admin/requests` accepts `q`, `status`, `activity`, `page`, `pageSize`. The `activity` windows (`7d`, `30d`,
`stale7d`, `stale30d`) are measured over `COALESCE(metered_at, last_activity_at, created_at)`.

`/admin/organizations` accepts `q`, `billing`, `page`, `pageSize`. The `billing` filter (`team`, `non-team`)
matches the workspace's own subscription status and is narrower than the displayed workspace kind, which
also considers member count. The Team and personal/default workspace totals in the page header are
unfiltered and use the same subscription-status predicate as `billing`.

## Guardrails
- Admin write actions require a **reason** (min 3 chars) and are recorded to `admin_audit_logs`.
- Set `ADMIN_WRITES_DISABLED=true` to hard-disable admin write actions (useful as a “safety catch” in production).
- Client confirmations and disabled buttons improve operator safety, but server actions remain authoritative for Admin authorization, reason validation, policy checks, audit logging, and the write safety catch.

## Customer Outreach

- Testimonial outreach is limited to eligible paying customers and excludes internal, test, banned, and Admin accounts.
- Before a real send or resend, Admin shows the recipient, exact message preview, candidate-selection reasons, required Admin reason, and explicit confirmation.
- Test-to-self sends also require a reason and explicit confirmation because they are external email writes.
- Send attempts retain the existing outreach log, resend guard, provider idempotency key, and Admin audit entry. There is no reason-policy exception for testimonial outreach.

## Product Updates

- New Product Updates are always created as drafts and are not visible to customers until a separate publish action succeeds.
- Draft creation, publication, and deletion each require an Admin reason and create a distinct `admin_audit_logs` entry.
- Publication and deletion require an exact-content preview plus explicit confirmation. Publication is idempotent for already-published records; deletion returns the affected record for audit evidence.
- There is no reason-policy exception for Product Update writes.

## Audit Evidence

- The default Audit Logs view prioritizes a human-readable action summary, timestamp, actor, affected record, safe related-record links, and the Admin reason.
- User agent, IP address, record identifiers, and sanitized raw metadata remain available under collapsed technical evidence.
- The viewer redacts values under secret-like metadata keys. Stored audit evidence is not rewritten or deleted by the viewer.

## Request Admin Actions
On `/admin/requests/[id]`:
- Change request status
- Edit seller contact info
- Send reminder email to seller

Each action writes an audit log entry and also emits a request `event_logs` entry (for timeline visibility).

## Account Entitlement Overrides

The user-management **Entitlement override** changes the account's UtilitySheet access record only; it does not create, cancel, or modify a Stripe subscription.

- Entitlement overrides require an admin reason and are recorded in `admin_audit_logs`.
- Server authorization, policy checks, Team-workspace blocking, and `ADMIN_WRITES_DISABLED=true` remain in force.

## Impersonation
Impersonation is intentionally disabled by default (and hidden from the UI).

- The banner is gated behind `ADMIN_ENABLE_IMPERSONATION=true`.
- A true “support-mode” impersonation flow is not implemented yet.
