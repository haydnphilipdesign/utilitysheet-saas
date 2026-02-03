/**
 * Intake link queries (reusable seller URL per account)
 */
import { sql, generateToken } from '@/lib/neon/db';

export interface IntakeLink {
    id: string;
    account_id: string;
    slug: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const RESERVED_SLUGS = new Set([
    'api',
    'admin',
    'dashboard',
    'settings',
    'billing',
    'login',
    'logout',
    'signup',
    'register',
    'terms',
    'privacy',
    'pricing',
    's',
    'i',
]);

export function slugifyIntakeSlug(input: string) {
    const slug = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '');
    return slug;
}

export function validateIntakeSlug(slug: string) {
    const normalized = slugifyIntakeSlug(slug);
    if (normalized !== slug) {
        throw new Error('Slug must be lowercase and contain only letters, numbers, and dashes.');
    }
    if (slug.length < 3 || slug.length > 60) {
        throw new Error('Slug must be between 3 and 60 characters.');
    }
    if (RESERVED_SLUGS.has(slug)) {
        throw new Error('That slug is reserved. Please choose a different one.');
    }
}

async function getUniqueIntakeSlug(baseSlug: string, excludeAccountId?: string) {
    if (!sql) return baseSlug;

    let slug = baseSlug;
    for (let attempt = 0; attempt < 50; attempt++) {
        const existing = excludeAccountId
            ? await sql`SELECT 1 FROM intake_links WHERE slug = ${slug} AND account_id != ${excludeAccountId} LIMIT 1`
            : await sql`SELECT 1 FROM intake_links WHERE slug = ${slug} LIMIT 1`;

        if (existing.length === 0) return slug;

        slug = `${baseSlug}-${attempt + 2}`;
    }

    throw new Error('Failed to generate a unique intake link slug');
}

export async function getIntakeLinkBySlug(slug: string): Promise<IntakeLink | null> {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM intake_links
        WHERE slug = ${slug}
        LIMIT 1
    `;

    return (result[0] as IntakeLink) || null;
}

export async function getOrCreateIntakeLink(accountId: string): Promise<IntakeLink | null> {
    if (!sql) return null;

    const existing = await sql`
        SELECT * FROM intake_links
        WHERE account_id = ${accountId}
        LIMIT 1
    `;
    if (existing.length > 0) return existing[0] as IntakeLink;

    // Default slug is intentionally random (so Pro/Teams can upgrade for a custom slug).
    // Use a short, URL-safe, lowercase token.
    let slug = generateToken().slice(0, 10);
    if (RESERVED_SLUGS.has(slug)) {
        slug = `link-${generateToken().slice(0, 8)}`;
    }

    const uniqueSlug = await getUniqueIntakeSlug(slug);

    const created = await sql`
        INSERT INTO intake_links (account_id, slug, is_active)
        VALUES (${accountId}, ${uniqueSlug}, TRUE)
        RETURNING *
    `;

    return (created[0] as IntakeLink) || null;
}

export async function updateIntakeLinkSlug(accountId: string, slug: string): Promise<IntakeLink | null> {
    if (!sql) return null;

    validateIntakeSlug(slug);

    const uniqueSlug = await getUniqueIntakeSlug(slug, accountId);

    const result = await sql`
        UPDATE intake_links
        SET slug = ${uniqueSlug}, updated_at = NOW()
        WHERE account_id = ${accountId}
        RETURNING *
    `;

    if (result.length > 0) return result[0] as IntakeLink;

    // Link doesn't exist yet, create it with the requested slug.
    const created = await sql`
        INSERT INTO intake_links (account_id, slug, is_active)
        VALUES (${accountId}, ${uniqueSlug}, TRUE)
        RETURNING *
    `;

    return (created[0] as IntakeLink) || null;
}
