# Admin Panel (UtilitySheet)

## Routes
- `/admin` operational priorities, activation, recent usage, and customer health
- `/admin/users` user search, account inspection, and audited controls
- `/admin/requests` request search, lifecycle inspection, and audited support actions
- `/admin/organizations` workspace search; Team organizations are distinguished from personal/default workspaces in Admin copy
- `/admin/abandonment` seller-progress monitoring (route retained for compatibility)
- `/admin/audit-logs` audit log viewer

## Guardrails
- Admin write actions require a **reason** (min 3 chars) and are recorded to `admin_audit_logs`.
- Set `ADMIN_WRITES_DISABLED=true` to hard-disable admin write actions (useful as a “safety catch” in production).

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
