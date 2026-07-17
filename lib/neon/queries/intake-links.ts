/**
 * Intake link queries (reusable seller URL per account)
 */
import { sql, generateToken } from '@/lib/neon/db';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode, UtilityCategory } from '@/types';

export interface IntakeLink {
    id: string;
    account_id: string;
    slug: string;
    is_active: boolean;
    default_brand_profile_id: string | null;
    default_utility_categories: UtilityCategory[];
    default_packet_mode: PacketMode;
    advanced_modules: AdvancedModuleKey[];
    advanced_module_exclusions: AdvancedModuleExclusions;
    created_at: string;
    updated_at: string;
}

export function normalizeIntakeUtilityCategories(value: unknown): UtilityCategory[] {
    if (!Array.isArray(value)) return [...UTILITY_CATEGORY_KEYS];

    const selected = new Set(value.filter((candidate): candidate is string => typeof candidate === 'string'));
    const normalized = UTILITY_CATEGORY_KEYS.filter((category) => selected.has(category));
    return normalized.length > 0 ? normalized : [...UTILITY_CATEGORY_KEYS];
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
        throw new Error('Link must be lowercase and contain only letters, numbers, and dashes.');
    }
    if (slug.length < 3 || slug.length > 60) {
        throw new Error('Link must be between 3 and 60 characters.');
    }
    if (RESERVED_SLUGS.has(slug)) {
        throw new Error('That link name is reserved. Please choose a different one.');
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

export async function getIntakeLinkByAccountId(accountId: string): Promise<IntakeLink | null> {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM intake_links
        WHERE account_id = ${accountId}
        LIMIT 1
    `;

    return (result[0] as IntakeLink) || null;
}

export async function getOrCreateIntakeLink(accountId: string): Promise<IntakeLink | null> {
    const result = await ensureIntakeLink(accountId);
    return result?.intakeLink || null;
}

export async function ensureIntakeLink(accountId: string): Promise<{ intakeLink: IntakeLink | null; created: boolean } | null> {
    if (!sql) return null;

    const existing = await sql`
        SELECT * FROM intake_links
        WHERE account_id = ${accountId}
        LIMIT 1
    `;
    if (existing.length > 0) return { intakeLink: existing[0] as IntakeLink, created: false };

    // Default slug is intentionally random (so Pro/Teams can upgrade for a custom slug).
    // Use a short, URL-safe, lowercase token.
    let slug = generateToken().slice(0, 10);
    if (RESERVED_SLUGS.has(slug)) {
        slug = `link-${generateToken().slice(0, 8)}`;
    }

    const uniqueSlug = await getUniqueIntakeSlug(slug);

    const created = await sql`
        INSERT INTO intake_links (
            account_id,
            slug,
            is_active,
            default_packet_mode,
            advanced_modules,
            advanced_module_exclusions
        )
        VALUES (${accountId}, ${uniqueSlug}, TRUE, 'simple', '{}'::text[], '{}'::jsonb)
        RETURNING *
    `;

    return { intakeLink: (created[0] as IntakeLink) || null, created: true };
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
        INSERT INTO intake_links (
            account_id,
            slug,
            is_active,
            default_packet_mode,
            advanced_modules,
            advanced_module_exclusions
        )
        VALUES (${accountId}, ${uniqueSlug}, TRUE, 'simple', '{}'::text[], '{}'::jsonb)
        RETURNING *
    `;

    return (created[0] as IntakeLink) || null;
}

export async function updateIntakeLinkSellerFormDefaults(
    accountId: string,
    defaults: {
        isActive: boolean;
        defaultBrandProfileId: string | null;
        defaultUtilityCategories: UtilityCategory[];
    }
): Promise<IntakeLink | null> {
    if (!sql) return null;

    const normalizedCategories = normalizeIntakeUtilityCategories(defaults.defaultUtilityCategories);
    const result = await sql`
        UPDATE intake_links
        SET
            is_active = ${defaults.isActive},
            default_brand_profile_id = ${defaults.defaultBrandProfileId},
            default_utility_categories = ${normalizedCategories}::text[],
            updated_at = NOW()
        WHERE account_id = ${accountId}
        RETURNING *
    `;

    if (result.length > 0) return result[0] as IntakeLink;

    const seededSlug = await getUniqueIntakeSlug(generateToken().slice(0, 10));
    const created = await sql`
        INSERT INTO intake_links (
            account_id,
            slug,
            is_active,
            default_brand_profile_id,
            default_utility_categories,
            default_packet_mode,
            advanced_modules,
            advanced_module_exclusions
        )
        VALUES (
            ${accountId},
            ${seededSlug},
            ${defaults.isActive},
            ${defaults.defaultBrandProfileId},
            ${normalizedCategories}::text[],
            'simple',
            '{}'::text[],
            '{}'::jsonb
        )
        RETURNING *
    `;

    return (created[0] as IntakeLink) || null;
}

export async function updateIntakeLinkPacketDefaults(
    accountId: string,
    defaults: {
        defaultPacketMode: PacketMode;
        advancedModules: AdvancedModuleKey[];
        advancedModuleExclusions: AdvancedModuleExclusions;
    }
): Promise<IntakeLink | null> {
    if (!sql) return null;

    const result = await sql`
        UPDATE intake_links
        SET
            default_packet_mode = ${defaults.defaultPacketMode},
            advanced_modules = ${defaults.advancedModules}::text[],
            advanced_module_exclusions = ${JSON.stringify(defaults.advancedModuleExclusions)}::jsonb,
            updated_at = NOW()
        WHERE account_id = ${accountId}
        RETURNING *
    `;

    if (result.length > 0) return result[0] as IntakeLink;

    const seededSlug = await getUniqueIntakeSlug(generateToken().slice(0, 10));
    const created = await sql`
        INSERT INTO intake_links (
            account_id,
            slug,
            is_active,
            default_packet_mode,
            advanced_modules,
            advanced_module_exclusions
        )
        VALUES (
            ${accountId},
            ${seededSlug},
            TRUE,
            ${defaults.defaultPacketMode},
            ${defaults.advancedModules}::text[],
            ${JSON.stringify(defaults.advancedModuleExclusions)}::jsonb
        )
        RETURNING *
    `;
    return (created[0] as IntakeLink) || null;
}
