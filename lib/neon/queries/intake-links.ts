/** Creator-owned seller forms, fixed to their workspace. */
import { sql, generateToken } from '@/lib/neon/db';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode, UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { sellerFormCreationCapability } from '@/lib/seller-forms/config';
import type { SellerFormPatch } from '@/lib/seller-forms/config';

export interface IntakeLink {
    id: string;
    account_id: string;
    organization_id: string | null;
    name: string;
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
