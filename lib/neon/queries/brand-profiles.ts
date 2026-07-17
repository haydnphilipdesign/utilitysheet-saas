/**
 * Brand profile-related database queries
 */
import { sql } from '@/lib/neon/db';
import type { BrandProfile, MessageTemplates } from '@/types';

/**
 * Get all brand profiles for an account or organization
 */
export async function getBrandProfiles(accountId: string, organizationId?: string): Promise<BrandProfile[]> {
    if (!sql) return [];

    if (organizationId) {
        const result = await sql`
            SELECT * FROM brand_profiles 
            WHERE organization_id = ${organizationId}
            ORDER BY is_default DESC, created_at DESC
        `;
        return result as BrandProfile[];
    }

    const result = await sql`
        SELECT * FROM brand_profiles 
        WHERE account_id = ${accountId} AND organization_id IS NULL
        ORDER BY is_default DESC, created_at DESC
    `;

    return result as BrandProfile[];
}

/**
 * Get a single brand profile by ID
 */
export async function getBrandProfile(id: string): Promise<BrandProfile | null> {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM brand_profiles WHERE id = ${id}
    `;

    return (result[0] as BrandProfile) || null;
}

export async function getBrandProfileForScope(
    id: string,
    accountId: string,
    organizationId?: string
): Promise<BrandProfile | null> {
    if (!sql) return null;

    const result = organizationId
        ? await sql`
            SELECT * FROM brand_profiles
            WHERE id = ${id} AND organization_id = ${organizationId}
            LIMIT 1
        `
        : await sql`
            SELECT * FROM brand_profiles
            WHERE id = ${id} AND account_id = ${accountId} AND organization_id IS NULL
            LIMIT 1
        `;

    return (result[0] as BrandProfile) || null;
}

/**
 * Get the default brand profile for an account or organization
 */
export async function getDefaultBrandProfile(accountId: string, organizationId?: string): Promise<BrandProfile | null> {
    if (!sql) return null;

    if (organizationId) {
        const result = await sql`
            SELECT * FROM brand_profiles 
            WHERE organization_id = ${organizationId} AND is_default = TRUE
            LIMIT 1
        `;
        if (result.length > 0) return result[0] as BrandProfile;

        // Fallback to any profile in organization if no default set
        const fallbackResult = await sql`
            SELECT * FROM brand_profiles 
            WHERE organization_id = ${organizationId}
            ORDER BY created_at ASC
            LIMIT 1
        `;
        return (fallbackResult[0] as BrandProfile) || null;
    }

    const result = await sql`
        SELECT * FROM brand_profiles 
        WHERE account_id = ${accountId} AND organization_id IS NULL AND is_default = TRUE
        LIMIT 1
    `;
    if (result.length > 0) return result[0] as BrandProfile;

    // Fallback to any profile for account if no default set
    const fallbackResult = await sql`
        SELECT * FROM brand_profiles 
        WHERE account_id = ${accountId} AND organization_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
    `;
    return (fallbackResult[0] as BrandProfile) || null;
}

export async function getIntakeBrandProfile(
    accountId: string,
    organizationId?: string,
    selectedProfileId?: string | null
): Promise<BrandProfile | null> {
    if (selectedProfileId) {
        const selected = await getBrandProfileForScope(selectedProfileId, accountId, organizationId);
        if (selected) return selected;
    }

    return getDefaultBrandProfile(accountId, organizationId);
}

/**
 * Create a new brand profile
 */
export async function createBrandProfile(data: {
    accountId: string;
    organizationId?: string;
    name: string;
    logoUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    contactWebsite?: string | null;
    disclaimerText?: string | null;
    messageTemplates?: MessageTemplates;
    isDefault?: boolean;
    // Advanced customization
    buyerNextSteps?: string[] | null;
    nextStepsTitle?: string | null;
    showPoweredBy?: boolean;
    showGenerationDate?: boolean;
    welcomeMessage?: string | null;
}): Promise<BrandProfile | null> {
    if (!sql) return null;

    const messageTemplatesJson = JSON.stringify(data.messageTemplates || {});

    // If this is default, unset other defaults first (within account or organization)
    if (data.isDefault) {
        if (data.organizationId) {
            await sql`
                UPDATE brand_profiles 
                SET is_default = FALSE 
                WHERE organization_id = ${data.organizationId}
            `;
        } else {
            await sql`
                UPDATE brand_profiles 
                SET is_default = FALSE 
                WHERE account_id = ${data.accountId} AND organization_id IS NULL
            `;
        }
    }

    const result = await sql`
        INSERT INTO brand_profiles (
            account_id,
            organization_id,
            name,
            logo_url,
            primary_color,
            secondary_color,
            contact_name,
            contact_phone,
            contact_email,
            contact_website,
            disclaimer_text,
            message_templates,
            is_default,
            buyer_next_steps,
            next_steps_title,
            show_powered_by,
            show_generation_date,
            welcome_message
        ) VALUES (
            ${data.accountId},
            ${data.organizationId || null},
            ${data.name},
            ${data.logoUrl || null},
            ${data.primaryColor || '#10b981'},
            ${data.secondaryColor || '#059669'},
            ${data.contactName || null},
            ${data.contactPhone || null},
            ${data.contactEmail || null},
            ${data.contactWebsite || null},
            ${data.disclaimerText || null},
            ${messageTemplatesJson}::jsonb,
            ${data.isDefault || false},
            ${data.buyerNextSteps ? JSON.stringify(data.buyerNextSteps) : null},
            ${data.nextStepsTitle || null},
            ${data.showPoweredBy ?? true},
            ${data.showGenerationDate ?? true},
            ${data.welcomeMessage || null}
        )
        RETURNING *
    `;

    return (result[0] as BrandProfile) || null;
}

/**
 * Update a brand profile.
 *
 * Field semantics (shared with the branding API):
 * - key absent (undefined) -> the stored value is left unchanged
 * - explicit null          -> the stored value is cleared (SQL NULL)
 * - value                  -> the stored value is replaced
 *
 * This is implemented with per-field `CASE WHEN <provided> THEN <value> ELSE <current> END`
 * clauses instead of COALESCE, because COALESCE cannot distinguish "not sent"
 * from "clear this value" (the historical remove-logo / reset-steps bug).
 */
export async function updateBrandProfile(
    id: string,
    data: Partial<Omit<BrandProfile, 'id' | 'account_id' | 'organization_id' | 'created_at'>> & {
        accountId?: string;
        organizationId?: string;
    }
): Promise<BrandProfile | null> {
    if (!sql) return null;

    // If setting as default, unset other defaults first
    if (data.is_default) {
        if (data.organizationId) {
            await sql`
                UPDATE brand_profiles 
                SET is_default = FALSE 
                WHERE organization_id = ${data.organizationId} AND id != ${id}
            `;
        } else if (data.accountId) {
            await sql`
                UPDATE brand_profiles 
                SET is_default = FALSE 
                WHERE account_id = ${data.accountId} AND organization_id IS NULL AND id != ${id}
            `;
        } else {
            // Fallback: fetch the profile to check ownership
            const currentCheck = await sql`SELECT account_id, organization_id FROM brand_profiles WHERE id = ${id}`;
            if (currentCheck.length > 0) {
                if (currentCheck[0].organization_id) {
                    await sql`
                        UPDATE brand_profiles 
                        SET is_default = FALSE 
                        WHERE organization_id = ${currentCheck[0].organization_id} AND id != ${id}
                    `;
                } else {
                    await sql`
                        UPDATE brand_profiles 
                        SET is_default = FALSE 
                        WHERE account_id = ${currentCheck[0].account_id} AND organization_id IS NULL AND id != ${id}
                    `;
                }
            }
        }
    }

    // Serialize jsonb payloads. A provided-but-empty custom list clears to NULL
    // (product defaults); message templates always store an object.
    const buyerNextStepsJson = data.buyer_next_steps
        ? JSON.stringify(data.buyer_next_steps)
        : null;
    const messageTemplatesJson = data.message_templates !== undefined
        ? JSON.stringify(data.message_templates || {})
        : null;

    const result = await sql`
        UPDATE brand_profiles
        SET
            name = CASE WHEN ${data.name !== undefined} THEN ${data.name ?? null}::text ELSE name END,
            logo_url = CASE WHEN ${data.logo_url !== undefined} THEN ${data.logo_url ?? null}::text ELSE logo_url END,
            primary_color = CASE WHEN ${data.primary_color !== undefined} THEN ${data.primary_color ?? null}::text ELSE primary_color END,
            secondary_color = CASE WHEN ${data.secondary_color !== undefined} THEN ${data.secondary_color ?? null}::text ELSE secondary_color END,
            contact_name = CASE WHEN ${data.contact_name !== undefined} THEN ${data.contact_name ?? null}::text ELSE contact_name END,
            contact_phone = CASE WHEN ${data.contact_phone !== undefined} THEN ${data.contact_phone ?? null}::text ELSE contact_phone END,
            contact_email = CASE WHEN ${data.contact_email !== undefined} THEN ${data.contact_email ?? null}::text ELSE contact_email END,
            contact_website = CASE WHEN ${data.contact_website !== undefined} THEN ${data.contact_website ?? null}::text ELSE contact_website END,
            disclaimer_text = CASE WHEN ${data.disclaimer_text !== undefined} THEN ${data.disclaimer_text ?? null}::text ELSE disclaimer_text END,
            message_templates = CASE WHEN ${data.message_templates !== undefined} THEN ${messageTemplatesJson}::jsonb ELSE message_templates END,
            is_default = CASE WHEN ${data.is_default !== undefined} THEN ${data.is_default ?? null}::boolean ELSE is_default END,
            buyer_next_steps = CASE WHEN ${data.buyer_next_steps !== undefined} THEN ${buyerNextStepsJson}::jsonb ELSE buyer_next_steps END,
            next_steps_title = CASE WHEN ${data.next_steps_title !== undefined} THEN ${data.next_steps_title ?? null}::text ELSE next_steps_title END,
            show_powered_by = CASE WHEN ${data.show_powered_by !== undefined} THEN ${data.show_powered_by ?? null}::boolean ELSE show_powered_by END,
            show_generation_date = CASE WHEN ${data.show_generation_date !== undefined} THEN ${data.show_generation_date ?? null}::boolean ELSE show_generation_date END,
            welcome_message = CASE WHEN ${data.welcome_message !== undefined} THEN ${data.welcome_message ?? null}::text ELSE welcome_message END
        WHERE id = ${id}
        RETURNING *
    `;

    return (result[0] as BrandProfile) || null;
}

/**
 * Delete a brand profile
 */
export async function deleteBrandProfile(id: string): Promise<boolean> {
    if (!sql) return false;

    const result = await sql`
        DELETE FROM brand_profiles WHERE id = ${id} RETURNING id
    `;

    return result.length > 0;
}
