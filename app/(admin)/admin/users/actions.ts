'use server';

import { cookies } from 'next/headers';
import { sql } from '@/lib/neon/db';
import {
    requireAdmin,
    createAuditLogWithContext,
    banUser,
    unbanUser,
    updateUserRole,
    getUserById,
    updateUserPlan,
    assertAdminActionReason,
    assertAdminWritesEnabled,
    countAdmins,
} from '@/lib/admin';
import type { UserRole, Plan } from '@/types';
import {
    evaluateBanPolicy,
    evaluatePlanPolicy,
    evaluateRoleChangePolicy,
    evaluateUnbanPolicy,
} from '@/lib/admin/policies';

const IMPERSONATION_COOKIE = 'impersonator_id';
const IMPERSONATED_USER_COOKIE = 'impersonated_user_id';

type AdminActionResult =
    | { success: true }
    | { success: false; error: string; code?: string };

async function isTeamManagedUser(activeOrganizationId: string | null): Promise<boolean> {
    if (!activeOrganizationId || !sql) return false;

    const result = await sql`
        SELECT subscription_status
        FROM organizations
        WHERE id = ${activeOrganizationId}
        LIMIT 1
    `;
    return result[0]?.subscription_status === 'team';
}

/**
 * Start impersonating a user
 * Stores the admin's ID and the target user's ID in secure cookies
 */
export async function impersonateUser(targetUserId: string, reason: string) {
    const { account } = await requireAdmin();
    assertAdminWritesEnabled();
    assertAdminActionReason(reason);

    if (process.env.ADMIN_ENABLE_IMPERSONATION !== 'true') {
        return { success: false, error: 'Impersonation is disabled' };
    }

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
    await createAuditLogWithContext({
        adminId: account.id,
        targetUserId,
        action: 'impersonation_started',
        metadata: {
            reason,
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
        await createAuditLogWithContext({
            adminId: impersonatorId,
            targetUserId: impersonatedUserId,
            action: 'impersonation_ended',
            metadata: {},
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
export async function updateUserRoleAction(userId: string, role: UserRole, reason: string) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        const targetUser = await getUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'User not found' };
        }

        const previousRole = targetUser.role;
        const adminCount = await countAdmins();
        const policy = evaluateRoleChangePolicy({
            actorId: account.id,
            targetId: targetUser.id,
            currentRole: previousRole,
            nextRole: role,
            adminCount,
            allowAdminPromotion: false,
        });

        if (!policy.allowed) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'role_changed',
                metadata: {
                    reason,
                    blocked: true,
                    policy: policy.policy,
                    code: policy.code,
                    previousRole,
                    attemptedRole: role,
                },
            });
            return { success: false, error: policy.message, code: policy.code } satisfies AdminActionResult;
        }

        const result = await updateUserRole(userId, role);

        if (result) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'role_changed',
                metadata: {
                    reason,
                    previousRole,
                    newRole: role,
                },
            });
        }

        if (!result) return { success: false, error: 'Failed to update role', code: 'UNKNOWN' } satisfies AdminActionResult;
        return { success: true } satisfies AdminActionResult;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error', code: 'UNKNOWN' } satisfies AdminActionResult;
    }
}

/**
 * Ban a user
 */
export async function banUserAction(userId: string, reason: string) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        const targetUser = await getUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'User not found' };
        }

        const adminCount = await countAdmins();
        const policy = evaluateBanPolicy({
            actorId: account.id,
            targetId: targetUser.id,
            currentRole: targetUser.role,
            adminCount,
        });

        if (!policy.allowed) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'user_banned',
                metadata: {
                    reason,
                    blocked: true,
                    policy: policy.policy,
                    code: policy.code,
                    previousRole: targetUser.role,
                    attemptedRole: 'banned',
                },
            });
            return { success: false, error: policy.message, code: policy.code } satisfies AdminActionResult;
        }

        const result = await banUser(userId);

        if (result) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'user_banned',
                metadata: {
                    reason,
                    previousRole: targetUser.role,
                    newRole: 'banned',
                },
            });
        }

        if (!result) return { success: false, error: 'Failed to ban user', code: 'UNKNOWN' } satisfies AdminActionResult;
        return { success: true } satisfies AdminActionResult;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error', code: 'UNKNOWN' } satisfies AdminActionResult;
    }
}

/**
 * Unban a user
 */
export async function unbanUserAction(userId: string, reason: string) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        const targetUser = await getUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'User not found' };
        }

        const policy = evaluateUnbanPolicy(targetUser.role);
        if (!policy.allowed) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'user_unbanned',
                metadata: {
                    reason,
                    blocked: true,
                    policy: policy.policy,
                    code: policy.code,
                    previousRole: targetUser.role,
                    attemptedRole: 'user',
                },
            });
            return { success: false, error: policy.message, code: policy.code } satisfies AdminActionResult;
        }

        const result = await unbanUser(userId);

        if (result) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'user_unbanned',
                metadata: {
                    reason,
                    previousRole: targetUser.role,
                    newRole: 'user',
                },
            });
        }

        if (!result) return { success: false, error: 'Failed to unban user', code: 'UNKNOWN' } satisfies AdminActionResult;
        return { success: true } satisfies AdminActionResult;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error', code: 'UNKNOWN' } satisfies AdminActionResult;
    }
}

/**
 * Update a user's plan
 */
export async function updateUserPlanAction(userId: string, plan: Plan, reason: string) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        const targetUser = await getUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'User not found' };
        }

        if (await isTeamManagedUser(targetUser.active_organization_id)) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'plan_changed',
                metadata: {
                    reason,
                    blocked: true,
                    policy: 'organization_team_managed',
                    code: 'ORG_TEAM_MANAGED_PLAN',
                    attemptedPlan: plan,
                    activeOrganizationId: targetUser.active_organization_id,
                },
            });
            return {
                success: false,
                error: 'Plan is managed by the active Teams organization.',
                code: 'ORG_TEAM_MANAGED_PLAN',
            } satisfies AdminActionResult;
        }

        const previousPlan = targetUser.subscription_status;
        const policy = evaluatePlanPolicy(previousPlan, plan);
        if (!policy.allowed) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'plan_changed',
                metadata: {
                    reason,
                    blocked: true,
                    policy: policy.policy,
                    code: policy.code,
                    previousPlan,
                    attemptedPlan: plan,
                },
            });
            return { success: false, error: policy.message, code: policy.code } satisfies AdminActionResult;
        }

        const result = await updateUserPlan(userId, plan);

        if (result) {
            await createAuditLogWithContext({
                adminId: account.id,
                targetUserId: userId,
                action: 'plan_changed',
                metadata: {
                    reason,
                    previousPlan,
                    newPlan: plan,
                },
            });
        }

        if (!result) return { success: false, error: 'Failed to update plan', code: 'UNKNOWN' } satisfies AdminActionResult;
        return { success: true } satisfies AdminActionResult;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error', code: 'UNKNOWN' } satisfies AdminActionResult;
    }
}
