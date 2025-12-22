import "server-only";
import { stackServerApp } from '@/lib/stack/server';
import { sql } from '@/lib/neon/db';
import type { Account, UserRole, AdminAction, AdminAuditLog } from '@/types';

// Custom error for admin authorization failures
export class AdminAuthorizationError extends Error {
    constructor(message = 'Admin access required') {
        super(message);
        this.name = 'AdminAuthorizationError';
    }
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
export async function requireAdmin(): Promise<{ user: any; account: Account }> {
    const user = await stackServerApp.getUser();

    if (!user) {
        throw new AdminAuthorizationError('Not authenticated');
    }

    const account = await getAccountByAuthId(user.id);

    if (!account) {
        throw new AdminAuthorizationError('Account not found');
    }

    if (account.role !== 'admin') {
        throw new AdminAuthorizationError('Admin access required');
    }

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
                   active_organization_id, role, created_at, updated_at
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

/**
 * Get audit log entries with admin and target user details
 */
export async function getAuditLogs(limit = 100): Promise<any[]> {
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
    return result as any[];
}
