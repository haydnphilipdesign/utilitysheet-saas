import { NextResponse } from 'next/server';
import { getRequestById, getOrCreateAccount } from '@/lib/neon/queries';
import {
    cancelRequestReopen,
    reopenSubmittedRequest,
    type ReopenOutcome,
} from '@/lib/neon/queries/seller-submission';
import { stackServerApp } from '@/lib/stack/server';
import { canAccessOwnedOrActiveOrganizationResource } from '@/lib/auth/organization-access';
import { reminderRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';

export const runtime = 'nodejs';

/*
 * Reopen a submitted request so the seller can correct it, or close a reopened
 * request without changes. Available on every plan.
 *
 * Neither action reads a request body: the only inputs are the signed-in
 * account and the request id, so nothing about the request (address, owner,
 * workspace, metering, lock) can be supplied by the caller. Neither sends an
 * email; reminding the seller is the separate /remind action.
 */

const REFUSALS: Record<Exclude<ReopenOutcome, 'OK'>, { status: number; message: string }> = {
    NOT_FOUND: { status: 404, message: 'Request not found' },
    TEST_REQUEST: { status: 409, message: 'Test requests cannot be reopened.' },
    LOCKED: { status: 409, message: 'This submission is locked. Upgrade to view it before reopening.' },
    NOT_SUBMITTED: { status: 409, message: 'Only a submitted request can be reopened.' },
    NOT_REOPENED: { status: 409, message: 'This request is not reopened.' },
};

async function handle(
    request: Request,
    params: Promise<{ id: string }>,
    action: typeof reopenSubmittedRequest
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { id } = await params;
        const requestData = await getRequestById(id);
        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Security check: Ensure the request belongs to the user or their organization
        if (!await canAccessOwnedOrActiveOrganizationResource(account, requestData)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const ipAddress = getClientIpOrNull(request);
        const rateLimitResult = await checkRateLimit(
            reminderRatelimit,
            `request-reopen:${account.id}:${id}`,
            { requirePersistent: process.env.NODE_ENV === 'production' }
        );
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json({ error: 'Temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many changes. Please wait a moment before trying again.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const result = await action({
            requestId: id,
            actorAccountId: account.id,
            ipAddress,
            userAgent: request.headers.get('user-agent') || null,
        });

        if (result.outcome !== 'OK' || !result.request) {
            const refusal = REFUSALS[result.outcome === 'OK' ? 'NOT_FOUND' : result.outcome];
            return NextResponse.json({ error: refusal.message, code: result.outcome }, { status: refusal.status });
        }

        return NextResponse.json({
            ...result.request,
            can_edit_submitted_sheet: false,
        });
    } catch (error) {
        console.error('Error changing request reopen state:', error);
        return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }
}

// POST /api/requests/[id]/reopen - let the seller correct a submitted sheet
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return handle(request, params, reopenSubmittedRequest);
}

// DELETE /api/requests/[id]/reopen - close a reopened request without changes
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return handle(request, params, cancelRequestReopen);
}
