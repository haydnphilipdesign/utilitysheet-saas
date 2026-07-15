import { NextResponse } from 'next/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { getOrCreateIntakeLink, getReferralCreditsForAccount } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

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

        const intakeLink = await getOrCreateIntakeLink(activationState.account.id);
        if (!intakeLink) {
            return NextResponse.json({ error: 'Failed to load referral link' }, { status: 500 });
        }

        const credits = await getReferralCreditsForAccount(activationState.account.id);
        const referralUrl = new URL('/auth/signup', getAppBaseUrl());
        referralUrl.searchParams.set('ref', intakeLink.slug);

        return NextResponse.json({
            referralLink: referralUrl.toString(),
            counts: {
                earned: credits.filter((credit) => credit.status === 'earned').length,
                applied: credits.filter((credit) => credit.status === 'applied').length,
            },
        });
    } catch (error) {
        console.error('Error fetching referral summary:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
