import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ACCOUNT_SUPPORT_EMAIL,
    buildAccountClosureReview,
    resolveClosureTransfers,
    runAccountClosure,
    type AccountClosureRunResult,
} from '@/lib/account/closure';
import { accountSecurityErrorResponse, assertRecentAuth, getAccountSecurityContext } from '@/lib/account/security';
import { claimAccountClosure, getAccountClosure, recordAccountSecurityEvent } from '@/lib/neon/queries';
import { accountSecurityRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';

const MAX_BODY_BYTES = 8 * 1024;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

const bodySchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('close'),
        confirmationEmail: z.string().trim().min(1).max(254),
        acknowledged: z.literal(true),
        transfers: z.record(z.string().uuid(), z.string().uuid()).default({}),
    }),
    z.object({ action: z.literal('retry') }),
]);

const REVERTED_MESSAGES: Record<string, string> = {
    billing_unsettled: 'A subscription on your account has an unpaid balance, so nothing was deleted. Pay it in Billing, then try again.',
    billing_unavailable: 'We couldn’t reach billing to cancel your subscription, so nothing was deleted. Try again in a few minutes.',
    billing_cancel_failed: 'We couldn’t cancel your subscription, so nothing was deleted. Try again in a few minutes.',
    workspace_changed: 'Something changed in your workspaces while we were closing your account, so nothing was deleted. Review the changes and try again.',
};

async function applyRateLimit(userId: string) {
    const result = await checkRateLimit(accountSecurityRatelimit, userId, {
        requirePersistent: process.env.NODE_ENV === 'production',
    });
    if (isRateLimitUnavailable(result)) {
        return NextResponse.json(
            { error: 'Account closure is temporarily unavailable. Try again shortly.' },
            { status: 503, headers: NO_STORE },
        );
    }
    if (!result.success) {
        return NextResponse.json(
            { error: 'Too many attempts. Wait a few minutes and try again.' },
            { status: 429, headers: { ...getRateLimitHeaders(result), ...NO_STORE } },
        );
    }
    return null;
}

function runResultResponse(result: AccountClosureRunResult) {
    switch (result.status) {
        case 'closed':
            return NextResponse.json({ status: 'closed' }, { headers: NO_STORE });
        case 'closing':
            return NextResponse.json(
                { status: 'closing', step: result.step, errorCode: result.errorCode, supportEmail: ACCOUNT_SUPPORT_EMAIL },
                { status: 202, headers: NO_STORE },
            );
        case 'busy':
            return NextResponse.json(
                { status: 'closing', step: null, errorCode: null, supportEmail: ACCOUNT_SUPPORT_EMAIL },
                { status: 202, headers: NO_STORE },
            );
        case 'reverted':
            return NextResponse.json(
                {
                    status: 'active',
                    code: 'CLOSURE_NOT_COMPLETED',
                    errorCode: result.errorCode,
                    error: REVERTED_MESSAGES[result.errorCode]
                        || 'We couldn’t close your account, and nothing was deleted. Try again.',
                },
                { status: 409, headers: NO_STORE },
            );
        default:
            return NextResponse.json({ error: 'Account closure not found.' }, { status: 404, headers: NO_STORE });
    }
}

export async function GET() {
    try {
        const context = await getAccountSecurityContext({ allowClosing: true });
        const accountId = context.account.id;

        if (context.closureStatus !== 'active') {
            const record = await getAccountClosure(accountId);
            return NextResponse.json({
                status: context.closureStatus,
                step: record?.step ?? null,
                errorCode: record?.last_error_code ?? null,
                supportEmail: ACCOUNT_SUPPORT_EMAIL,
            }, { headers: NO_STORE });
        }

        assertRecentAuth(context.currentSession);
        const limited = await applyRateLimit(context.user.id);
        if (limited) return limited;

        const review = await buildAccountClosureReview({
            accountId,
            email: context.user.primaryEmail!,
            isImpersonation: context.isImpersonation,
        });
        if (!review) {
            return NextResponse.json({ error: 'Account not found.' }, { status: 404, headers: NO_STORE });
        }

        await recordAccountSecurityEvent({
            accountId,
            action: 'closure_review_viewed',
            metadata: { blockerCount: review.blockers.length },
        });
        return NextResponse.json({ status: 'active', review }, { headers: NO_STORE });
    } catch (error) {
        const response = accountSecurityErrorResponse(error);
        if (response) return response;
        console.error('Account closure review failed');
        return NextResponse.json({ error: 'We couldn’t load the closure review. Try again.' }, { status: 500, headers: NO_STORE });
    }
}

export async function POST(request: Request) {
    const tooLarge = enforceMaxRequestBodyBytes(request, MAX_BODY_BYTES);
    if (tooLarge) return tooLarge;

    try {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_ACCOUNT_CLOSURE_REQUEST', 'Invalid account closure request.');
        }
        const body = parsed.data;

        const context = await getAccountSecurityContext({ allowClosing: true });
        const accountId = context.account.id;
        const limited = await applyRateLimit(context.user.id);
        if (limited) return limited;

        if (context.closureStatus === 'closed') {
            return NextResponse.json({ status: 'closed' }, { headers: NO_STORE });
        }
        // Resuming a closure the owner already confirmed needs only their session.
        if (context.closureStatus === 'closing') {
            if (context.isImpersonation) {
                return NextResponse.json(
                    { error: 'A support session can’t change account closure.' },
                    { status: 403, headers: NO_STORE },
                );
            }
            return runResultResponse(await runAccountClosure(accountId));
        }
        if (body.action === 'retry') {
            return NextResponse.json(
                { status: 'active', code: 'NOT_CLOSING', error: 'This account isn’t being closed.' },
                { status: 409, headers: NO_STORE },
            );
        }

        assertRecentAuth(context.currentSession);

        const primaryEmail = context.user.primaryEmail!;
        if (body.confirmationEmail.toLowerCase() !== primaryEmail.trim().toLowerCase()) {
            return NextResponse.json(
                { code: 'CONFIRMATION_MISMATCH', error: 'The email you typed doesn’t match your sign-in email.' },
                { status: 400, headers: NO_STORE },
            );
        }

        const review = await buildAccountClosureReview({
            accountId,
            email: primaryEmail,
            isImpersonation: context.isImpersonation,
        });
        if (!review) {
            return NextResponse.json({ error: 'Account not found.' }, { status: 404, headers: NO_STORE });
        }
        if (!review.eligible) {
            return NextResponse.json(
                {
                    status: 'active',
                    code: 'CLOSURE_BLOCKED',
                    error: 'Resolve the items below before closing your account.',
                    review,
                },
                { status: 409, headers: NO_STORE },
            );
        }

        const transfers = resolveClosureTransfers(review, body.transfers);
        if (!transfers.ok) {
            return NextResponse.json(
                { code: 'INVALID_TRANSFER', error: transfers.error, review },
                { status: 400, headers: NO_STORE },
            );
        }

        // If a concurrent submit already claimed the closure, this run reports
        // that closure's progress (or waits on its lease) instead of starting over.
        await claimAccountClosure({
            accountId,
            transfers: transfers.transfers,
            notifyEmail: primaryEmail,
        });
        return runResultResponse(await runAccountClosure(accountId));
    } catch (error) {
        const response = accountSecurityErrorResponse(error);
        if (response) return response;
        console.error('Account closure request failed');
        return NextResponse.json(
            { error: 'We couldn’t close your account. Try again, or email support if this keeps happening.' },
            { status: 500, headers: NO_STORE },
        );
    }
}
