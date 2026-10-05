/**
 * Atomic Admin writes.
 *
 * Every function here commits the mutation, its `admin_audit_logs` evidence and
 * any required `event_logs` timeline entry together: each is one statement built
 * from data-modifying CTEs, so a failed audit or timeline insert rolls the
 * mutation back. The before-state is read under a row lock in the same statement
 * and compared with what the operator saw, so stale edits are refused instead of
 * overwriting newer changes.
 *
 * See `.ai/decisions/2026-10-05-admin-atomic-writes-and-status-corrections.md`.
 */
import { getStatementExecutor, type SqlRow, type SqlStatement, type StatementExecutor } from '@/lib/neon/statements';
import type { AdminAction, Plan, ProductUpdate, RequestStatus, UpdateCategory, UserRole } from '@/types';

export type AdminActor = {
    adminId: string;
    ipAddress: string | null;
    userAgent: string | null;
};

type WriteContext = { actor: AdminActor; reason: string; db?: StatementExecutor };

function baseMetadata(context: WriteContext, extra: Record<string, unknown> = {}) {
    return JSON.stringify({
        reason: context.reason,
        ...(context.actor.userAgent ? { userAgent: context.actor.userAgent } : {}),
        ...extra,
    });
}

function executor(context: { db?: StatementExecutor }) {
    return context.db ?? getStatementExecutor();
}

/**
 * Serializes every Admin role change. In READ COMMITTED the statement that
 * follows the lock takes its snapshot after the lock is granted, so it counts
 * admins as left by the previous holder. Two admins demoting each other therefore
 * cannot both succeed: the second sees itself already demoted.
 */
const ADMIN_ROLE_LOCK: SqlStatement = {
    text: `SELECT pg_advisory_xact_lock(hashtextextended('utilitysheet:admin-role-change', 0))`,
    params: [],
};

// ---------------------------------------------------------------------------
// Account role (demote, ban, unban)
// ---------------------------------------------------------------------------

export type AccountRoleOutcome =
    | 'OK'
    | 'NOT_FOUND'
    | 'ACTOR_NOT_ADMIN'
    | 'ACCOUNT_NOT_ACTIVE'
    | 'STALE'
    | 'NO_OP'
    | 'ADMIN_PROMOTION_DISABLED'
    | 'SELF_BLOCKED'
    | 'LAST_ADMIN_PROTECTED';

export function accountRoleChangeStatement(input: WriteContext & {
    targetId: string;
    nextRole: UserRole;
    expectedRole: UserRole;
    action: Extract<AdminAction, 'role_changed' | 'user_banned' | 'user_unbanned'>;
}): SqlStatement {
    return {
        text: `
            WITH target AS (
                SELECT id, role, closure_status FROM accounts WHERE id = $1::uuid FOR UPDATE
            ),
            decision AS (
                SELECT t.id, t.role AS previous_role,
                    CASE
                        WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin') THEN 'ACTOR_NOT_ADMIN'
                        WHEN t.closure_status <> 'active' THEN 'ACCOUNT_NOT_ACTIVE'
                        WHEN t.role <> $4::text THEN 'STALE'
                        WHEN t.role = $3::text THEN 'NO_OP'
                        WHEN $3::text = 'admin' THEN 'ADMIN_PROMOTION_DISABLED'
                        WHEN t.id = $2::uuid THEN 'SELF_BLOCKED'
                        WHEN t.role = 'admin' AND (SELECT COUNT(*) FROM accounts WHERE role = 'admin') <= 1 THEN 'LAST_ADMIN_PROTECTED'
                        ELSE 'OK'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE accounts a SET role = $3::text
                FROM decision d
                WHERE a.id = d.id AND d.outcome = 'OK'
                RETURNING a.id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, d.id, $5::text,
                    $6::jsonb || jsonb_build_object('previousRole', d.previous_role) ||
                        CASE WHEN d.outcome = 'OK'
                            THEN jsonb_build_object('newRole', $3::text)
                            ELSE jsonb_build_object('blocked', true, 'code', d.outcome, 'attemptedRole', $3::text)
                        END,
                    $7::text
                FROM decision d
                WHERE d.outcome IN ('OK', 'SELF_BLOCKED', 'LAST_ADMIN_PROTECTED', 'ADMIN_PROMOTION_DISABLED')
                RETURNING id
            )
            SELECT d.outcome, d.previous_role,
                (SELECT COUNT(*) FROM updated)::int AS updated_count,
                (SELECT COUNT(*) FROM audit)::int AS audit_count
            FROM decision d
        `,
        params: [
            input.targetId,
            input.actor.adminId,
            input.nextRole,
            input.expectedRole,
            input.action,
            baseMetadata(input),
            input.actor.ipAddress,
        ],
    };
}

export async function changeAccountRole(
    input: Parameters<typeof accountRoleChangeStatement>[0]
): Promise<{ outcome: AccountRoleOutcome; previousRole: UserRole | null }> {
    const [, rows] = await executor(input).transaction([ADMIN_ROLE_LOCK, accountRoleChangeStatement(input)]);
    const row = rows?.[0];
    if (!row) return { outcome: 'NOT_FOUND', previousRole: null };
    return { outcome: row.outcome as AccountRoleOutcome, previousRole: row.previous_role as UserRole };
}

// ---------------------------------------------------------------------------
// Account entitlement override
// ---------------------------------------------------------------------------

export type AccountPlanOutcome =
    | 'OK'
    | 'NOT_FOUND'
    | 'ACTOR_NOT_ADMIN'
    | 'ACCOUNT_NOT_ACTIVE'
    | 'ORG_TEAM_MANAGED_PLAN'
    | 'STALE'
    | 'NO_OP';

export async function changeAccountPlan(input: WriteContext & {
    targetId: string;
    nextPlan: Extract<Plan, 'free' | 'pro'>;
    expectedPlan: Plan;
}): Promise<{ outcome: AccountPlanOutcome; previousPlan: Plan | null }> {
    const rows = await executor(input).run({
        text: `
            WITH target AS (
                SELECT id, subscription_status, active_organization_id, closure_status
                FROM accounts WHERE id = $1::uuid FOR UPDATE
            ),
            workspace AS (
                SELECT o.subscription_status
                FROM organizations o
                JOIN target t ON o.id = t.active_organization_id
                FOR SHARE OF o
            ),
            decision AS (
                SELECT t.id, t.subscription_status AS previous_plan, t.active_organization_id,
                    CASE
                        WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin') THEN 'ACTOR_NOT_ADMIN'
                        WHEN t.closure_status <> 'active' THEN 'ACCOUNT_NOT_ACTIVE'
                        WHEN EXISTS (SELECT 1 FROM workspace w WHERE w.subscription_status = 'team') THEN 'ORG_TEAM_MANAGED_PLAN'
                        WHEN t.subscription_status <> $4::text THEN 'STALE'
                        WHEN t.subscription_status = $3::text THEN 'NO_OP'
                        ELSE 'OK'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE accounts a SET subscription_status = $3::text
                FROM decision d
                WHERE a.id = d.id AND d.outcome = 'OK'
                RETURNING a.id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, d.id, 'plan_changed',
                    $5::jsonb || jsonb_build_object('previousPlan', d.previous_plan) ||
                        CASE WHEN d.outcome = 'OK'
                            THEN jsonb_build_object('newPlan', $3::text)
                            ELSE jsonb_build_object(
                                'blocked', true,
                                'policy', 'organization_team_managed',
                                'code', d.outcome,
                                'attemptedPlan', $3::text,
                                'activeOrganizationId', d.active_organization_id
                            )
                        END,
                    $6::text
                FROM decision d
                WHERE d.outcome IN ('OK', 'ORG_TEAM_MANAGED_PLAN')
                RETURNING id
            )
            SELECT d.outcome, d.previous_plan,
                (SELECT COUNT(*) FROM updated)::int AS updated_count,
                (SELECT COUNT(*) FROM audit)::int AS audit_count
            FROM decision d
        `,
        params: [
            input.targetId,
            input.actor.adminId,
            input.nextPlan,
            input.expectedPlan,
            baseMetadata(input),
            input.actor.ipAddress,
        ],
    });
    const row = rows[0];
    if (!row) return { outcome: 'NOT_FOUND', previousPlan: null };
    return { outcome: row.outcome as AccountPlanOutcome, previousPlan: row.previous_plan as Plan };
}

// ---------------------------------------------------------------------------
// Request status correction (support-only; never a submission)
// ---------------------------------------------------------------------------

export type RequestStatusOutcome =
    | 'OK'
    | 'NOT_FOUND'
    | 'ACTOR_NOT_ADMIN'
    | 'REQUEST_DELETED'
    | 'STALE'
    | 'NO_OP'
    /** Submitted without metering (test drive or historical record): manual review only. */
    | 'UNMETERED_SUBMITTED_REVIEW'
    /** Selecting Submitted cannot stand in for a real seller submission. */
    | 'SUBMISSION_REQUIRES_SELLER'
    /** A metered, submitted request is corrected through submitted-sheet editing. */
    | 'SUBMITTED_LOCKED'
    /** A metered request that drifted out of Submitted can only be restored to it. */
    | 'METERED_RESTORE_ONLY';

/**
 * Changes `status` only. `metered_at`, `last_activity_at`, tokens, quota,
 * referral credits, emails and packets are untouched: this is a display-state
 * repair, and `metered_at` stays the authority for first submission.
 */
export async function correctRequestStatus(input: WriteContext & {
    requestId: string;
    nextStatus: RequestStatus;
    expectedStatus: RequestStatus;
}): Promise<{ outcome: RequestStatusOutcome; previousStatus: RequestStatus | null }> {
    const rows = await executor(input).run({
        text: `
            WITH target AS (
                SELECT id, account_id, status, metered_at, deleted_at, property_address
                FROM requests WHERE id = $1::uuid FOR UPDATE
            ),
            decision AS (
                SELECT t.id, t.account_id, t.status AS previous_status, t.property_address,
                    CASE
                        WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin') THEN 'ACTOR_NOT_ADMIN'
                        WHEN t.deleted_at IS NOT NULL THEN 'REQUEST_DELETED'
                        WHEN t.status <> $4::text THEN 'STALE'
                        WHEN t.status = $3::text THEN 'NO_OP'
                        WHEN t.metered_at IS NULL AND t.status = 'submitted' THEN 'UNMETERED_SUBMITTED_REVIEW'
                        WHEN t.metered_at IS NULL AND $3::text = 'submitted' THEN 'SUBMISSION_REQUIRES_SELLER'
                        WHEN t.metered_at IS NOT NULL AND t.status = 'submitted' THEN 'SUBMITTED_LOCKED'
                        WHEN t.metered_at IS NOT NULL AND $3::text <> 'submitted' THEN 'METERED_RESTORE_ONLY'
                        ELSE 'OK'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE requests r SET status = $3::text
                FROM decision d
                WHERE r.id = d.id AND d.outcome = 'OK'
                RETURNING r.id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, d.account_id, 'request_status_changed',
                    $5::jsonb || jsonb_build_object(
                        'requestId', d.id,
                        'previousStatus', d.previous_status,
                        'newStatus', $3::text,
                        'propertyAddress', d.property_address,
                        'correction', true
                    ),
                    $6::text
                FROM decision d WHERE d.outcome = 'OK'
                RETURNING id
            ),
            timeline AS (
                INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
                SELECT d.id, 'admin_request_status_changed',
                    jsonb_build_object(
                        'actor', 'admin',
                        'adminId', $2::text,
                        'previousStatus', d.previous_status,
                        'newStatus', $3::text,
                        'reason', $7::text
                    ),
                    $6::text, $8::text
                FROM decision d WHERE d.outcome = 'OK'
                RETURNING id
            )
            SELECT d.outcome, d.previous_status,
                (SELECT COUNT(*) FROM updated)::int AS updated_count,
                (SELECT COUNT(*) FROM audit)::int AS audit_count,
                (SELECT COUNT(*) FROM timeline)::int AS event_count
            FROM decision d
        `,
        params: [
            input.requestId,
            input.actor.adminId,
            input.nextStatus,
            input.expectedStatus,
            baseMetadata(input),
            input.actor.ipAddress,
            input.reason,
            input.actor.userAgent,
        ],
    });
    const row = rows[0];
    if (!row) return { outcome: 'NOT_FOUND', previousStatus: null };
    return { outcome: row.outcome as RequestStatusOutcome, previousStatus: row.previous_status as RequestStatus };
}

// ---------------------------------------------------------------------------
// Request seller contact
// ---------------------------------------------------------------------------

export type SellerContact = { sellerName: string | null; sellerEmail: string | null; sellerPhone: string | null };
export type RequestSellerOutcome = 'OK' | 'NOT_FOUND' | 'ACTOR_NOT_ADMIN' | 'REQUEST_DELETED' | 'STALE' | 'NO_OP';

export async function updateRequestSellerContact(input: WriteContext & {
    requestId: string;
    seller: SellerContact;
    expected: SellerContact;
}): Promise<{ outcome: RequestSellerOutcome }> {
    const rows = await executor(input).run({
        text: `
            WITH target AS (
                SELECT id, account_id, seller_name, seller_email, seller_phone, deleted_at, property_address
                FROM requests WHERE id = $1::uuid FOR UPDATE
            ),
            decision AS (
                SELECT t.*,
                    CASE
                        WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin') THEN 'ACTOR_NOT_ADMIN'
                        WHEN t.deleted_at IS NOT NULL THEN 'REQUEST_DELETED'
                        WHEN NULLIF(btrim(t.seller_name), '') IS DISTINCT FROM $6::text
                            OR NULLIF(btrim(t.seller_email), '') IS DISTINCT FROM $7::text
                            OR NULLIF(btrim(t.seller_phone), '') IS DISTINCT FROM $8::text THEN 'STALE'
                        WHEN $3::text IS NOT DISTINCT FROM $6::text
                            AND $4::text IS NOT DISTINCT FROM $7::text
                            AND $5::text IS NOT DISTINCT FROM $8::text THEN 'NO_OP'
                        ELSE 'OK'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE requests r
                SET seller_name = $3::text, seller_email = $4::text, seller_phone = $5::text
                FROM decision d
                WHERE r.id = d.id AND d.outcome = 'OK'
                RETURNING r.id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, d.account_id, 'request_seller_updated',
                    $9::jsonb || jsonb_build_object(
                        'requestId', d.id,
                        'propertyAddress', d.property_address,
                        'before', jsonb_build_object(
                            'seller_name', d.seller_name, 'seller_email', d.seller_email, 'seller_phone', d.seller_phone),
                        'after', jsonb_build_object(
                            'seller_name', $3::text, 'seller_email', $4::text, 'seller_phone', $5::text)
                    ),
                    $10::text
                FROM decision d WHERE d.outcome = 'OK'
                RETURNING id
            ),
            timeline AS (
                INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
                SELECT d.id, 'admin_request_seller_updated',
                    jsonb_build_object('actor', 'admin', 'adminId', $2::text, 'reason', $11::text),
                    $10::text, $12::text
                FROM decision d WHERE d.outcome = 'OK'
                RETURNING id
            )
            SELECT d.outcome,
                (SELECT COUNT(*) FROM updated)::int AS updated_count,
                (SELECT COUNT(*) FROM audit)::int AS audit_count,
                (SELECT COUNT(*) FROM timeline)::int AS event_count
            FROM decision d
        `,
        params: [
            input.requestId,
            input.actor.adminId,
            input.seller.sellerName,
            input.seller.sellerEmail,
            input.seller.sellerPhone,
            input.expected.sellerName,
            input.expected.sellerEmail,
            input.expected.sellerPhone,
            baseMetadata(input),
            input.actor.ipAddress,
            input.reason,
            input.actor.userAgent,
        ],
    });
    const row = rows[0];
    if (!row) return { outcome: 'NOT_FOUND' };
    return { outcome: row.outcome as RequestSellerOutcome };
}

// ---------------------------------------------------------------------------
// Product Updates
// ---------------------------------------------------------------------------

export type ProductUpdateWriteResult =
    | { outcome: 'OK'; update: ProductUpdate }
    | { outcome: 'NOT_FOUND' | 'ALREADY_PUBLISHED' | 'ACTOR_NOT_ADMIN'; update: ProductUpdate | null };

function toProductUpdate(row: SqlRow): ProductUpdate {
    return {
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        category: row.category as UpdateCategory,
        is_published: row.is_published === true,
        published_at: toIso(row.published_at),
        created_by: row.created_by ? String(row.created_by) : null,
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
    };
}

function toIso(value: unknown): string {
    return value instanceof Date ? value.toISOString() : String(value);
}

const PRODUCT_UPDATE_COLUMNS = 'id, title, body, category, is_published, published_at, created_by, created_at, updated_at';

/** Always a draft. Publication is a separate confirmed action. */
export async function createProductUpdateDraft(input: WriteContext & {
    title: string;
    body: string;
    category: UpdateCategory;
}): Promise<ProductUpdateWriteResult> {
    const rows = await executor(input).run({
        text: `
            WITH inserted AS (
                INSERT INTO product_updates (title, body, category, is_published, published_at, created_by)
                SELECT $2::text, $3::text, $4::text, FALSE, NOW(), $1::uuid
                WHERE EXISTS (SELECT 1 FROM accounts WHERE id = $1::uuid AND role = 'admin')
                RETURNING ${PRODUCT_UPDATE_COLUMNS}
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $1::uuid, NULL, 'product_update_created',
                    $5::jsonb || jsonb_build_object(
                        'updateId', i.id, 'title', i.title, 'category', i.category, 'is_published', false),
                    $6::text
                FROM inserted i
                RETURNING id
            )
            SELECT i.*, (SELECT COUNT(*) FROM audit)::int AS audit_count FROM inserted i
        `,
        params: [
            input.actor.adminId,
            input.title,
            input.body,
            input.category,
            baseMetadata(input),
            input.actor.ipAddress,
        ],
    });
    if (!rows[0]) return { outcome: 'ACTOR_NOT_ADMIN', update: null };
    return { outcome: 'OK', update: toProductUpdate(rows[0]) };
}

/** A repeat publication is a truthful no-op: no second audit entry, no new `published_at`. */
export async function publishProductUpdateAtomic(input: WriteContext & { updateId: string }): Promise<ProductUpdateWriteResult> {
    const rows = await executor(input).run({
        text: `
            WITH target AS (
                SELECT ${PRODUCT_UPDATE_COLUMNS} FROM product_updates WHERE id = $1::uuid FOR UPDATE
            ),
            decision AS (
                SELECT t.id,
                    CASE
                        WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin') THEN 'ACTOR_NOT_ADMIN'
                        WHEN t.is_published THEN 'ALREADY_PUBLISHED'
                        ELSE 'OK'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE product_updates p SET is_published = TRUE, published_at = NOW()
                FROM decision d
                WHERE p.id = d.id AND d.outcome = 'OK'
                RETURNING p.id, p.title, p.body, p.category, p.is_published, p.published_at,
                    p.created_by, p.created_at, p.updated_at
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, NULL, 'product_update_published',
                    $3::jsonb || jsonb_build_object(
                        'updateId', u.id, 'title', u.title, 'category', u.category, 'publishedAt', u.published_at),
                    $4::text
                FROM updated u
                RETURNING id
            )
            SELECT d.outcome, r.*
            FROM decision d
            JOIN LATERAL (
                SELECT * FROM updated
                UNION ALL
                SELECT * FROM target WHERE NOT EXISTS (SELECT 1 FROM updated)
            ) r ON TRUE
        `,
        params: [input.updateId, input.actor.adminId, baseMetadata(input), input.actor.ipAddress],
    });
    const row = rows[0];
    if (!row) return { outcome: 'NOT_FOUND', update: null };
    const outcome = row.outcome as 'OK' | 'ALREADY_PUBLISHED' | 'ACTOR_NOT_ADMIN';
    return { outcome, update: toProductUpdate(row) };
}

/** A repeat deletion finds nothing and writes no audit entry. */
export async function deleteProductUpdateAtomic(input: WriteContext & { updateId: string }): Promise<ProductUpdateWriteResult> {
    const rows = await executor(input).run({
        text: `
            WITH deleted AS (
                DELETE FROM product_updates
                WHERE id = $1::uuid
                  AND EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin')
                RETURNING ${PRODUCT_UPDATE_COLUMNS}
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, NULL, 'product_update_deleted',
                    $3::jsonb || jsonb_build_object(
                        'updateId', d.id, 'title', d.title, 'category', d.category, 'wasPublished', d.is_published),
                    $4::text
                FROM deleted d
                RETURNING id
            )
            SELECT d.*, (SELECT COUNT(*) FROM audit)::int AS audit_count FROM deleted d
        `,
        params: [input.updateId, input.actor.adminId, baseMetadata(input), input.actor.ipAddress],
    });
    if (!rows[0]) return { outcome: 'NOT_FOUND', update: null };
    return { outcome: 'OK', update: toProductUpdate(rows[0]) };
}

// ---------------------------------------------------------------------------
// Standalone audit evidence (operations that are not one local mutation)
// ---------------------------------------------------------------------------

/**
 * Required audit evidence for an operation whose effect is not a single local
 * row change (for example multi-account reconciliation). Throws when the
 * database is unavailable or the insert fails; callers must not proceed.
 */
export async function insertAdminAudit(input: {
    actor: AdminActor;
    action: AdminAction;
    targetUserId?: string | null;
    metadata: Record<string, unknown>;
    db?: StatementExecutor;
}): Promise<string> {
    const rows = await executor(input).run({
        text: `
            INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
            SELECT $1::uuid, $2::uuid, $3::text, $4::jsonb, $5::text
            WHERE EXISTS (SELECT 1 FROM accounts WHERE id = $1::uuid AND role = 'admin')
            RETURNING id
        `,
        params: [
            input.actor.adminId,
            input.targetUserId ?? null,
            input.action,
            JSON.stringify({
                ...input.metadata,
                ...(input.actor.userAgent ? { userAgent: input.actor.userAgent } : {}),
            }),
            input.actor.ipAddress,
        ],
    });
    if (!rows[0]) throw new Error('Admin audit entry was not recorded');
    return String(rows[0].id);
}
