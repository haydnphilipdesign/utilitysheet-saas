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
