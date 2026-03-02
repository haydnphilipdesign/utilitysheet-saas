import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrCreateAccount, getAccountOrganizations, updateAccount, getMonthlyUsage } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';

const ACCOUNT_UPDATE_MAX_BODY_BYTES = 16 * 1024;

const accountUpdateSchema = z.object({
    full_name: z.string().trim().max(120).optional(),
    notification_preferences: z
        .record(z.string(), z.boolean())
        .refine((value) => Object.keys(value).length <= 40, 'Too many notification keys')
        .optional(),
}).refine((value) => value.full_name !== undefined || value.notification_preferences !== undefined, {
    message: 'No updates provided',
});

type OrganizationSummary = { id: string };

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

        const organizations = await getAccountOrganizations(account.id) as OrganizationSummary[];
        const activeOrg = organizations.find((o) => o.id === account.active_organization_id);

        // Get monthly usage for the current billing period
        const usage = await getMonthlyUsage(account.id, activeOrg?.id);

        return NextResponse.json({
            account,
            organizations,
            activeOrganization: activeOrg || null,
            usage
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

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, ACCOUNT_UPDATE_MAX_BODY_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const body = await request.json().catch(() => ({}));
        const parsed = accountUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_ACCOUNT_UPDATE', 'Invalid account update payload');
        }
        const { full_name, notification_preferences } = parsed.data;

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
