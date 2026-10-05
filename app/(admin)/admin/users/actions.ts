'use server';

import { cookies } from 'next/headers';
import {
    requireAdmin,
    createAuditLogWithContext,
    getUserById,
    assertAdminActionReason,
    assertAdminWritesEnabled,
} from '@/lib/admin';
import {
    AdminActionRefusal,
    adminActionFailure,
    beginAdminWrite,
    type AdminActionFailure,
} from '@/lib/admin/action-guard';
import { accountPlanRefusal, accountRoleRefusal } from '@/lib/admin/refusals';
import { changeAccountPlan, changeAccountRole } from '@/lib/neon/queries/admin-writes';
import {
    adminBanSchema,
    adminPlanChangeSchema,
    adminRoleChangeSchema,
} from '@/lib/validation/admin-schemas';

const IMPERSONATION_COOKIE = 'impersonator_id';
const IMPERSONATED_USER_COOKIE = 'impersonated_user_id';

type AdminActionResult = { success: true } | AdminActionFailure;

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
 * Update a user's role. The role change, last-admin protection and audit entry
 * commit together; see lib/neon/queries/admin-writes.ts.
 */
export async function updateUserRoleAction(input: {
    userId: string;
    role: string;
    expectedRole: string;
    reason: string;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminRoleChangeSchema.parse(input);

        const { outcome } = await changeAccountRole({
            actor,
            reason: parsed.reason,
            targetId: parsed.userId,
            nextRole: parsed.role,
            expectedRole: parsed.expectedRole,
            action: 'role_changed',
        });
        if (outcome !== 'OK') throw accountRoleRefusal(outcome, 'role', parsed.role);
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'user_role_change');
    }
}

/**
 * Ban a user
 */
export async function banUserAction(input: {
    userId: string;
    expectedRole: string;
    reason: string;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminBanSchema.parse(input);

        const { outcome } = await changeAccountRole({
            actor,
            reason: parsed.reason,
            targetId: parsed.userId,
            nextRole: 'banned',
            expectedRole: parsed.expectedRole,
            action: 'user_banned',
        });
        if (outcome !== 'OK') throw accountRoleRefusal(outcome, 'ban', 'banned');
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'user_ban');
    }
}

/**
 * Unban a user
 */
export async function unbanUserAction(input: {
    userId: string;
    expectedRole: string;
    reason: string;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminBanSchema.parse(input);
        if (parsed.expectedRole !== 'banned') {
            throw new AdminActionRefusal('NO_OP_UNBAN', 'User is not banned.');
        }

        const { outcome } = await changeAccountRole({
            actor,
            reason: parsed.reason,
            targetId: parsed.userId,
            nextRole: 'user',
            expectedRole: 'banned',
            action: 'user_unbanned',
        });
        if (outcome !== 'OK') throw accountRoleRefusal(outcome, 'unban', 'user');
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'user_unban');
    }
}

/**
 * Update a user's entitlement override. Does not touch Stripe.
 */
export async function updateUserPlanAction(input: {
    userId: string;
    plan: string;
    expectedPlan: string;
    reason: string;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminPlanChangeSchema.parse(input);

        const { outcome } = await changeAccountPlan({
            actor,
            reason: parsed.reason,
            targetId: parsed.userId,
            nextPlan: parsed.plan,
            expectedPlan: parsed.expectedPlan,
        });
        if (outcome !== 'OK') throw accountPlanRefusal(outcome, parsed.plan);
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'user_plan_change');
    }
}
