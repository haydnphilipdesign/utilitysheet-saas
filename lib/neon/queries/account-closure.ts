/**
 * Account closure queries.
 *
 * Closure keeps a pseudonymous accounts row (see
 * .ai/decisions/2026-09-16-self-serve-account-closure-lifecycle.md), so no
 * statement here deletes from accounts and nothing cascades from it.
 */
import { sql } from '@/lib/neon/db';

export type AccountClosureStatus = 'active' | 'closing' | 'closed';
export type AccountClosureStep =
    | 'requested'
    | 'billing_canceled'
    | 'data_removed'
    | 'assets_removed'
    | 'auth_deleted'
    | 'completed';

/** Organization id -> receiving admin account id. */
export type ClosureTransfers = Record<string, string>;

export type ClosureWorkspaceSnapshot = {
    id: string;
    name: string;
    role: 'admin' | 'member';
    subscription_status: string | null;
    subscription_id: string | null;
    member_count: number;
    is_sole_member: boolean;
    owned_request_count: number;
    owned_profile_count: number;
    workspace_request_count: number;
    workspace_open_request_count: number;
    other_admins: Array<{ accountId: string; name: string }>;
};

export type AccountClosureSnapshot = {
    account: {
        id: string;
        role: string;
        subscription_status: string | null;
        subscription_id: string | null;
        closure_status: AccountClosureStatus;
    };
    workspaces: ClosureWorkspaceSnapshot[];
    personal: {
        request_count: number;
        open_request_count: number;
        profile_count: number;
        has_seller_form: boolean;
        unapplied_referral_credits: number;
        pending_invitations: number;
    };
};

export type AccountClosureRecord = {
    account_id: string;
    auth_user_id: string | null;
    /** Pre-closure sign-in email until data removal replaces it. */
    email: string;
    closure_status: AccountClosureStatus;
    subscription_id: string | null;
    step: AccountClosureStep;
    transfers: ClosureTransfers;
    pending_blob_urls: string[];
    attempt_count: number;
    last_error_code: string | null;
};

export class AccountClosureConflictError extends Error {
    constructor(public readonly code: string) {
        super(code);
        this.name = 'AccountClosureConflictError';
    }
}

export function closedAccountEmail(accountId: string) {
    return `closed+${accountId}@closed.utilitysheet.invalid`;
}

function normalizeStatus(value: unknown): AccountClosureStatus {
    return value === 'closing' || value === 'closed' ? value : 'active';
}

/**
 * Reads closure state without naming the column directly, so callers keep
 * working before migrations-account-closure.sql is applied.
 */
export async function getAccountClosureStatusByAuthUserId(authUserId: string) {
    if (!sql) return null;
    const rows = await sql`
        SELECT id, to_jsonb(accounts) ->> 'closure_status' AS closure_status
        FROM accounts
        WHERE auth_user_id = ${authUserId}
        LIMIT 1
    `;
    if (!rows[0]) return null;
    return { accountId: rows[0].id as string, status: normalizeStatus(rows[0].closure_status) };
}

export async function getAccountClosureSnapshot(accountId: string, email: string): Promise<AccountClosureSnapshot | null> {
    if (!sql) return null;
    const normalizedEmail = email.trim().toLowerCase();

    const [accounts, workspaces, personal] = await Promise.all([
        sql`
            SELECT id, role, subscription_status, subscription_id,
                to_jsonb(accounts) ->> 'closure_status' AS closure_status
            FROM accounts
            WHERE id = ${accountId}
        `,
        sql`
            SELECT
                o.id, o.name, COALESCE(om.role, 'member') AS role,
                o.subscription_status, o.subscription_id,
                (SELECT COUNT(*)::int FROM organization_members m WHERE m.organization_id = o.id) AS member_count,
                (
                    om.account_id IS NOT NULL
                    AND (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id) = 1
                ) AS is_sole_member,
                (SELECT COUNT(*)::int FROM requests r WHERE r.organization_id = o.id AND r.account_id = ${accountId}) AS owned_request_count,
                (SELECT COUNT(*)::int FROM brand_profiles b WHERE b.organization_id = o.id AND b.account_id = ${accountId}) AS owned_profile_count,
                (SELECT COUNT(*)::int FROM requests r
                    WHERE r.organization_id = o.id AND r.deleted_at IS NULL) AS workspace_request_count,
                (SELECT COUNT(*)::int FROM requests r
                    WHERE r.organization_id = o.id AND r.deleted_at IS NULL
                        AND r.status IN ('sent', 'in_progress')) AS workspace_open_request_count,
                (
                    SELECT COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'accountId', a.id,
                                'name', COALESCE(NULLIF(TRIM(a.full_name), ''), a.email)
                            )
                            ORDER BY m.created_at ASC, a.id ASC
                        ),
                        '[]'::jsonb
                    )
                    FROM organization_members m
                    JOIN accounts a ON a.id = m.account_id
                    WHERE m.organization_id = o.id
                        AND m.role = 'admin'
                        AND m.account_id <> ${accountId}
                ) AS other_admins
            FROM organizations o
            LEFT JOIN organization_members om
                ON om.organization_id = o.id AND om.account_id = ${accountId}
            WHERE om.account_id IS NOT NULL
                OR EXISTS (SELECT 1 FROM requests r WHERE r.organization_id = o.id AND r.account_id = ${accountId})
                OR EXISTS (SELECT 1 FROM brand_profiles b WHERE b.organization_id = o.id AND b.account_id = ${accountId})
            ORDER BY COALESCE(om.created_at, o.created_at) ASC
        `,
        sql`
            SELECT
                (SELECT COUNT(*)::int FROM requests
                    WHERE account_id = ${accountId} AND organization_id IS NULL
                        AND deleted_at IS NULL) AS request_count,
                (SELECT COUNT(*)::int FROM requests
                    WHERE account_id = ${accountId} AND organization_id IS NULL
                        AND deleted_at IS NULL
                        AND status IN ('sent', 'in_progress')) AS open_request_count,
                (SELECT COUNT(*)::int FROM brand_profiles
                    WHERE account_id = ${accountId} AND organization_id IS NULL) AS profile_count,
                EXISTS (SELECT 1 FROM intake_links WHERE account_id = ${accountId}) AS has_seller_form,
                (SELECT COUNT(*)::int FROM referral_credits
                    WHERE referrer_account_id = ${accountId} AND status = 'earned') AS unapplied_referral_credits,
                (SELECT COUNT(*)::int FROM organization_invitations
                    WHERE lower(email) = ${normalizedEmail} AND accepted_at IS NULL AND expires_at > NOW()) AS pending_invitations
        `,
    ]);

    if (!accounts[0]) return null;
    return {
        account: {
            id: accounts[0].id as string,
            role: String(accounts[0].role || 'user'),
            subscription_status: (accounts[0].subscription_status as string | null) ?? null,
            subscription_id: (accounts[0].subscription_id as string | null) ?? null,
            closure_status: normalizeStatus(accounts[0].closure_status),
        },
        workspaces: workspaces as unknown as ClosureWorkspaceSnapshot[],
        personal: personal[0] as AccountClosureSnapshot['personal'],
    };
}

/**
 * Atomically moves an active account to `closing`. Returns false when the
 * account was not active (already closing or closed), so a double submit
 * cannot start two closures. An earlier attempt can only have been rolled back
 * before data removal, so a new attempt restarts at billing, which checks each
 * subscription's live status and never cancels twice.
 */
export async function claimAccountClosure(data: {
    accountId: string;
    transfers: ClosureTransfers;
    notifyEmail: string;
}) {
    if (!sql) return false;
    const rows = await sql`
        WITH claimed AS (
            UPDATE accounts
            SET closure_status = 'closing', closure_requested_at = NOW(), updated_at = NOW()
            WHERE id = ${data.accountId} AND closure_status = 'active'
            RETURNING id
        )
        INSERT INTO account_closures (account_id, transfers, notify_email)
        SELECT id, ${JSON.stringify(data.transfers)}::jsonb, ${data.notifyEmail} FROM claimed
        ON CONFLICT (account_id) DO UPDATE
        SET step = 'requested',
            transfers = EXCLUDED.transfers,
            notify_email = EXCLUDED.notify_email,
            attempt_count = 0,
            last_error_code = NULL,
            lease_until = NULL,
            updated_at = NOW()
        RETURNING account_id
    `;
    return rows.length > 0;
}

export async function getAccountClosure(accountId: string): Promise<AccountClosureRecord | null> {
    if (!sql) return null;
    const rows = await sql`
        SELECT c.account_id, a.auth_user_id, a.email, a.closure_status, a.subscription_id,
            c.step, c.transfers, c.pending_blob_urls, c.attempt_count, c.last_error_code
        FROM account_closures c
        JOIN accounts a ON a.id = c.account_id
        WHERE c.account_id = ${accountId}
    `;
    return (rows[0] as AccountClosureRecord) || null;
}

/** Takes a short lease so the user retry and the cron never run the same closure at once. */
export async function acquireAccountClosureLease(accountId: string, leaseSeconds = 120) {
    if (!sql) return false;
    const rows = await sql`
        UPDATE account_closures
        SET lease_until = NOW() + make_interval(secs => ${leaseSeconds}),
            attempt_count = attempt_count + 1,
            updated_at = NOW()
        WHERE account_id = ${accountId}
            AND step <> 'completed'
            AND (lease_until IS NULL OR lease_until < NOW())
        RETURNING account_id
    `;
    return rows.length > 0;
}

export async function releaseAccountClosureLease(accountId: string, errorCode: string | null) {
    if (!sql) return;
    await sql`
        UPDATE account_closures
        SET lease_until = NULL, last_error_code = ${errorCode}, updated_at = NOW()
        WHERE account_id = ${accountId}
    `;
}

export async function advanceAccountClosureStep(accountId: string, from: AccountClosureStep, to: AccountClosureStep) {
    if (!sql) return false;
    const rows = await sql`
        UPDATE account_closures
        SET step = ${to}, updated_at = NOW()
        WHERE account_id = ${accountId} AND step = ${from}
        RETURNING account_id
    `;
    return rows.length > 0;
}

/**
 * Returns a closing account to `active`. Only allowed before any data was
 * removed, so the user keeps a working account after a billing or workspace
 * conflict.
 */
export async function revertAccountClosure(accountId: string, errorCode: string) {
    if (!sql) return false;
    const rows = await sql`
        WITH reverted AS (
            UPDATE accounts a
            SET closure_status = 'active', closure_requested_at = NULL, updated_at = NOW()
            FROM account_closures c
            WHERE a.id = ${accountId}
                AND c.account_id = a.id
                AND a.closure_status = 'closing'
                AND c.step IN ('requested', 'billing_canceled')
            RETURNING a.id
        )
        UPDATE account_closures
        SET lease_until = NULL, last_error_code = ${errorCode}, notify_email = NULL, updated_at = NOW()
        WHERE account_id IN (SELECT id FROM reverted)
        RETURNING account_id
    `;
    return rows.length > 0;
}

export async function getSoleMemberOrganizations(accountId: string) {
    if (!sql) return [];
    const rows = await sql`
        SELECT o.id, o.subscription_status, o.subscription_id
        FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE om.account_id = ${accountId}
            AND (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id) = 1
        ORDER BY o.id
    `;
    return rows as Array<{ id: string; subscription_status: string | null; subscription_id: string | null }>;
}

/**
 * Removes and transfers the account's UtilitySheet data in one transaction.
 * The first statement re-checks every precondition and aborts the whole
 * transaction (by failing an integer cast) if anything changed since review.
 */
export async function removeAccountClosureData(data: {
    accountId: string;
    email: string;
    soleOrganizationIds: string[];
    transfers: ClosureTransfers;
}) {
    if (!sql) throw new Error('Database is not configured');
    const id = data.accountId;
    const sole = data.soleOrganizationIds;
    const transfers = JSON.stringify(data.transfers);
    const email = data.email.trim().toLowerCase();
    const tombstoneEmail = closedAccountEmail(id);

    try {
        await sql.transaction([
            sql`
                SELECT CASE WHEN (
                    a.closure_status IS DISTINCT FROM 'closing'
                    OR NOT EXISTS (
                        SELECT 1 FROM account_closures c
                        WHERE c.account_id = a.id AND c.step = 'billing_canceled'
                    )
                    OR EXISTS (
                        SELECT 1 FROM unnest(${sole}::uuid[]) AS s(id)
                        WHERE (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = s.id) <> 1
                            OR NOT EXISTS (
                                SELECT 1 FROM organization_members m
                                WHERE m.organization_id = s.id AND m.account_id = a.id
                            )
                    )
                    OR EXISTS (
                        SELECT 1 FROM jsonb_each_text(${transfers}::jsonb) t
                        WHERE t.value::uuid = a.id
                            OR NOT EXISTS (
                                SELECT 1 FROM organization_members m
                                WHERE m.organization_id = t.key::uuid
                                    AND m.account_id = t.value::uuid
                                    AND m.role = 'admin'
                            )
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM (
                            SELECT r.organization_id
                            FROM requests r
                            WHERE r.account_id = a.id AND r.organization_id IS NOT NULL
                            UNION
                            SELECT b.organization_id
                            FROM brand_profiles b
                            WHERE b.account_id = a.id AND b.organization_id IS NOT NULL
                        ) owned
                        WHERE (${transfers}::jsonb ->> owned.organization_id::text) IS NULL
                            OR NOT EXISTS (
                                SELECT 1
                                FROM organization_members recipient
                                WHERE recipient.organization_id = owned.organization_id
                                    AND recipient.account_id = (${transfers}::jsonb ->> owned.organization_id::text)::uuid
                                    AND recipient.role = 'admin'
                            )
                    )
                    OR EXISTS (
                        SELECT 1 FROM organization_members me
                        WHERE me.account_id = a.id
                            AND NOT (me.organization_id = ANY(${sole}::uuid[]))
                            AND (
                                (me.role = 'admin' AND NOT EXISTS (
                                    SELECT 1 FROM organization_members other
                                    WHERE other.organization_id = me.organization_id
                                        AND other.role = 'admin'
                                        AND other.account_id <> a.id
                                ))
                                OR (
                                    (${transfers}::jsonb ->> me.organization_id::text) IS NULL
                                    AND (
                                        EXISTS (SELECT 1 FROM requests r WHERE r.account_id = a.id AND r.organization_id = me.organization_id)
                                        OR EXISTS (SELECT 1 FROM brand_profiles b WHERE b.account_id = a.id AND b.organization_id = me.organization_id)
                                    )
                                )
                            )
                    )
                ) THEN CAST('closure_conflict:' || a.id::text AS INT) ELSE 0 END AS ok
                FROM accounts a
                WHERE a.id = ${id}
            `,
            sql`
                UPDATE account_closures
                SET pending_blob_urls = (
                    SELECT COALESCE(jsonb_agg(DISTINCT u.url), '[]'::jsonb)
                    FROM (
                        SELECT logo_url AS url FROM brand_profiles
                        WHERE (account_id = ${id} OR organization_id = ANY(${sole}::uuid[])) AND logo_url IS NOT NULL
                        UNION
                        SELECT logo_url AS url FROM organizations
                        WHERE id = ANY(${sole}::uuid[]) AND logo_url IS NOT NULL
                    ) u
                ),
                updated_at = NOW()
                WHERE account_id = ${id}
            `,
            sql`
                UPDATE requests r
                SET account_id = t.value::uuid
                FROM jsonb_each_text(${transfers}::jsonb) t
                WHERE r.account_id = ${id} AND r.organization_id = t.key::uuid
            `,
            sql`
                UPDATE brand_profiles b
                SET account_id = t.value::uuid
                FROM jsonb_each_text(${transfers}::jsonb) t
                WHERE b.account_id = ${id} AND b.organization_id = t.key::uuid
            `,
            sql`DELETE FROM requests WHERE organization_id = ANY(${sole}::uuid[])`,
            sql`DELETE FROM brand_profiles WHERE organization_id = ANY(${sole}::uuid[])`,
            sql`DELETE FROM organizations WHERE id = ANY(${sole}::uuid[])`,
            sql`DELETE FROM organization_members WHERE account_id = ${id}`,
            sql`DELETE FROM requests WHERE account_id = ${id} AND organization_id IS NULL`,
            sql`DELETE FROM brand_profiles WHERE account_id = ${id} AND organization_id IS NULL`,
            sql`DELETE FROM intake_links WHERE account_id = ${id}`,
            sql`DELETE FROM question_requests WHERE account_id = ${id}`,
            sql`DELETE FROM growth_attributions WHERE account_id = ${id}`,
            sql`DELETE FROM activation_outreach_logs WHERE account_id = ${id}`,
            sql`
                DELETE FROM organization_invitations
                WHERE lower(email) = ${email} AND accepted_at IS NULL
            `,
            sql`
                UPDATE organization_invitations
                SET invited_by_account_id = NULL
                WHERE invited_by_account_id = ${id}
            `,
            sql`
                UPDATE referral_credits
                SET status = 'forfeited'
                WHERE referrer_account_id = ${id} AND status = 'earned'
            `,
            sql`
                UPDATE testimonial_outreach_logs
                SET recipient_email = ${tombstoneEmail}, recipient_name = NULL
                WHERE user_id = ${id}
            `,
            sql`
                UPDATE accounts
                SET email = ${tombstoneEmail},
                    full_name = NULL,
                    company_name = NULL,
                    phone = NULL,
                    notification_preferences = '{}'::jsonb,
                    active_organization_id = NULL,
                    subscription_status = CASE WHEN subscription_id IS NULL THEN 'free' ELSE 'canceled' END,
                    updated_at = NOW()
                WHERE id = ${id} AND closure_status = 'closing'
            `,
            sql`
                UPDATE account_closures
                SET step = 'data_removed', updated_at = NOW()
                WHERE account_id = ${id} AND step = 'billing_canceled'
            `,
        ]);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('closure_conflict')) {
            throw new AccountClosureConflictError('workspace_changed');
        }
        throw error;
    }
}

/** Returns the candidate logo URLs that no remaining profile or workspace uses. */
export async function filterUnreferencedLogoUrls(urls: string[]) {
    if (!sql || urls.length === 0) return [];
    const rows = await sql`
        SELECT u.url
        FROM unnest(${urls}::text[]) AS u(url)
        WHERE NOT EXISTS (SELECT 1 FROM brand_profiles b WHERE b.logo_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.logo_url = u.url)
    `;
    return rows.map((row) => row.url as string);
}

/**
 * Marks the closure complete exactly once and hands back the pre-closure email
 * so the caller can send the confirmation. The stored address is cleared here.
 */
export async function completeAccountClosure(accountId: string) {
    if (!sql) return null;
    const rows = await sql`
        WITH previous AS (
            SELECT account_id, notify_email
            FROM account_closures
            WHERE account_id = ${accountId} AND step = 'auth_deleted'
            FOR UPDATE
        ),
        closed_account AS (
            UPDATE accounts
            SET closure_status = 'closed', closed_at = NOW(), updated_at = NOW()
            WHERE id IN (SELECT account_id FROM previous)
            RETURNING id
        )
        UPDATE account_closures c
        SET step = 'completed', completed_at = NOW(), notify_email = NULL,
            lease_until = NULL, last_error_code = NULL, updated_at = NOW()
        FROM previous
        WHERE c.account_id = previous.account_id
            AND EXISTS (SELECT 1 FROM closed_account)
        RETURNING previous.notify_email
    `;
    if (!rows[0]) return null;
    return { notifyEmail: (rows[0].notify_email as string | null) ?? null };
}

export async function listStalledAccountClosures(options: { olderThanMinutes: number; maxAttempts: number; limit: number }) {
    if (!sql) return [];
    const rows = await sql`
        SELECT c.account_id, c.attempt_count, c.step
        FROM account_closures c
        JOIN accounts a ON a.id = c.account_id
        WHERE a.closure_status = 'closing'
            AND c.step <> 'completed'
            AND c.updated_at < NOW() - make_interval(mins => ${options.olderThanMinutes})
            AND (c.lease_until IS NULL OR c.lease_until < NOW())
        ORDER BY c.updated_at ASC
        LIMIT ${options.limit}
    `;
    return rows.map((row) => ({
        accountId: row.account_id as string,
        attemptCount: Number(row.attempt_count) || 0,
        step: row.step as AccountClosureStep,
        exhausted: (Number(row.attempt_count) || 0) >= options.maxAttempts,
    }));
}
