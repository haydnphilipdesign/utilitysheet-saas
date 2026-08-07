import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import {
    claimReferralCodeForAccount,
    getIntakeLinkByAccountId,
    getReferralClaimState,
    getReferralCreditCountsForAccount,
} from '@/lib/neon/queries';
import { scheduleReferralCreditAward } from '@/lib/referrals/award-referral-credit';
import { stackServerApp } from '@/lib/stack/server';

const claimReferralCodeSchema = z.object({
    code: z.string().trim().toLowerCase().min(3).max(60).regex(/^[a-z0-9-]+$/),
});

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
        'http://localhost:3000'
    );
}

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const intakeLink = await getIntakeLinkByAccountId(activationState.account.id);
        if (!intakeLink) {
            return NextResponse.json({ error: 'Failed to load referral link' }, { status: 500 });
        }

        const [counts, referralAttribution] = await Promise.all([
            getReferralCreditCountsForAccount(activationState.account.id),
            getReferralClaimState(activationState.account.id),
        ]);
        const referralUrl = new URL('/auth/signup', getAppBaseUrl());
        referralUrl.searchParams.set('ref', intakeLink.slug);

        return NextResponse.json({
            referralLink: referralUrl.toString(),
            counts,
            isSubscribed: Boolean(activationState.account.subscription_id),
            referralAttribution,
        });
    } catch (error) {
        console.error('Error fetching referral summary:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = claimReferralCodeSchema.safeParse(
            await request.json().catch(() => null)
        );
        if (!parsed.success) {
            return NextResponse.json({ error: 'Enter a valid referral code.' }, { status: 400 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const result = await claimReferralCodeForAccount(
            activationState.account.id,
            parsed.data.code
        );

        if (result.status === 'claimed' && result.code) {
            scheduleReferralCreditAward(activationState.account.id);
            return NextResponse.json({
                referralAttribution: {
                    code: result.code,
                    canClaim: false,
                    status: 'claimed',
                },
            });
        }

        if (result.status === 'invalid_code') {
            return NextResponse.json(
                { error: 'Referral code not found. Check the code and try again.' },
                { status: 400 }
            );
        }
        if (result.status === 'already_claimed') {
            return NextResponse.json(
                { error: 'A referral code is already attached to this account.' },
                { status: 409 }
            );
        }
        if (result.status === 'expired') {
            return NextResponse.json(
                { error: 'Referral codes can be added within 30 days of signup.' },
                { status: 409 }
            );
        }
        if (result.status === 'account_not_found') {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        return NextResponse.json(
            { error: 'Referral codes are temporarily unavailable.' },
            { status: 503 }
        );
    } catch (error) {
        console.error('Error claiming referral code:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
