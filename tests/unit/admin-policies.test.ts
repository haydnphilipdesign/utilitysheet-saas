import { describe, expect, it } from 'vitest';
import {
    evaluateBanPolicy,
    evaluatePlanPolicy,
    evaluateRoleChangePolicy,
    evaluateUnbanPolicy,
} from '@/lib/admin/policies';

describe('admin guardrail policies', () => {
    it('blocks self demotion from admin', () => {
        const result = evaluateRoleChangePolicy({
            actorId: 'acct_1',
            targetId: 'acct_1',
            currentRole: 'admin',
            nextRole: 'user',
            adminCount: 2,
        });

        expect(result.allowed).toBe(false);
        if (!result.allowed) {
            expect(result.code).toBe('SELF_ROLE_CHANGE_BLOCKED');
            expect(result.policy).toBe('self_protection');
        }
    });

    it('blocks removing last admin privileges', () => {
        const result = evaluateRoleChangePolicy({
            actorId: 'acct_2',
            targetId: 'acct_1',
            currentRole: 'admin',
            nextRole: 'user',
            adminCount: 1,
        });

        expect(result.allowed).toBe(false);
        if (!result.allowed) {
            expect(result.code).toBe('LAST_ADMIN_PROTECTED');
            expect(result.policy).toBe('last_admin_protection');
        }
    });

    it('blocks self-ban and last-admin bans', () => {
        const selfBan = evaluateBanPolicy({
            actorId: 'acct_1',
            targetId: 'acct_1',
            currentRole: 'admin',
            adminCount: 3,
        });

        expect(selfBan.allowed).toBe(false);
        if (!selfBan.allowed) expect(selfBan.code).toBe('SELF_BAN_BLOCKED');

        const lastAdminBan = evaluateBanPolicy({
            actorId: 'acct_2',
            targetId: 'acct_1',
            currentRole: 'admin',
            adminCount: 1,
        });

        expect(lastAdminBan.allowed).toBe(false);
        if (!lastAdminBan.allowed) expect(lastAdminBan.code).toBe('LAST_ADMIN_PROTECTED');
    });

    it('blocks no-op actions', () => {
        const noOpRole = evaluateRoleChangePolicy({
            actorId: 'acct_2',
            targetId: 'acct_1',
            currentRole: 'user',
            nextRole: 'user',
            adminCount: 2,
        });
        expect(noOpRole.allowed).toBe(false);
        if (!noOpRole.allowed) expect(noOpRole.code).toBe('NO_OP_ROLE');

        const noOpPlan = evaluatePlanPolicy('pro', 'pro');
        expect(noOpPlan.allowed).toBe(false);
        if (!noOpPlan.allowed) expect(noOpPlan.code).toBe('NO_OP_PLAN');

        const noOpUnban = evaluateUnbanPolicy('user');
        expect(noOpUnban.allowed).toBe(false);
        if (!noOpUnban.allowed) expect(noOpUnban.code).toBe('NO_OP_UNBAN');
    });
});
