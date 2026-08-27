/**
 * Organization-related database queries
 */
import { sql } from '@/lib/neon/db';

function slugifyOrganizationName(name: string) {
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return slug || 'organization';
}

async function getUniqueOrganizationSlug(baseSlug: string, excludeOrganizationId?: string) {
    if (!sql) return baseSlug;

    let slug = baseSlug;
    for (let attempt = 0; attempt < 50; attempt++) {
        const existing = excludeOrganizationId
            ? await sql`SELECT 1 FROM organizations WHERE slug = ${slug} AND id != ${excludeOrganizationId} LIMIT 1`
            : await sql`SELECT 1 FROM organizations WHERE slug = ${slug} LIMIT 1`;

        if (existing.length === 0) return slug;

        slug = `${baseSlug}-${attempt + 2}`;
    }

    throw new Error('Failed to generate a unique organization slug');
}

/**
 * Create a new organization and add the creator as admin
 */
export async function createOrganization(name: string, accountId: string) {
    if (!sql) return null;

    const baseSlug = slugifyOrganizationName(name);
    const slug = await getUniqueOrganizationSlug(baseSlug);

    // Create organization
    const orgResult = await sql`
        INSERT INTO organizations (name, slug)
        VALUES (${name}, ${slug})
        RETURNING *
    `;

    const organization = orgResult[0];

    // Add creator as admin
    await sql`
        INSERT INTO organization_members (organization_id, account_id, role)
        VALUES (${organization.id}, ${accountId}, 'admin')
    `;

    // Update account's active organization
    await sql`
        UPDATE accounts 
        SET active_organization_id = ${organization.id}
        WHERE id = ${accountId}
    `;

    return organization;
}

export async function getOrganizationByStripeCustomerId(stripeCustomerId: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM organizations WHERE stripe_customer_id = ${stripeCustomerId}
    `;

    return result[0] || null;
}

export async function getOrganizationById(organizationId: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM organizations WHERE id = ${organizationId}
    `;

    return result[0] || null;
}

export async function updateOrganizationStripeCustomer(organizationId: string, stripeCustomerId: string) {
    if (!sql) return null;

    const result = await sql`
        UPDATE organizations
        SET stripe_customer_id = ${stripeCustomerId}
        WHERE id = ${organizationId}
        RETURNING *
    `;

    return result[0] || null;
}

export async function updateOrganizationSubscription(
    organizationId: string,
    data: {
        subscriptionStatus: string;
        subscriptionId: string | null;
        subscriptionEndsAt: Date | null;
        seatQuantity?: number | null;
    }
) {
    if (!sql) return null;

    const result = await sql`
        UPDATE organizations
        SET 
            subscription_status = ${data.subscriptionStatus},
            subscription_id = ${data.subscriptionId},
            subscription_ends_at = ${data.subscriptionEndsAt?.toISOString() || null},
            seat_quantity = COALESCE(${data.seatQuantity ?? null}, seat_quantity),
            updated_at = NOW()
        WHERE id = ${organizationId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Atomically transfers an existing personal Stripe subscription to an
 * organization after Stripe has converted its price to Teams.
 *
 * The operation is idempotent for the same customer/subscription pair and
 * refuses to overwrite a different account or organization subscription.
 */
export async function transferAccountSubscriptionToOrganization(data: {
    accountId: string;
    organizationId: string;
    stripeCustomerId: string;
    subscriptionId: string;
    subscriptionEndsAt: Date | null;
    seatQuantity: number;
}) {
    if (!sql) return null;

    const result = await sql`
        WITH locked_account AS (
            SELECT id, stripe_customer_id, subscription_status, subscription_id
            FROM accounts
            WHERE id = ${data.accountId}
            FOR UPDATE
        ),
        locked_organization AS (
            SELECT id, stripe_customer_id, subscription_status, subscription_id
            FROM organizations
            WHERE id = ${data.organizationId}
            FOR UPDATE
        ),
        eligible AS (
            SELECT 1
            FROM locked_account account_row
            CROSS JOIN locked_organization organization_row
            WHERE (
                organization_row.subscription_id IS NULL
                OR (
                    organization_row.subscription_id = ${data.subscriptionId}
                    AND organization_row.stripe_customer_id = ${data.stripeCustomerId}
                )
            )
            AND (
                (
                    account_row.subscription_id = ${data.subscriptionId}
                    AND account_row.stripe_customer_id = ${data.stripeCustomerId}
                    AND account_row.subscription_status = 'pro'
                )
                OR (
                    account_row.subscription_id IS NULL
                    AND account_row.stripe_customer_id IS NULL
                    AND account_row.subscription_status = 'free'
                    AND organization_row.subscription_id = ${data.subscriptionId}
                    AND organization_row.stripe_customer_id = ${data.stripeCustomerId}
                )
            )
        ),
        updated_organization AS (
            UPDATE organizations organization_row
            SET stripe_customer_id = ${data.stripeCustomerId},
                subscription_status = 'team',
                subscription_id = ${data.subscriptionId},
                subscription_ends_at = ${data.subscriptionEndsAt?.toISOString() || null},
                seat_quantity = ${data.seatQuantity},
                updated_at = NOW()
            WHERE organization_row.id = ${data.organizationId}
                AND EXISTS (SELECT 1 FROM eligible)
            RETURNING organization_row.*
        ),
        updated_account AS (
            UPDATE accounts account_row
            SET stripe_customer_id = NULL,
                subscription_status = 'free',
                subscription_id = NULL,
                subscription_ends_at = NULL,
                updated_at = NOW()
            WHERE account_row.id = ${data.accountId}
                AND EXISTS (SELECT 1 FROM updated_organization)
                AND (
                    account_row.subscription_id = ${data.subscriptionId}
                    OR (
                        account_row.subscription_id IS NULL
                        AND account_row.stripe_customer_id IS NULL
                        AND account_row.subscription_status = 'free'
                    )
                )
            RETURNING account_row.*
        )
        SELECT
            (SELECT row_to_json(updated_organization) FROM updated_organization) AS organization,
            (SELECT row_to_json(updated_account) FROM updated_account) AS account
        WHERE EXISTS (SELECT 1 FROM updated_organization)
            AND EXISTS (SELECT 1 FROM updated_account)
    `;

    const row = result[0] as { organization?: unknown; account?: unknown } | undefined;
    const organization = parseJsonColumn(row?.organization);
    const account = parseJsonColumn(row?.account);
    return organization && account ? { organization, account } : null;
}

/**
 * Update organization name and slug
 */
export async function updateOrganization(organizationId: string, name: string) {
    if (!sql) return null;

    const baseSlug = slugifyOrganizationName(name);
    const slug = await getUniqueOrganizationSlug(baseSlug, organizationId);

    const result = await sql`
        UPDATE organizations
        SET name = ${name}, slug = ${slug}, updated_at = NOW()
        WHERE id = ${organizationId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Update workspace-level notification routing settings.
 * Settings are stored as a JSONB map of boolean flags on the organization.
 */
export async function updateOrganizationNotificationSettings(
    organizationId: string,
    settings: Record<string, boolean>
) {
    if (!sql) return null;

    const result = await sql`
        UPDATE organizations
        SET notification_settings = ${JSON.stringify(settings)}::jsonb,
            updated_at = NOW()
        WHERE id = ${organizationId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Get the current members of an organization who are admins, along with the
 * account email and personal notification preferences needed to decide whether
 * to route a workspace notification to them. Recipients are derived live from
 * membership, so removed members are never returned.
 */
export async function getOrganizationAdminRecipients(organizationId: string) {
    if (!sql) return [];

    const result = await sql`
        SELECT
            a.id AS account_id,
            a.email,
            a.full_name,
            a.notification_preferences
        FROM organization_members om
        JOIN accounts a ON a.id = om.account_id
        WHERE om.organization_id = ${organizationId}
            AND om.role = 'admin'
            AND a.email IS NOT NULL
        ORDER BY om.created_at ASC
    `;

    return result as Array<{
        account_id: string;
        email: string | null;
        full_name: string | null;
        notification_preferences: Record<string, unknown> | null;
    }>;
}

/**
 * Get all organizations an account is a member of
 */
export async function getAccountOrganizations(accountId: string) {
    if (!sql) return [];

    const result = await sql`
        SELECT o.*, om.role
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.account_id = ${accountId}
        ORDER BY o.created_at ASC
    `;

    return result;
}

export async function getOrganizationMemberRole(organizationId: string, accountId: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT role
        FROM organization_members
        WHERE organization_id = ${organizationId}
            AND account_id = ${accountId}
        LIMIT 1
    `;

    return (result[0]?.role as 'admin' | 'member' | undefined) || null;
}

export async function getOrganizationMembers(organizationId: string) {
    if (!sql) return [];

    const result = await sql`
        SELECT
            a.id as account_id,
            a.email,
            a.full_name,
            a.company_name,
            a.phone,
            om.role as member_role,
            om.created_at as joined_at
        FROM organization_members om
        JOIN accounts a ON a.id = om.account_id
        WHERE om.organization_id = ${organizationId}
        ORDER BY om.created_at ASC
    `;

    return result;
}

export async function isOrganizationMemberByEmail(organizationId: string, email: string) {
    if (!sql) return false;

    const normalizedEmail = email.trim().toLowerCase();
    const result = await sql`
        SELECT 1
        FROM organization_members om
        JOIN accounts a ON a.id = om.account_id
        WHERE om.organization_id = ${organizationId}
            AND lower(a.email) = ${normalizedEmail}
        LIMIT 1
    `;

    return result.length > 0;
}

export async function getOrganizationAdminCount(organizationId: string) {
    if (!sql) return 0;

    const result = await sql`
        SELECT COUNT(*)::int as count
        FROM organization_members
        WHERE organization_id = ${organizationId}
            AND role = 'admin'
    `;

    return Number(result[0]?.count) || 0;
}

export async function getOrganizationSeatUsage(organizationId: string) {
    if (!sql) {
        return { used: 0, pendingInvites: 0 };
    }

    const [members, invites] = await Promise.all([
        sql`
            SELECT COUNT(*)::int as count
            FROM organization_members
            WHERE organization_id = ${organizationId}
        `,
        sql`
            SELECT COUNT(*)::int as count
            FROM organization_invitations
            WHERE organization_id = ${organizationId}
                AND accepted_at IS NULL
                AND expires_at > NOW()
        `,
    ]);

    return {
        used: Number(members[0]?.count) || 0,
        pendingInvites: Number(invites[0]?.count) || 0,
    };
}

export async function clearActiveOrganizationIfMatches(accountId: string, organizationId: string) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts
        SET active_organization_id = NULL
        WHERE id = ${accountId}
            AND active_organization_id = ${organizationId}
        RETURNING *
    `;

    return result[0] || null;
}

export async function getPendingOrganizationInvite(organizationId: string, email: string) {
    if (!sql) return null;

    const normalizedEmail = email.trim().toLowerCase();
    const result = await sql`
        SELECT *
        FROM organization_invitations
        WHERE organization_id = ${organizationId}
            AND lower(email) = ${normalizedEmail}
            AND accepted_at IS NULL
            AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
    `;

    return result[0] || null;
}

export async function createOrganizationInvite(data: {
    organizationId: string;
    email: string;
    role?: 'admin' | 'member';
    token: string;
    invitedByAccountId: string;
    expiresAt: Date;
}) {
    if (!sql) return null;

    const normalizedEmail = data.email.trim().toLowerCase();

    const result = await sql`
        INSERT INTO organization_invitations (
            organization_id,
            email,
            role,
            token,
            invited_by_account_id,
            expires_at
        ) VALUES (
            ${data.organizationId},
            ${normalizedEmail},
            ${data.role || 'member'},
            ${data.token},
            ${data.invitedByAccountId},
            ${data.expiresAt.toISOString()}
        )
        RETURNING *
    `;

    return result[0] || null;
}

function parseJsonColumn<T extends Record<string, unknown>>(value: unknown): T | null {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    if (typeof value === 'object') {
        return value as T;
    }
    return null;
}

export type CreateOrganizationInviteSeatGuardResult =
    | { status: 'created'; invite: Record<string, unknown> }
    | { status: 'existing'; invite: Record<string, unknown> }
    | { status: 'no_seat' };

/**
 * Atomically creates a new pending invite only when seats are available.
 * Uses a row lock on the organization to serialize seat decisions.
 */
export async function createOrganizationInviteWithSeatGuard(data: {
    organizationId: string;
    email: string;
    role?: 'admin' | 'member';
    token: string;
    invitedByAccountId: string;
    expiresAt: Date;
}): Promise<CreateOrganizationInviteSeatGuardResult> {
    if (!sql) return { status: 'no_seat' };

    const normalizedEmail = data.email.trim().toLowerCase();

    const result = await sql`
        WITH organization_row AS (
            SELECT id, seat_quantity
            FROM organizations
            WHERE id = ${data.organizationId}
            FOR UPDATE
        ),
        existing_pending AS (
            SELECT *
            FROM organization_invitations
            WHERE organization_id = ${data.organizationId}
                AND lower(email) = ${normalizedEmail}
                AND accepted_at IS NULL
                AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        ),
        seat_usage AS (
            SELECT
                (
                    SELECT COUNT(*)::int
                    FROM organization_members
                    WHERE organization_id = ${data.organizationId}
                ) AS used,
                (
                    SELECT COUNT(*)::int
                    FROM organization_invitations
                    WHERE organization_id = ${data.organizationId}
                        AND accepted_at IS NULL
                        AND expires_at > NOW()
                ) AS pending
        ),
        inserted_invite AS (
            INSERT INTO organization_invitations (
                organization_id,
                email,
                role,
                token,
                invited_by_account_id,
                expires_at
            )
            SELECT
                ${data.organizationId},
                ${normalizedEmail},
                ${data.role || 'member'},
                ${data.token},
                ${data.invitedByAccountId},
                ${data.expiresAt.toISOString()}
            FROM organization_row, seat_usage
            WHERE NOT EXISTS (SELECT 1 FROM existing_pending)
                AND organization_row.seat_quantity > 0
                AND (seat_usage.used + seat_usage.pending) < organization_row.seat_quantity
            RETURNING *
        )
        SELECT
            (SELECT row_to_json(existing_pending) FROM existing_pending LIMIT 1) AS existing_invite,
            (SELECT row_to_json(inserted_invite) FROM inserted_invite LIMIT 1) AS created_invite
    `;

    const row = result[0] as { existing_invite?: unknown; created_invite?: unknown } | undefined;
    const existingInvite = parseJsonColumn(row?.existing_invite);
    if (existingInvite) {
        return { status: 'existing', invite: existingInvite };
    }

    const createdInvite = parseJsonColumn(row?.created_invite);
    if (createdInvite) {
        return { status: 'created', invite: createdInvite };
    }

    return { status: 'no_seat' };
}

export async function getOrganizationInviteByToken(token: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT *
        FROM organization_invitations
        WHERE token = ${token}
        LIMIT 1
    `;

    return result[0] || null;
}

export async function getOrganizationInvites(organizationId: string) {
    if (!sql) return [];

    const result = await sql`
        SELECT *
        FROM organization_invitations
        WHERE organization_id = ${organizationId}
        ORDER BY created_at DESC
    `;

    return result;
}

export async function getPendingOrganizationInvites(organizationId: string) {
    if (!sql) return [];

    const result = await sql`
        SELECT
            id,
            email,
            role,
            invited_by_account_id,
            expires_at,
            created_at,
            updated_at
        FROM organization_invitations
        WHERE organization_id = ${organizationId}
            AND accepted_at IS NULL
            AND expires_at > NOW()
        ORDER BY created_at DESC
    `;

    return result;
}

export async function getOrganizationInviteForOrganization(inviteId: string, organizationId: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT
            id,
            organization_id,
            email,
            role,
            invited_by_account_id,
            expires_at,
            created_at,
            updated_at
        FROM organization_invitations
        WHERE id = ${inviteId}
            AND organization_id = ${organizationId}
            AND accepted_at IS NULL
            AND expires_at > NOW()
        LIMIT 1
    `;

    return result[0] || null;
}

export async function refreshPendingOrganizationInvite(data: {
    inviteId: string;
    organizationId: string;
    token: string;
    invitedByAccountId: string;
    expiresAt: Date;
}) {
    if (!sql) return null;

    const result = await sql`
        UPDATE organization_invitations
        SET
            token = ${data.token},
            invited_by_account_id = ${data.invitedByAccountId},
            expires_at = ${data.expiresAt.toISOString()},
            updated_at = NOW()
        WHERE id = ${data.inviteId}
            AND organization_id = ${data.organizationId}
            AND accepted_at IS NULL
            AND expires_at > NOW()
        RETURNING *
    `;

    return result[0] || null;
}

export async function cancelPendingOrganizationInvite(inviteId: string, organizationId: string) {
    if (!sql) return false;

    const result = await sql`
        DELETE FROM organization_invitations
        WHERE id = ${inviteId}
            AND organization_id = ${organizationId}
            AND accepted_at IS NULL
            AND expires_at > NOW()
        RETURNING id
    `;

    return result.length > 0;
}

export async function acceptOrganizationInvite(inviteId: string) {
    if (!sql) return null;

    const result = await sql`
        UPDATE organization_invitations
        SET accepted_at = NOW(), updated_at = NOW()
        WHERE id = ${inviteId}
        RETURNING *
    `;

    return result[0] || null;
}

export type AcceptOrganizationInviteSeatGuardResult =
    | { status: 'accepted'; memberInserted: boolean }
    | { status: 'already_accepted' }
    | { status: 'no_seat' };

/**
 * Atomically accepts an invite and adds membership if needed and seats allow.
 * Uses a row lock on the organization to serialize seat decisions.
 */
export async function acceptOrganizationInviteWithSeatGuard(data: {
    organizationId: string;
    inviteId: string;
    accountId: string;
    role: 'admin' | 'member';
}): Promise<AcceptOrganizationInviteSeatGuardResult> {
    if (!sql) return { status: 'no_seat' };

    const result = await sql`
        WITH organization_row AS (
            SELECT id, seat_quantity
            FROM organizations
            WHERE id = ${data.organizationId}
            FOR UPDATE
        ),
        invite_state AS (
            SELECT accepted_at
            FROM organization_invitations
            WHERE id = ${data.inviteId}
            LIMIT 1
        ),
        existing_member AS (
            SELECT 1 AS present
            FROM organization_members
            WHERE organization_id = ${data.organizationId}
                AND account_id = ${data.accountId}
            LIMIT 1
        ),
        seat_usage AS (
            SELECT COUNT(*)::int AS used
            FROM organization_members
            WHERE organization_id = ${data.organizationId}
        ),
        inserted_member AS (
            INSERT INTO organization_members (organization_id, account_id, role)
            SELECT
                ${data.organizationId},
                ${data.accountId},
                ${data.role}
            FROM organization_row, seat_usage
            WHERE NOT EXISTS (SELECT 1 FROM existing_member)
                AND organization_row.seat_quantity > 0
                AND seat_usage.used < organization_row.seat_quantity
            ON CONFLICT (organization_id, account_id) DO NOTHING
            RETURNING id
        ),
        updated_invite AS (
            UPDATE organization_invitations
            SET accepted_at = NOW(), updated_at = NOW()
            WHERE id = ${data.inviteId}
                AND accepted_at IS NULL
                AND (
                    EXISTS (SELECT 1 FROM existing_member)
                    OR EXISTS (SELECT 1 FROM inserted_member)
                )
            RETURNING id
        )
        SELECT
            EXISTS(SELECT 1 FROM updated_invite) AS invite_accepted,
            EXISTS(SELECT 1 FROM invite_state WHERE accepted_at IS NOT NULL) AS invite_already_accepted,
            (
                EXISTS (SELECT 1 FROM existing_member)
                OR EXISTS (
                    SELECT 1
                    FROM organization_row, seat_usage
                    WHERE organization_row.seat_quantity > 0
                        AND seat_usage.used < organization_row.seat_quantity
                )
                OR EXISTS (SELECT 1 FROM inserted_member)
            ) AS seat_or_existing_member_ok,
            EXISTS(SELECT 1 FROM inserted_member) AS member_inserted
    `;

    const row = result[0] as {
        invite_accepted?: boolean;
        invite_already_accepted?: boolean;
        seat_or_existing_member_ok?: boolean;
        member_inserted?: boolean;
    } | undefined;

    if (row?.invite_accepted) {
        return { status: 'accepted', memberInserted: Boolean(row.member_inserted) };
    }

    if (row?.invite_already_accepted) {
        return { status: 'already_accepted' };
    }

    if (!row?.seat_or_existing_member_ok) {
        return { status: 'no_seat' };
    }

    return { status: 'already_accepted' };
}

export async function addOrganizationMember(data: {
    organizationId: string;
    accountId: string;
    role?: 'admin' | 'member';
}) {
    if (!sql) return null;

    const result = await sql`
        INSERT INTO organization_members (organization_id, account_id, role)
        VALUES (${data.organizationId}, ${data.accountId}, ${data.role || 'member'})
        ON CONFLICT (organization_id, account_id) DO NOTHING
        RETURNING *
    `;

    return result[0] || null;
}

export async function removeOrganizationMember(data: { organizationId: string; accountId: string }) {
    if (!sql) return false;

    const result = await sql`
        DELETE FROM organization_members
        WHERE organization_id = ${data.organizationId}
            AND account_id = ${data.accountId}
        RETURNING id
    `;

    return result.length > 0;
}

export async function updateOrganizationMemberRole(data: {
    organizationId: string;
    accountId: string;
    role: 'admin' | 'member';
}) {
    if (!sql) return null;

    const result = await sql`
        UPDATE organization_members
        SET role = ${data.role}
        WHERE organization_id = ${data.organizationId}
            AND account_id = ${data.accountId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Set the active organization for an account
 */
export async function setActiveOrganization(accountId: string, organizationId: string | null) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts 
        SET active_organization_id = ${organizationId}
        WHERE id = ${accountId}
        RETURNING *
    `;

    return result[0];
}

/**
 * Set the active organization only when the account is a current member.
 * Intended for authenticated user-driven workspace switching.
 */
export async function setActiveOrganizationForMember(accountId: string, organizationId: string) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts
        SET active_organization_id = ${organizationId}, updated_at = NOW()
        WHERE id = ${accountId}
            AND EXISTS (
                SELECT 1
                FROM organization_members om
                WHERE om.organization_id = ${organizationId}
                    AND om.account_id = ${accountId}
            )
        RETURNING *
    `;

    return result[0] || null;
}
