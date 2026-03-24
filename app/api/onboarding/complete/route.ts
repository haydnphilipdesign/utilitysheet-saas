import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { setOnboardingCompleted } from '@/lib/neon/queries';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';

export async function POST() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState?.account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const { account } = activationState;

        const updatedAccount = await setOnboardingCompleted(account.id);
        if (!updatedAccount) {
            return NextResponse.json({ error: 'Failed to mark onboarding complete' }, { status: 500 });
        }

        return NextResponse.json({ account: updatedAccount }, { status: 200 });
    } catch (error) {
        console.error('Error marking onboarding complete:', error);
        return NextResponse.json({ error: 'Failed to mark onboarding complete' }, { status: 500 });
    }
}
