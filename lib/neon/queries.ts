import { sql, generateToken } from '@/lib/neon/db';
import type { Request, BrandProfile } from '@/types';

// Get all requests for an account or organization
export async function getRequests(accountId: string, organizationId?: string): Promise<Request[]> {
  if (!sql) return [];

  if (organizationId) {
    const result = await sql`
      SELECT * FROM requests 
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
    `;
    return result as Request[];
  }

  const result = await sql`
    SELECT * FROM requests 
    WHERE account_id = ${accountId} AND organization_id IS NULL
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
  organizationId?: string;
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
      organization_id,
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
      ${data.organizationId || null},
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
export async function getDashboardStats(accountId: string, organizationId?: string) {
  if (!sql) {
    return { total_requests: 0, draft: 0, sent: 0, in_progress: 0, submitted: 0, needs_attention: 0 };
  }

  const query = organizationId
    ? sql`SELECT * FROM requests WHERE organization_id = ${organizationId}`
    : sql`SELECT * FROM requests WHERE account_id = ${accountId} AND organization_id IS NULL`;

  const result = await sql`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
      COUNT(*) FILTER (WHERE status = 'sent' AND created_at < NOW() - INTERVAL '3 days') as needs_attention
    FROM requests 
    WHERE ${organizationId ? sql`organization_id = ${organizationId}` : sql`account_id = ${accountId} AND organization_id IS NULL`}
  `;

  return {
    total_requests: Number(result[0].total_requests) || 0,
    draft: Number(result[0].draft) || 0,
    sent: Number(result[0].sent) || 0,
    in_progress: Number(result[0].in_progress) || 0,
    submitted: Number(result[0].submitted) || 0,
    needs_attention: Number(result[0].needs_attention) || 0,
  };
}

// Brand Profile queries
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

  return result[0] as BrandProfile || null;
}

// Get a single brand profile by ID
export async function getBrandProfile(id: string): Promise<BrandProfile | null> {
  if (!sql) return null;

  const result = await sql`
    SELECT * FROM brand_profiles WHERE id = ${id}
  `;

  return result[0] as BrandProfile || null;
}

// Get utility entries for a request
export async function getUtilityEntriesByRequestId(requestId: string): Promise<any[]> {
  if (!sql) return [];

  const result = await sql`
    SELECT 
        id,
        request_id,
        category,
        entry_mode,
        display_name as provider_name,
        contact_phone as provider_phone,
        contact_url as provider_website
    FROM utility_entries 
    WHERE request_id = ${requestId}
    ORDER BY created_at ASC
  `;

  return result as any[];
}
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
    INSERT INTO accounts (auth_user_id, email, full_name, notification_preferences)
    VALUES (${authUserId}, ${email}, ${fullName || null}, '{}'::jsonb)
    RETURNING *
  `;


  return result[0] || null;
}

export async function updateAccount(accountId: string, data: { fullName?: string, notificationPreferences?: any }) {
  if (!sql) return null;

  const result = await sql`
    UPDATE accounts
    SET full_name = COALESCE(${data.fullName}, full_name),
        notification_preferences = COALESCE(${data.notificationPreferences}, notification_preferences)
    WHERE id = ${accountId}
    RETURNING *
  `;

  return result[0] || null;
}

// Organization Management
export async function createOrganization(name: string, accountId: string) {
  if (!sql) return null;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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

