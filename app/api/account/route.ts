import { NextResponse } from 'next/server';
import { getOrCreateAccount, getAccountOrganizations, updateAccount } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = organizations.find((o: any) => o.id === account.active_organization_id);

        return NextResponse.json({
            account,
            organizations,
            activeOrganization: activeOrg || null
        });
    } catch (error) {
        console.error('Error fetching account:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { full_name, notification_preferences } = body;

        // Get the account ID first
        const account = await getOrCreateAccount(user.id, user.primaryEmail!);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const updatedAccount = await updateAccount(account.id, {
            fullName: full_name,
            notificationPreferences: notification_preferences
        });

        return NextResponse.json({ account: updatedAccount });
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
