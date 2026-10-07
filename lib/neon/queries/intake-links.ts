/** Creator-owned seller forms, fixed to their workspace. */
import { sql, generateToken } from '@/lib/neon/db';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode, UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { sellerFormCreationCapability } from '@/lib/seller-forms/config';
import type { SellerFormPatch } from '@/lib/seller-forms/config';
import { linkSuffixError, type SellerFormLinkScope } from '@/lib/seller-forms/links';

export interface IntakeLink {
    id: string;
    account_id: string;
    organization_id: string | null;
    name: string;
    /** Absent until migrations-seller-form-heading.sql is applied. */
    seller_heading?: string | null;
    seller_intro: string | null;
    scope_initialized: boolean;
    is_default: boolean;
    is_referral_identity: boolean;
    collect_hoa_questions: boolean;
    collect_electric_meter_number: boolean;
    revision: number;
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
    const selected = new Set(value);
    const normalized = UTILITY_CATEGORY_KEYS.filter(category => selected.has(category));
    return normalized.length ? normalized : [...UTILITY_CATEGORY_KEYS];
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


export async function getIntakeLinkBySlug(slug: string): Promise<IntakeLink | null> {
    if (!sql) return null;
    const rows = await sql`SELECT il.* FROM intake_link_aliases a JOIN intake_links il ON il.id = a.intake_link_id WHERE a.slug = ${slug}`;
    return rows[0] as IntakeLink || null;
}

/**
 * Bare link: a base name opens the default form of its creator/workspace, so
 * it follows "Make default". Any other form's own flat slug still opens that
 * form. Use getIntakeLinkBySlug when the alias owner itself is wanted.
 */
export async function getIntakeLinkByBaseSlug(slug: string): Promise<IntakeLink | null> {
    if (!sql) return null;
    const rows = await sql`SELECT il.* FROM intake_link_aliases a
        LEFT JOIN seller_form_link_namespaces n ON n.root_form_id = a.intake_link_id
        JOIN LATERAL (SELECT t.* FROM intake_links t
            WHERE (n.id IS NULL AND t.id = a.intake_link_id)
               OR (n.id IS NOT NULL AND t.account_id = n.account_id AND t.organization_id IS NOT DISTINCT FROM n.organization_id)
            ORDER BY t.is_default DESC, t.created_at, t.id LIMIT 1) il ON TRUE
        WHERE a.slug = ${slug}`;
    return rows[0] as IntakeLink || null;
}

/**
 * Nested link: the base must be a flat alias of a namespace's base owner, then
 * the ending resolves inside that namespace. Another form's flat slug is never
 * a base, and neither the base owner nor the default has to be active for a
 * sibling to open.
 */
export async function getIntakeLinkBySuffix(slug: string, suffix: string): Promise<IntakeLink | null> {
    if (!sql) return null;
    const rows = await sql`SELECT il.* FROM intake_link_aliases a
        JOIN seller_form_link_namespaces n ON n.root_form_id = a.intake_link_id
        JOIN seller_form_suffix_aliases s ON s.namespace_id = n.id AND s.suffix = ${suffix}
        JOIN intake_links il ON il.id = s.form_id
        WHERE a.slug = ${slug}`;
    return rows[0] as IntakeLink || null;
}

/** Published flat aliases of one form; used to recognize its legacy resume cookies. */
export async function getSellerFormAliasSlugs(formId: string, candidates?: string[]): Promise<string[]> {
    if (!sql) return [];
    const rows = candidates
        ? await sql`SELECT slug FROM intake_link_aliases WHERE intake_link_id = ${formId}::uuid AND slug = ANY(${candidates}::text[])`
        : await sql`SELECT slug FROM intake_link_aliases WHERE intake_link_id = ${formId}::uuid ORDER BY created_at DESC`;
    return rows.map(row => String(row.slug));
}

/** Base and endings for one creator/workspace, in one query for any list size. */
export async function getSellerFormLinkScope(accountId: string, organizationId?: string | null): Promise<SellerFormLinkScope | null> {
    if (!sql) return null;
    const rows = await sql`SELECT n.root_form_id, r.slug AS base_slug, r.revision AS base_revision,
            d.id AS default_form_id, d.name AS default_form_name, d.is_active AS default_is_active,
            COALESCE((SELECT json_agg(json_build_object('form_id', s.form_id, 'suffix', s.suffix, 'is_current', s.is_current) ORDER BY s.created_at, s.suffix)
                FROM seller_form_suffix_aliases s WHERE s.namespace_id = n.id), '[]'::json) AS aliases
        FROM seller_form_link_namespaces n JOIN intake_links r ON r.id = n.root_form_id
        JOIN LATERAL (SELECT t.id, t.name, t.is_active FROM intake_links t
            WHERE t.account_id = n.account_id AND t.organization_id IS NOT DISTINCT FROM n.organization_id
            ORDER BY t.is_default DESC, t.created_at, t.id LIMIT 1) d ON TRUE
        WHERE n.account_id = ${accountId}::uuid AND n.organization_id IS NOT DISTINCT FROM ${organizationId || null}::uuid`;
    const row = rows[0];
    if (!row) return null;
    const aliases = (typeof row.aliases === 'string' ? JSON.parse(row.aliases) : row.aliases) as Array<{ form_id: string; suffix: string; is_current: boolean }>;
    return {
        rootFormId: row.root_form_id,
        baseSlug: row.base_slug,
        baseRevision: Number(row.base_revision),
        defaultFormId: row.default_form_id,
        defaultFormName: row.default_form_name,
        defaultIsActive: row.default_is_active === true,
        suffixes: Object.fromEntries(aliases.filter(alias => alias.is_current).map(alias => [alias.form_id, alias.suffix])),
        reserved: aliases.map(alias => ({ suffix: alias.suffix, formId: alias.form_id })),
    };
}

/** Explicit global referral identity; independent of active scope and default. */
export async function getIntakeLinkByAccountId(accountId: string): Promise<IntakeLink | null> {
    if (!sql) return null;
    const rows = await sql`SELECT * FROM intake_links WHERE account_id = ${accountId} AND is_referral_identity = TRUE`;
    return rows[0] as IntakeLink || null;
}
export const getReferralIdentityForm = getIntakeLinkByAccountId;

export async function listSellerForms(accountId: string, organizationId?: string): Promise<IntakeLink[]> {
    if (!sql) return [];
    return await sql`SELECT * FROM intake_links WHERE account_id = ${accountId} AND organization_id IS NOT DISTINCT FROM ${organizationId || null}::uuid ORDER BY is_default DESC, created_at, id` as IntakeLink[];
}

export async function getSellerFormCount(accountId: string): Promise<number> {
    if (!sql) return 0;
    const rows = await sql`SELECT COUNT(*)::integer AS count FROM intake_links WHERE account_id = ${accountId}`;
    return Number(rows[0]?.count || 0);
}

export async function getSellerForm(id: string, accountId: string, organizationId?: string): Promise<IntakeLink | null> {
    if (!sql) return null;
    const rows = await sql`SELECT * FROM intake_links WHERE id = ${id} AND account_id = ${accountId} AND organization_id IS NOT DISTINCT FROM ${organizationId || null}::uuid`;
    return rows[0] as IntakeLink || null;
}

export async function ensureIntakeLink(accountId: string, organizationId?: string): Promise<{ intakeLink: IntakeLink | null; created: boolean } | null> {
    if (!sql) return null;
    const slug = generateToken().slice(0, 10);
    const capability = sellerFormCreationCapability(accountId);
    const rows = await sql`SELECT * FROM ensure_seller_form(${accountId}::uuid, ${organizationId || null}::uuid, ${slug}, ${capability.canCreate}::boolean, ${capability.technicalCap}::integer)`;
    const intakeLink = rows[0] as IntakeLink || null;
    return { intakeLink, created: intakeLink?.slug === slug };
}
export async function getOrCreateIntakeLink(accountId: string, organizationId?: string): Promise<IntakeLink | null> {
    return (await ensureIntakeLink(accountId, organizationId))?.intakeLink || null;
}

export async function saveSellerForm(accountId: string, organizationId: string | undefined, id: string | null, revision: number | null, config: SellerFormPatch): Promise<IntakeLink | null> {
    if (!sql) return null;
    if (config.slug !== undefined) validateIntakeSlug(config.slug);
    if (config.suffix !== undefined) {
        const invalid = linkSuffixError(config.suffix);
        if (invalid) throw new Error(invalid);
    }
    const rows = await sql`SELECT * FROM save_seller_form(${accountId}::uuid, ${organizationId || null}::uuid, ${id}::uuid, ${revision}::integer, ${JSON.stringify(config)}::jsonb, ${generateToken().slice(0, 10)}, ${sellerFormCreationCapability(accountId).technicalCap}::integer, ${sellerFormCreationCapability(accountId).canCreate}::boolean)`;
    return rows[0] as IntakeLink || null;
}
export async function setDefaultSellerForm(accountId: string, organizationId: string | undefined, id: string): Promise<IntakeLink | null> {
    if (!sql) return null;
    const rows = await sql`SELECT * FROM set_default_seller_form(${accountId}::uuid, ${organizationId || null}::uuid, ${id}::uuid)`;
    return rows[0] as IntakeLink || null;
}

// Legacy helper signatures remain compatible, but never update all owner rows.
async function updateDefault(accountId: string, patch: SellerFormPatch, organizationId?: string) {
    const f = await getOrCreateIntakeLink(accountId, organizationId);
    return f ? saveSellerForm(accountId, organizationId, f.id, f.revision, patch) : null;
}
export async function updateIntakeLinkSlug(accountId: string, slug: string, organizationId?: string) {
    return updateDefault(accountId, { slug }, organizationId);
}
export async function updateIntakeLinkSellerFormDefaults(accountId: string, defaults: Pick<SellerFormPatch, 'isActive' | 'defaultBrandProfileId' | 'defaultUtilityCategories'>, organizationId?: string) {
    return updateDefault(accountId, defaults, organizationId);
}
export async function updateIntakeLinkPacketDefaults(accountId: string, defaults: Pick<SellerFormPatch, 'defaultPacketMode' | 'advancedModules' | 'advancedModuleExclusions'>, organizationId?: string) {
    return updateDefault(accountId, defaults, organizationId);
}
