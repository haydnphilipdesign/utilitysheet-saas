# Admin Panel (UtilitySheet)

## Routes
- `/admin` dashboard KPIs
- `/admin/users` user search + management
- `/admin/requests` request search + triage
- `/admin/organizations` org search
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

## Impersonation
Impersonation is intentionally disabled by default (and hidden from the UI).

- The banner is gated behind `ADMIN_ENABLE_IMPERSONATION=true`.
- A true “support-mode” impersonation flow is not implemented yet.
