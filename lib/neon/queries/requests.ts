/**
 * Request-related database queries
 */
import { sql, generateToken } from '@/lib/neon/db';
import type { SubmittedSheetUtilityInsertRow } from '@/lib/submitted-sheet/editor';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    PacketMode,
    PropertyAddressStructured,
    Request,
    UtilityEntry,
} from '@/types';

/**
 * Pagination result interface
 */
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * Get all requests for an account or organization (with pagination)
 */
export async function getRequests(
    accountId: string,
    organizationId?: string,
    options: { page?: number; limit?: number } = {}
): Promise<PaginatedResult<Request>> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;

    if (!sql) return { data: [], total: 0, page, limit, totalPages: 0 };

    // Build the WHERE clause (exclude deleted requests from user-facing lists).
    // If the account has an active organization, show:
    // - all org requests, plus
    // - the user's personal (pre-org) requests that have no organization.
    const whereClause = organizationId
        ? sql`deleted_at IS NULL AND (organization_id = ${organizationId} OR (account_id = ${accountId} AND organization_id IS NULL))`
        : sql`account_id = ${accountId} AND organization_id IS NULL AND deleted_at IS NULL`;

    // Get total count
    const countResult = await sql`
        SELECT COUNT(*) as count FROM requests WHERE ${whereClause}
    `;
    const total = Number(countResult[0]?.count) || 0;
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    const result = await sql`
        SELECT * FROM requests 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    return {
        data: result as Request[],
        total,
        page,
        limit,
        totalPages,
    };
}

/**
 * Get a single request by ID
 */
export async function getRequestById(
    id: string,
    options: { includeDeleted?: boolean } = {}
): Promise<Request | null> {
    if (!sql) return null;

    const result = options.includeDeleted
        ? await sql`
            SELECT * FROM requests WHERE id = ${id}
        `
        : await sql`
            SELECT * FROM requests WHERE id = ${id} AND deleted_at IS NULL
        `;

    return (result[0] as Request) || null;
}

/**
 * Get request by public token
 */
export async function getRequestByToken(token: string): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM requests WHERE public_token = ${token} AND deleted_at IS NULL
    `;

    return (result[0] as Request) || null;
}

export async function getRequestBySellerToken(token: string): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM requests WHERE seller_token = ${token} AND deleted_at IS NULL
    `;

    return (result[0] as Request) || null;
}

/**
 * Create a new request
 */
export async function createRequest(data: {
    accountId: string;
    organizationId?: string;
    brandProfileId?: string;
    propertyAddress: string;
    propertyAddressStructured?: PropertyAddressStructured | null;
    sellerName?: string;
    sellerEmail?: string;
    sellerPhone?: string;
    closingDate?: string;
    utilityCategories: string[];
    isDemo?: boolean;
    isLocked?: boolean;
    lockedReason?: string;
    status?: 'draft' | 'sent' | 'in_progress' | 'submitted';
    meteredAt?: string | null;
    packetMode?: PacketMode;
    advancedModules?: AdvancedModuleKey[];
    advancedModuleExclusions?: AdvancedModuleExclusions;
    advancedPacketData?: Record<string, unknown>;
}): Promise<Request | null> {
    if (!sql) return null;

    const publicToken = generateToken();
    const sellerToken = generateToken();
    const status = data.status ?? 'sent';
    const meteredAt = data.meteredAt !== undefined
        ? data.meteredAt
        : status === 'draft'
            ? null
            : new Date().toISOString();
    const packetMode = data.packetMode ?? 'simple';
    const advancedModules = Array.isArray(data.advancedModules) ? data.advancedModules : [];
    const advancedModuleExclusions = data.advancedModuleExclusions || {};
    const advancedPacketData = data.advancedPacketData || {};

    const result = await sql`
        INSERT INTO requests (
            account_id,
            organization_id,
            brand_profile_id,
            property_address,
            property_address_structured,
            seller_name,
            seller_email,
            seller_phone,
            closing_date,
            utility_categories,
            packet_mode,
            advanced_modules,
            advanced_module_exclusions,
            advanced_packet_data,
            public_token,
            seller_token,
            is_demo,
            status,
            metered_at,
            is_locked,
            locked_reason,
            locked_at
        ) VALUES (
            ${data.accountId},
            ${data.organizationId || null},
            ${data.brandProfileId || null},
            ${data.propertyAddress},
            ${data.propertyAddressStructured ? JSON.stringify(data.propertyAddressStructured) : null}::jsonb,
            ${data.sellerName || null},
            ${data.sellerEmail || null},
            ${data.sellerPhone || null},
            ${data.closingDate || null},
            ${data.utilityCategories},
            ${packetMode},
            ${advancedModules},
            ${JSON.stringify(advancedModuleExclusions)}::jsonb,
            ${JSON.stringify(advancedPacketData)}::jsonb,
            ${publicToken},
            ${sellerToken},
            ${data.isDemo === true},
            ${status},
            ${meteredAt},
            ${data.isLocked === true},
            ${data.lockedReason || null},
            ${data.isLocked === true ? new Date().toISOString() : null}
        )
        RETURNING *
    `;

    return (result[0] as Request) || null;
}

export async function updateRequestConfiguration(
    id: string,
    data: {
        packetMode: PacketMode;
        advancedModules: AdvancedModuleKey[];
        advancedModuleExclusions: AdvancedModuleExclusions;
    }
): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
        UPDATE requests
        SET
            packet_mode = ${data.packetMode},
            advanced_modules = ${data.advancedModules},
            advanced_module_exclusions = ${JSON.stringify(data.advancedModuleExclusions)}::jsonb,
            updated_at = NOW()
        WHERE id = ${id}
            AND status IN ('draft', 'sent')
            AND deleted_at IS NULL
        RETURNING *
    `;

    return (result[0] as Request) || null;
}

export async function updateSubmittedRequestData(
    id: string,
    data: {
        expectedUpdatedAt: string;
        propertyAddress: string;
        propertyAddressStructured: PropertyAddressStructured | null;
        advancedPacketData: Record<string, unknown>;
        utilityEntries: SubmittedSheetUtilityInsertRow[];
        eventData?: Record<string, unknown> | null;
        ipAddress?: string | null;
        userAgent?: string | null;
    }
): Promise<Request | null> {
    if (!sql) return null;

    const utilityEntriesJson = JSON.stringify(data.utilityEntries);
    const advancedPacketDataJson = JSON.stringify(data.advancedPacketData || {});
    const eventDataJson = data.eventData ? JSON.stringify(data.eventData) : null;

    const [result] = await sql.transaction([
        sql`
            WITH updated_request AS (
                UPDATE requests
                SET
                    property_address = ${data.propertyAddress},
                    property_address_structured = ${data.propertyAddressStructured ? JSON.stringify(data.propertyAddressStructured) : null}::jsonb,
                    advanced_packet_data = ${advancedPacketDataJson}::jsonb,
                    updated_at = NOW(),
                    last_activity_at = NOW()
                WHERE id = ${id}
                    AND status = 'submitted'
                    AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', ${data.expectedUpdatedAt}::timestamptz)
                    AND deleted_at IS NULL
                RETURNING *
            ),
            deleted_entries AS (
                DELETE FROM utility_entries
                WHERE request_id IN (SELECT id FROM updated_request)
            ),
            inserted_entries AS (
                INSERT INTO utility_entries (
                    request_id,
                    category,
                    entry_mode,
                    display_name,
                    raw_text,
                    contact_phone,
                    contact_url,
                    meter_number,
                    extra
                )
                SELECT
                    updated_request.id,
                    entries.category,
                    entries.entry_mode,
                    entries.display_name,
                    entries.raw_text,
                    entries.contact_phone,
                    entries.contact_url,
                    entries.meter_number,
                    COALESCE(entries.extra, '{}'::jsonb)
                FROM updated_request
                CROSS JOIN LATERAL jsonb_to_recordset(${utilityEntriesJson}::jsonb) AS entries(
                    category text,
                    entry_mode text,
                    display_name text,
                    raw_text text,
                    contact_phone text,
                    contact_url text,
                    meter_number text,
                    extra jsonb
                )
                RETURNING id
            ),
            inserted_event AS (
                INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
                SELECT
                    updated_request.id,
                    'submitted_sheet_edited',
                    ${eventDataJson}::jsonb,
                    ${data.ipAddress || null},
                    ${data.userAgent || null}
                FROM updated_request
                RETURNING id
            )
            SELECT * FROM updated_request
        `,
    ]);

    return (result[0] as Request) || null;
}

export async function propagateAdvancedModuleDefaultsToOpenRequests(
    accountId: string,
    organizationId: string | null | undefined,
    data: {
        advancedModules: AdvancedModuleKey[];
        advancedModuleExclusions: AdvancedModuleExclusions;
    }
): Promise<number> {
    if (!sql) return 0;

    const visibilityScope = organizationId
        ? sql`(organization_id = ${organizationId} OR (account_id = ${accountId} AND organization_id IS NULL))`
        : sql`(account_id = ${accountId} AND organization_id IS NULL)`;

    const result = await sql`
        UPDATE requests
        SET
            advanced_modules = ${data.advancedModules}::text[],
            advanced_module_exclusions = ${JSON.stringify(data.advancedModuleExclusions)}::jsonb,
            updated_at = NOW()
        WHERE deleted_at IS NULL
            AND status IN ('draft', 'sent')
            AND packet_mode = 'advanced'
            AND ${visibilityScope}
        RETURNING id
    `;

    return result.length;
}

export async function getRequestCountForAccount(accountId: string): Promise<number> {
    if (!sql) return 0;

    const result = await sql`
        SELECT COUNT(*) as count
        FROM requests
        WHERE account_id = ${accountId}
            AND metered_at IS NOT NULL
    `;

    return Number(result[0]?.count) || 0;
}

/**
 * Update request status
 */
export async function updateRequestStatus(
    id: string,
    status: 'draft' | 'sent' | 'in_progress' | 'submitted'
): Promise<Request | null> {
    if (!sql) return null;

    const result = await sql`
        UPDATE requests 
        SET
            status = ${status},
            last_activity_at = NOW(),
            metered_at = CASE
                WHEN metered_at IS NULL AND ${status}::text <> 'draft' THEN NOW()
                ELSE metered_at
            END
        WHERE id = ${id}
        RETURNING *
    `;

    return (result[0] as Request) || null;
}

/**
 * Delete a request and its associated utility entries
 */
export async function deleteRequest(id: string): Promise<boolean> {
    if (!sql) return false;

    const requestResult = await sql`
        SELECT id, metered_at, deleted_at
        FROM requests
        WHERE id = ${id}
    `;

    const row = requestResult[0] as { id: string; metered_at: string | null; deleted_at: string | null } | undefined;
    if (!row) return false;

    // If a request has never been metered (e.g., a true draft), allow hard-delete.
    // Metered requests are soft-deleted so they continue to count toward usage limits.
    if (!row.metered_at) {
        await sql`
            DELETE FROM utility_entries WHERE request_id = ${id}
        `;

        const result = await sql`
            DELETE FROM requests WHERE id = ${id} RETURNING id
        `;

        return result.length > 0;
    }

    const result = await sql`
        UPDATE requests
        SET deleted_at = NOW(), last_activity_at = NOW()
        WHERE id = ${id}
            AND deleted_at IS NULL
        RETURNING id
    `;

    // Treat already-deleted as success to avoid races between fetch + delete.
    if (result.length > 0) return true;
    return row.deleted_at != null;
}

/**
 * Get dashboard stats for requests
 */
export async function getDashboardStats(accountId: string, organizationId?: string) {
    if (!sql) {
        return { total_requests: 0, draft: 0, sent: 0, in_progress: 0, submitted: 0, needs_attention: 0 };
    }

    const result = await sql`
        SELECT 
            COUNT(*) as total_requests,
            COUNT(*) FILTER (WHERE status = 'draft') as draft,
            COUNT(*) FILTER (WHERE status = 'sent') as sent,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
            COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
            COUNT(*) FILTER (WHERE status = 'sent' AND created_at < NOW() - INTERVAL '3 days') as needs_attention
        FROM requests 
        WHERE ${organizationId
            ? sql`deleted_at IS NULL AND (organization_id = ${organizationId} OR (account_id = ${accountId} AND organization_id IS NULL))`
            : sql`account_id = ${accountId} AND organization_id IS NULL AND deleted_at IS NULL`}
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

/**
 * Get weekly stats for an account (requests from the past 7 days)
 */
export async function getWeeklyStats(
    accountId: string,
    organizationId?: string
): Promise<{
    totalRequests: number;
    submitted: number;
    sent: number;
    inProgress: number;
    needsAttention: number;
}> {
    if (!sql) return { totalRequests: 0, submitted: 0, sent: 0, inProgress: 0, needsAttention: 0 };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const whereClause = organizationId
        ? sql`created_at >= ${sevenDaysAgo.toISOString()} AND deleted_at IS NULL AND (organization_id = ${organizationId} OR (account_id = ${accountId} AND organization_id IS NULL))`
        : sql`account_id = ${accountId} AND organization_id IS NULL AND created_at >= ${sevenDaysAgo.toISOString()} AND deleted_at IS NULL`;

    const result = await sql`
        SELECT 
            COUNT(*) as total_requests,
            COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
            COUNT(*) FILTER (WHERE status = 'sent') as sent,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
            COUNT(*) FILTER (WHERE status = 'sent' AND created_at < NOW() - INTERVAL '3 days') as needs_attention
        FROM requests 
        WHERE ${whereClause}
    `;

    return {
        totalRequests: Number(result[0]?.total_requests) || 0,
        submitted: Number(result[0]?.submitted) || 0,
        sent: Number(result[0]?.sent) || 0,
        inProgress: Number(result[0]?.in_progress) || 0,
        needsAttention: Number(result[0]?.needs_attention) || 0,
    };
}

/**
 * Get utility entries for a request
 */
export async function getUtilityEntriesByRequestId(requestId: string): Promise<UtilityEntry[]> {
    if (!sql) return [];

    try {
        const result = await sql`
            SELECT * FROM utility_entries 
            WHERE request_id = ${requestId}
            ORDER BY category ASC
        `;

        return result as UtilityEntry[];
    } catch (error) {
        console.error('Error fetching utility entries:', error);
        return [];
    }
}
