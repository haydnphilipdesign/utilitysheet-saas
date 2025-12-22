'use server';

import { cookies } from 'next/headers';
import { requireAdmin, createAuditLog, banUser, unbanUser, updateUserRole, getUserById, updateUserPlan } from '@/lib/admin';
import type { UserRole, Plan } from '@/types';

const IMPERSONATION_COOKIE = 'impersonator_id';
const IMPERSONATED_USER_COOKIE = 'impersonated_user_id';

/**
 * Start impersonating a user
 * Stores the admin's ID and the target user's ID in secure cookies
 */
export async function impersonateUser(targetUserId: string) {
    const { account } = await requireAdmin();

    // Verify target user exists
    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
        return { success: false, error: 'User not found' };
    }

    // Store the admin's ID and target user ID in secure cookies
    const cookieStore = await cookies();

    cookieStore.set(IMPERSONATION_COOKIE, account.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 4, // 4 hours
    });

    cookieStore.set(IMPERSONATED_USER_COOKIE, targetUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 4, // 4 hours
    });

    // Log the impersonation
    await createAuditLog({
        adminId: account.id,
        targetUserId,
        action: 'impersonation_started',
        metadata: {
            timestamp: new Date().toISOString(),
            targetEmail: targetUser.email,
        },
    });

    return { success: true };
}

/**
 * Stop impersonating a user
 */
export async function stopImpersonating() {
    const cookieStore = await cookies();
    const impersonatorId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
    const impersonatedUserId = cookieStore.get(IMPERSONATED_USER_COOKIE)?.value;

    if (impersonatorId) {
        await createAuditLog({
            adminId: impersonatorId,
            targetUserId: impersonatedUserId,
            action: 'impersonation_ended',
            metadata: { timestamp: new Date().toISOString() },
        });
    }

    cookieStore.delete(IMPERSONATION_COOKIE);
    cookieStore.delete(IMPERSONATED_USER_COOKIE);

    return { success: true };
}

/**
 * Get current impersonation status
 */
export async function getImpersonationStatus() {
    const cookieStore = await cookies();
    const impersonatorId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
    const impersonatedUserId = cookieStore.get(IMPERSONATED_USER_COOKIE)?.value;

    return {
        isImpersonating: !!impersonatorId,
        impersonatorId: impersonatorId || null,
        impersonatedUserId: impersonatedUserId || null,
    };
}

/**
 * Update a user's role
 */
export async function updateUserRoleAction(userId: string, role: UserRole) {
    const { account } = await requireAdmin();

    const targetUser = await getUserById(userId);
    if (!targetUser) {
        return { success: false, error: 'User not found' };
    }

    const previousRole = targetUser.role;
    const result = await updateUserRole(userId, role);

    if (result) {
        await createAuditLog({
            adminId: account.id,
            targetUserId: userId,
            action: 'role_changed',
            metadata: {
                previousRole,
                newRole: role,
                timestamp: new Date().toISOString(),
            },
        });
    }

    return { success: !!result };
}

/**
 * Ban a user
 */
export async function banUserAction(userId: string) {
    const { account } = await requireAdmin();

    const result = await banUser(userId);

    if (result) {
        await createAuditLog({
            adminId: account.id,
            targetUserId: userId,
            action: 'user_banned',
            metadata: { timestamp: new Date().toISOString() },
        });
    }

    return { success: !!result };
}

/**
 * Unban a user
 */
export async function unbanUserAction(userId: string) {
    const { account } = await requireAdmin();

    const result = await unbanUser(userId);

    if (result) {
        await createAuditLog({
            adminId: account.id,
            targetUserId: userId,
            action: 'user_unbanned',
            metadata: { timestamp: new Date().toISOString() },
        });
    }

    return { success: !!result };
}

/**
 * Update a user's plan
 */
export async function updateUserPlanAction(userId: string, plan: Plan) {
    const { account } = await requireAdmin();

    const targetUser = await getUserById(userId);
    if (!targetUser) {
        return { success: false, error: 'User not found' };
    }

    const previousPlan = targetUser.plan;
    const result = await updateUserPlan(userId, plan);

    if (result) {
        await createAuditLog({
            adminId: account.id,
            targetUserId: userId,
            action: 'plan_changed',
            metadata: {
                previousPlan,
                newPlan: plan,
                timestamp: new Date().toISOString(),
            },
        });
    }

    return { success: !!result };
}
