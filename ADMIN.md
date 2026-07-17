# Admin Panel (UtilitySheet)

## Routes
- `/admin` operational priorities, activation, recent usage, and customer health
- `/admin/users` user search, account inspection, and audited controls
- `/admin/requests` request search, lifecycle inspection, and audited support actions
- `/admin/organizations` workspace search; Team organizations are distinguished from personal/default workspaces in Admin copy
- `/admin/abandonment` seller-progress monitoring (route retained for compatibility)
- `/admin/testimonial-candidates` customer outreach and advocacy-candidate review (route retained for compatibility)
- `/admin/updates` draft, review, publication, and deletion of customer-facing Product Updates
- `/admin/audit-logs` audit log viewer

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
