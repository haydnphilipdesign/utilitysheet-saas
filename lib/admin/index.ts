import "server-only";
import { stackServerApp } from '@/lib/stack/server';
import { sql } from '@/lib/neon/db';
import type { Account, UserRole, AdminAction, AdminAuditLog, Plan } from '@/types';
import { headers } from 'next/headers';

type StackUser = {
    id: string;
    primaryEmail?: string | null;
    displayName?: string | null;
};

export type AdminAuditLogRow = AdminAuditLog & {
    admin_email: string | null;
    admin_name: string | null;
    target_email: string | null;
    target_name: string | null;
};

// Custom error for admin authorization failures
export class AdminAuthorizationError extends Error {
    constructor(message = 'Admin access required') {
        super(message);
        this.name = 'AdminAuthorizationError';
    }
}

export class AdminWriteDisabledError extends Error {
    constructor(message = 'Admin writes are disabled') {
        super(message);
        this.name = 'AdminWriteDisabledError';
    }
}

function adminDebugLog(...args: unknown[]) {
    if (process.env.ADMIN_DEBUG === 'true') {
        console.log(...args);
    }
}

export function assertAdminWritesEnabled() {
    if (process.env.ADMIN_WRITES_DISABLED === 'true') {
        throw new AdminWriteDisabledError('Admin writes are disabled via ADMIN_WRITES_DISABLED=true');
    }
}

export function assertAdminActionReason(reason: string) {
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new Error('Admin action requires a reason (min 3 characters)');
    }
}

export async function getRequestContext() {
    const headersList = await headers();
    const ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        null;
    const userAgent = headersList.get('user-agent') || null;

    return { ipAddress, userAgent };
}

// Get account by Stack Auth user ID
async function getAccountByAuthId(authUserId: string): Promise<Account | null> {
    if (!sql) return null;
    const result = await sql`
        SELECT * FROM accounts WHERE auth_user_id = ${authUserId}
    `;
    return (result[0] as Account) || null;
}

/**
 * Validates that the current user is an admin.
 * Use this at the start of any admin-only Server Action.
 * @throws AdminAuthorizationError if user is not authenticated or not an admin
 */
export async function requireAdmin(): Promise<{ user: StackUser; account: Account }> {
    const user = (await stackServerApp.getUser()) as StackUser | null;

    adminDebugLog('[Admin] Checking admin access for user:', user?.id, user?.primaryEmail);

    if (!user) {
        adminDebugLog('[Admin] No user found - not authenticated');
        throw new AdminAuthorizationError('Not authenticated');
    }

    const account = await getAccountByAuthId(user.id);

    adminDebugLog('[Admin] Account lookup result:', account ? {
        id: account.id,
        email: account.email,
        role: account.role
    } : 'NOT FOUND');

    if (!account) {
        adminDebugLog('[Admin] Account not found for auth_user_id:', user.id);
        throw new AdminAuthorizationError('Account not found');
    }

    if (account.role !== 'admin') {
        adminDebugLog('[Admin] User role is:', account.role, '- admin access denied');
        throw new AdminAuthorizationError('Admin access required');
    }

    adminDebugLog('[Admin] Access granted for:', account.email);
    return { user, account };
}

// =====================
// Admin Data Access Layer
// =====================

/**
 * Get all users with pagination for admin dashboard
 */
export async function getAllUsers(limit = 50, offset = 0): Promise<{ users: Account[]; total: number }> {
    if (!sql) return { users: [], total: 0 };

    const [users, countResult] = await Promise.all([
        sql`
            SELECT id, auth_user_id, email, full_name, company_name, phone, 
                   active_organization_id, role, subscription_status, created_at, updated_at
            FROM accounts
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*) as count FROM accounts`
    ]);

    return {
        users: users as Account[],
        total: Number(countResult[0]?.count || 0)
    };
}

export async function searchUsers(params: {
    limit?: number;
    offset?: number;
    query?: string;
    role?: UserRole;
    plan?: Plan;
}): Promise<{ users: Account[]; total: number }> {
    if (!sql) return { users: [], total: 0 };

    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const offset = Math.max(0, params.offset ?? 0);

    const query = params.query?.trim() || '';
    const q = query ? `%${query}%` : null;

    let whereClause = sql`TRUE`;

    if (q) {
        whereClause = sql`
            ${whereClause}
            AND (
                email ILIKE ${q}
                OR full_name ILIKE ${q}
                OR company_name ILIKE ${q}
                OR CAST(id AS TEXT) ILIKE ${q}
            )
        `;
    }

    if (params.role) {
        whereClause = sql`${whereClause} AND role = ${params.role}`;
    }

    if (params.plan) {
        whereClause = sql`${whereClause} AND subscription_status = ${params.plan}`;
    }

    const [users, countResult] = await Promise.all([
        sql`
            SELECT id, auth_user_id, email, full_name, company_name, phone,
                   active_organization_id, role, subscription_status, created_at, updated_at
            FROM accounts
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*) as count FROM accounts WHERE ${whereClause}`,
    ]);

    return {
        users: users as Account[],
        total: Number(countResult[0]?.count || 0),
    };
}

/**
 * Get a single user by ID
 */
export async function getUserById(userId: string): Promise<Account | null> {
    if (!sql) return null;
    const result = await sql`
        SELECT * FROM accounts WHERE id = ${userId}
    `;
    return (result[0] as Account) || null;
}

/**
 * Update user role (admin, user, banned)
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<Account | null> {
    if (!sql) return null;
    const result = await sql`
        UPDATE accounts SET role = ${role} WHERE id = ${userId}
        RETURNING *
    `;
    return (result[0] as Account) || null;
}

/**
 * Update user plan (free, pro)
 */
export async function updateUserPlan(userId: string, plan: Plan): Promise<Account | null> {
    if (!sql) return null;
    const result = await sql`
        UPDATE accounts SET subscription_status = ${plan} WHERE id = ${userId}
        RETURNING *
    `;
    return (result[0] as Account) || null;
}

/**
 * Ban a user (sets role to 'banned')
 */
export async function banUser(userId: string): Promise<Account | null> {
    return updateUserRole(userId, 'banned');
}

/**
 * Unban a user (sets role back to 'user')
 */
export async function unbanUser(userId: string): Promise<Account | null> {
    return updateUserRole(userId, 'user');
}

/**
 * Create an audit log entry for admin actions
 */
export async function createAuditLog(data: {
    adminId: string;
    targetUserId?: string | null;
    action: AdminAction;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
}): Promise<AdminAuditLog | null> {
    if (!sql) return null;

    const result = await sql`
        INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
        VALUES (
            ${data.adminId},
            ${data.targetUserId || null},
            ${data.action},
            ${JSON.stringify(data.metadata || {})},
            ${data.ipAddress || null}
        )
        RETURNING *
    `;
    return (result[0] as AdminAuditLog) || null;
}

export async function createAuditLogWithContext(data: {
    adminId: string;
    targetUserId?: string | null;
    action: AdminAction;
    metadata?: Record<string, unknown>;
}): Promise<AdminAuditLog | null> {
    const { ipAddress, userAgent } = await getRequestContext();

    return createAuditLog({
        ...data,
        ipAddress: ipAddress || undefined,
        metadata: {
            ...data.metadata,
            userAgent: userAgent || undefined,
        },
    });
}

/**
 * Get audit log entries with admin and target user details
 */
export async function getAuditLogs(limit = 100): Promise<AdminAuditLogRow[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT 
            al.*,
            a.email as admin_email,
            a.full_name as admin_name,
            t.email as target_email,
            t.full_name as target_name
        FROM admin_audit_logs al
        LEFT JOIN accounts a ON al.admin_id = a.id
        LEFT JOIN accounts t ON al.target_user_id = t.id
        ORDER BY al.created_at DESC
        LIMIT ${limit}
    `;
    return result as unknown as AdminAuditLogRow[];
}

export async function searchAuditLogs(params: {
    limit?: number;
    offset?: number;
    query?: string;
    action?: AdminAction;
}): Promise<{ logs: AdminAuditLogRow[]; total: number }> {
    if (!sql) return { logs: [], total: 0 };

    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const offset = Math.max(0, params.offset ?? 0);

    const query = params.query?.trim() || '';
    const q = query ? `%${query}%` : null;

    let whereClause = sql`TRUE`;

    if (params.action) {
        whereClause = sql`${whereClause} AND al.action = ${params.action}`;
    }

    if (q) {
        whereClause = sql`
            ${whereClause}
            AND (
                al.action ILIKE ${q}
                OR CAST(al.id AS TEXT) ILIKE ${q}
                OR CAST(al.admin_id AS TEXT) ILIKE ${q}
                OR CAST(al.target_user_id AS TEXT) ILIKE ${q}
                OR CAST(al.metadata AS TEXT) ILIKE ${q}
                OR a.email ILIKE ${q}
                OR a.full_name ILIKE ${q}
                OR t.email ILIKE ${q}
                OR t.full_name ILIKE ${q}
            )
        `;
    }

    const [logs, countResult] = await Promise.all([
        sql`
            SELECT 
                al.*,
                a.email as admin_email,
                a.full_name as admin_name,
                t.email as target_email,
                t.full_name as target_name
            FROM admin_audit_logs al
            LEFT JOIN accounts a ON al.admin_id = a.id
            LEFT JOIN accounts t ON al.target_user_id = t.id
            WHERE ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
            SELECT COUNT(*) as count
            FROM admin_audit_logs al
            LEFT JOIN accounts a ON al.admin_id = a.id
            LEFT JOIN accounts t ON al.target_user_id = t.id
            WHERE ${whereClause}
        `,
    ]);

    return {
        logs: logs as unknown as AdminAuditLogRow[],
        total: Number(countResult[0]?.count || 0),
    };
}
