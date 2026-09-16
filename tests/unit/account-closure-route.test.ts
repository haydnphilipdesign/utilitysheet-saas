import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    assertRecentAuth: vi.fn(),
    buildReview: vi.fn(),
    checkRateLimit: vi.fn(),
    claimClosure: vi.fn(),
    getClosure: vi.fn(),
    getContext: vi.fn(),
    recordEvent: vi.fn(),
    resolveTransfers: vi.fn(),
    runClosure: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/account/closure', () => ({
    ACCOUNT_SUPPORT_EMAIL: 'support@example.com',
    buildAccountClosureReview: mocks.buildReview,
    resolveClosureTransfers: mocks.resolveTransfers,
    runAccountClosure: mocks.runClosure,
}));
vi.mock('@/lib/account/security', () => ({
    getAccountSecurityContext: mocks.getContext,
    assertRecentAuth: mocks.assertRecentAuth,
    accountSecurityErrorResponse: (error: unknown) => {
        if (error && typeof error === 'object' && 'code' in error) {
            const typed = error as { code: string; status?: number; message?: string };
            return Response.json({ code: typed.code, error: typed.message }, { status: typed.status || 403 });
        }
        return null;
    },
}));
vi.mock('@/lib/neon/queries', () => ({
    claimAccountClosure: mocks.claimClosure,
    getAccountClosure: mocks.getClosure,
    recordAccountSecurityEvent: mocks.recordEvent,
}));
vi.mock('@/lib/rate-limit', () => ({
    accountSecurityRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: () => ({}),
    isRateLimitUnavailable: () => false,
}));

import { GET, POST } from '@/app/api/account/closure/route';

const review = {
    eligible: true,
    blockers: [],
    confirmationEmail: 'owner@example.com',
    billing: { cancelsPersonalPlan: false, cancelsWorkspacePlans: [] },
    personal: { requestCount: 1, openRequestCount: 0, profileCount: 0, hasSellerForm: false },
    deletedWorkspaces: [],
    sharedWorkspaces: [],
    forfeitedReferralCredits: 0,
    pendingInvitations: 0,
    supportEmail: 'support@example.com',
};

function context(status: 'active' | 'closing' | 'closed' = 'active', impersonation = false) {
    return {
        account: { id: 'acct_1' },
        closureStatus: status,
        user: { id: 'stack_1', primaryEmail: 'owner@example.com' },
        currentSession: { createdAt: new Date(), isImpersonation: impersonation },
        isImpersonation: impersonation,
    };
}

function post(body: unknown) {
    return POST(new Request('http://localhost/api/account/closure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }));
}

describe('/api/account/closure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.assertRecentAuth.mockImplementation(() => undefined);
        mocks.getContext.mockResolvedValue(context());
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.buildReview.mockResolvedValue(review);
        mocks.resolveTransfers.mockReturnValue({ ok: true, transfers: {} });
        mocks.claimClosure.mockResolvedValue(true);
        mocks.runClosure.mockResolvedValue({ status: 'closed' });
        mocks.recordEvent.mockResolvedValue(true);
    });

    it('requires recent authentication to view the destructive review', async () => {
        mocks.assertRecentAuth.mockImplementation(() => {
            throw { code: 'RECENT_AUTH_REQUIRED', status: 403, message: 'Confirm your password.' };
        });

        const response = await GET();

        expect(response.status).toBe(403);
        expect(mocks.buildReview).not.toHaveBeenCalled();
    });

    it('returns server-computed impersonation and admin blockers', async () => {
        mocks.getContext.mockResolvedValue(context('active', true));
        mocks.buildReview.mockResolvedValue({
            ...review,
            eligible: false,
            blockers: [
                { code: 'impersonation', message: 'Owner only.' },
                { code: 'platform_admin', message: 'Remove admin access.' },
            ],
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.review.eligible).toBe(false);
        expect(body.review.blockers).toHaveLength(2);
    });

    it('rejects a typed email mismatch before claiming closure', async () => {
        const response = await post({
            action: 'close', confirmationEmail: 'other@example.com', acknowledged: true, transfers: {},
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ code: 'CONFIRMATION_MISMATCH' });
        expect(mocks.claimClosure).not.toHaveBeenCalled();
    });

    it('rejects an unacknowledged request at schema validation', async () => {
        const response = await post({
            action: 'close', confirmationEmail: 'owner@example.com', acknowledged: false, transfers: {},
        });

        expect(response.status).toBe(400);
        expect(mocks.claimClosure).not.toHaveBeenCalled();
    });

    it('recomputes blockers at submit and does not trust the client review', async () => {
        mocks.buildReview.mockResolvedValue({
            ...review,
            eligible: false,
            blockers: [{ code: 'billing_unsettled', message: 'Pay the balance.' }],
        });

        const response = await post({
            action: 'close', confirmationEmail: 'owner@example.com', acknowledged: true, transfers: {},
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ code: 'CLOSURE_BLOCKED' });
        expect(mocks.claimClosure).not.toHaveBeenCalled();
    });

    it('rejects a transfer target that is no longer an admin', async () => {
        mocks.resolveTransfers.mockReturnValue({ ok: false, error: 'Choose a current admin.' });

        const response = await post({
            action: 'close',
            confirmationEmail: 'owner@example.com',
            acknowledged: true,
            transfers: { '22222222-2222-4222-8222-222222222222': '33333333-3333-4333-8333-333333333333' },
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_TRANSFER' });
        expect(mocks.claimClosure).not.toHaveBeenCalled();
    });

    it('claims an eligible closure and returns the executor result', async () => {
        const response = await post({
            action: 'close', confirmationEmail: 'OWNER@example.com', acknowledged: true, transfers: {},
        });

        expect(response.status).toBe(200);
        expect(mocks.claimClosure).toHaveBeenCalledWith({
            accountId: 'acct_1', transfers: {}, notifyEmail: 'owner@example.com',
        });
        expect(mocks.runClosure).toHaveBeenCalledWith('acct_1');
    });

    it('resumes a closing account without re-running confirmation and reports partial failure', async () => {
        mocks.getContext.mockResolvedValue(context('closing'));
        mocks.runClosure.mockResolvedValue({ status: 'closing', step: 'assets_removed', errorCode: 'auth_delete_failed' });

        const response = await post({ action: 'retry' });

        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toMatchObject({
            status: 'closing', step: 'assets_removed', errorCode: 'auth_delete_failed',
        });
        expect(mocks.assertRecentAuth).not.toHaveBeenCalled();
        expect(mocks.claimClosure).not.toHaveBeenCalled();
    });

    it('refuses an impersonated retry and returns a repeated closed request safely', async () => {
        mocks.getContext.mockResolvedValue(context('closing', true));
        const impersonated = await post({ action: 'retry' });
        expect(impersonated.status).toBe(403);
        expect(mocks.runClosure).not.toHaveBeenCalled();

        mocks.getContext.mockResolvedValue(context('closed'));
        const closed = await post({ action: 'retry' });
        expect(closed.status).toBe(200);
        await expect(closed.json()).resolves.toEqual({ status: 'closed' });
    });
});
