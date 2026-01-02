/**
 * Brand profile-related database queries
 */
import { sql } from '@/lib/neon/db';
import type { BrandProfile } from '@/types';

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

/**
 * Create a new brand profile
 */
export async function createBrandProfile(data: {
    accountId: string;
    organizationId?: string;
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    contactWebsite?: string;
    disclaimerText?: string;
    isDefault?: boolean;
}): Promise<BrandProfile | null> {
    if (!sql) return null;

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
            primary_color,
            secondary_color,
            contact_name,
            contact_phone,
            contact_email,
            contact_website,
            disclaimer_text,
            is_default
        ) VALUES (
            ${data.accountId},
            ${data.organizationId || null},
            ${data.name},
            ${data.primaryColor || '#10b981'},
            ${data.secondaryColor || '#059669'},
            ${data.contactName || null},
            ${data.contactPhone || null},
            ${data.contactEmail || null},
            ${data.contactWebsite || null},
            ${data.disclaimerText || null},
            ${data.isDefault || false}
        )
        RETURNING *
    `;

    return (result[0] as BrandProfile) || null;
}

/**
 * Update a brand profile
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

    const result = await sql`
        UPDATE brand_profiles
        SET
            name = COALESCE(${data.name}, name),
            primary_color = COALESCE(${data.primary_color}, primary_color),
            secondary_color = COALESCE(${data.secondary_color}, secondary_color),
            contact_name = COALESCE(${data.contact_name}, contact_name),
            contact_phone = COALESCE(${data.contact_phone}, contact_phone),
            contact_email = COALESCE(${data.contact_email}, contact_email),
            contact_website = COALESCE(${data.contact_website}, contact_website),
            disclaimer_text = COALESCE(${data.disclaimer_text}, disclaimer_text),
            is_default = COALESCE(${data.is_default}, is_default)
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
