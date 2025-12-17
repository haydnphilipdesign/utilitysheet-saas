import { sql, generateToken } from '@/lib/neon/db';
import type { Request, BrandProfile } from '@/types';

// Get all requests for an account
export async function getRequests(accountId: string): Promise<Request[]> {
    if (!sql) return [];

    const result = await sql`
    SELECT * FROM requests 
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
  `;

    return result as Request[];
}

// Get a single request by ID
export async function getRequestById(id: string): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
    SELECT * FROM requests WHERE id = ${id}
  `;

    return result[0] as Request || null;
}

// Get request by public token
export async function getRequestByToken(token: string): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
    SELECT * FROM requests WHERE public_token = ${token}
  `;

    return result[0] as Request || null;
}

// Create a new request
export async function createRequest(data: {
    accountId: string;
    brandProfileId?: string;
    propertyAddress: string;
    sellerName?: string;
    sellerEmail?: string;
    sellerPhone?: string;
    closingDate?: string;
    utilityCategories: string[];
}): Promise<Request | null> {
    if (!sql) return null;

    const publicToken = generateToken();

    const result = await sql`
    INSERT INTO requests (
      account_id,
      brand_profile_id,
      property_address,
      seller_name,
      seller_email,
      seller_phone,
      closing_date,
      utility_categories,
      public_token,
      status
    ) VALUES (
      ${data.accountId},
      ${data.brandProfileId || null},
      ${data.propertyAddress},
      ${data.sellerName || null},
      ${data.sellerEmail || null},
      ${data.sellerPhone || null},
      ${data.closingDate || null},
      ${data.utilityCategories},
      ${publicToken},
      'sent'
    )
    RETURNING *
  `;

    return result[0] as Request || null;
}

// Update request status
export async function updateRequestStatus(
    id: string,
    status: 'draft' | 'sent' | 'in_progress' | 'submitted'
): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
    UPDATE requests 
    SET status = ${status}, last_activity_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

    return result[0] as Request || null;
}

// Get dashboard stats
export async function getDashboardStats(accountId: string) {
    if (!sql) {
        return { total: 0, pending: 0, completed: 0, needsAttention: 0 };
    }

    const result = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status IN ('sent', 'in_progress')) as pending,
      COUNT(*) FILTER (WHERE status = 'submitted') as completed,
      COUNT(*) FILTER (WHERE status = 'sent' AND created_at < NOW() - INTERVAL '3 days') as needs_attention
    FROM requests 
    WHERE account_id = ${accountId}
  `;

    return {
        total: Number(result[0].total) || 0,
        pending: Number(result[0].pending) || 0,
        completed: Number(result[0].completed) || 0,
        needsAttention: Number(result[0].needs_attention) || 0,
    };
}

// Brand Profile queries
export async function getBrandProfiles(accountId: string): Promise<BrandProfile[]> {
    if (!sql) return [];

    const result = await sql`
    SELECT * FROM brand_profiles 
    WHERE account_id = ${accountId}
    ORDER BY is_default DESC, created_at DESC
  `;

    return result as BrandProfile[];
}

export async function createBrandProfile(data: {
    accountId: string;
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

    // If this is default, unset other defaults first
    if (data.isDefault) {
        await sql`
      UPDATE brand_profiles 
      SET is_default = FALSE 
      WHERE account_id = ${data.accountId}
    `;
    }

    const result = await sql`
    INSERT INTO brand_profiles (
      account_id,
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

    return result[0] as BrandProfile || null;
}

// Get or create account for authenticated user
export async function getOrCreateAccount(authUserId: string, email: string, fullName?: string) {
    if (!sql) return null;

    // Try to find existing account
    let result = await sql`
    SELECT * FROM accounts WHERE auth_user_id = ${authUserId}
  `;

    if (result.length > 0) {
        return result[0];
    }

    // Create new account
    result = await sql`
    INSERT INTO accounts (auth_user_id, email, full_name)
    VALUES (${authUserId}, ${email}, ${fullName || null})
    RETURNING *
  `;

    return result[0] || null;
}
