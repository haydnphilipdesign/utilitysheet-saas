import type { Plan, UserRole } from '@/types';

export type AdminPolicyResult =
    | { allowed: true }
    | {
        allowed: false;
        code:
        | 'SELF_ROLE_CHANGE_BLOCKED'
        | 'SELF_BAN_BLOCKED'
        | 'LAST_ADMIN_PROTECTED'
        | 'ADMIN_PROMOTION_DISABLED'
        | 'NO_OP_ROLE'
        | 'NO_OP_BAN'
        | 'NO_OP_UNBAN'
        | 'NO_OP_PLAN';
        message: string;
        policy:
        | 'self_protection'
        | 'last_admin_protection'
        | 'admin_promotion_disabled'
        | 'no_op';
    };

type RolePolicyInput = {
    actorId: string;
    targetId: string;
    currentRole: UserRole;
    nextRole: UserRole;
    adminCount: number;
    allowAdminPromotion?: boolean;
};

export function evaluateRoleChangePolicy(input: RolePolicyInput): AdminPolicyResult {
    if (input.currentRole === input.nextRole) {
        return {
            allowed: false,
            code: 'NO_OP_ROLE',
            message: `User already has role "${input.nextRole}".`,
            policy: 'no_op',
        };
    }

    if (input.nextRole === 'admin' && input.currentRole !== 'admin' && input.allowAdminPromotion === false) {
        return {
            allowed: false,
            code: 'ADMIN_PROMOTION_DISABLED',
            message: 'Admin promotion is disabled in this user management flow.',
            policy: 'admin_promotion_disabled',
        };
    }

    if (input.actorId === input.targetId && input.nextRole !== 'admin') {
        return {
            allowed: false,
            code: 'SELF_ROLE_CHANGE_BLOCKED',
            message: 'You cannot remove your own admin access.',
            policy: 'self_protection',
        };
    }

    if (input.currentRole === 'admin' && input.nextRole !== 'admin' && input.adminCount <= 1) {
        return {
            allowed: false,
            code: 'LAST_ADMIN_PROTECTED',
            message: 'Cannot remove admin access from the last admin account.',
            policy: 'last_admin_protection',
        };
    }

    return { allowed: true };
}

type BanPolicyInput = {
    actorId: string;
    targetId: string;
    currentRole: UserRole;
    adminCount: number;
};

export function evaluateBanPolicy(input: BanPolicyInput): AdminPolicyResult {
    if (input.currentRole === 'banned') {
        return {
            allowed: false,
            code: 'NO_OP_BAN',
            message: 'User is already banned.',
            policy: 'no_op',
        };
    }

    if (input.actorId === input.targetId) {
        return {
            allowed: false,
            code: 'SELF_BAN_BLOCKED',
            message: 'You cannot ban your own account.',
            policy: 'self_protection',
        };
    }

    if (input.currentRole === 'admin' && input.adminCount <= 1) {
        return {
            allowed: false,
            code: 'LAST_ADMIN_PROTECTED',
            message: 'Cannot ban the last admin account.',
            policy: 'last_admin_protection',
        };
    }

    return { allowed: true };
}

export function evaluateUnbanPolicy(currentRole: UserRole): AdminPolicyResult {
    if (currentRole !== 'banned') {
        return {
            allowed: false,
            code: 'NO_OP_UNBAN',
            message: 'User is not banned.',
            policy: 'no_op',
        };
    }

    return { allowed: true };
}

export function evaluatePlanPolicy(currentPlan: Plan, nextPlan: Plan): AdminPolicyResult {
    if (currentPlan === nextPlan) {
        return {
            allowed: false,
            code: 'NO_OP_PLAN',
            message: `User already has "${nextPlan}" plan.`,
            policy: 'no_op',
        };
    }

    return { allowed: true };
}
