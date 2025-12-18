import { NextResponse } from 'next/server';
import { getOrCreateAccount, getAccountOrganizations } from '@/lib/neon/queries';

export async function GET() {
    try {
        // TODO: Get real auth session
        const account = await getOrCreateAccount('demo-user', 'demo@utilitysheet.com', 'Demo User');
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
