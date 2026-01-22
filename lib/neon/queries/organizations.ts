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
