import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrCreateAccount, setActiveOrganizationForMember } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';

const ACTIVE_ORGANIZATION_MAX_BODY_BYTES = 4 * 1024;

const activeOrganizationSchema = z.object({
    organizationId: z.string().trim().min(1).max(100),
}).strict();

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, ACTIVE_ORGANIZATION_MAX_BODY_BYTES);
        if (payloadTooLarge) return payloadTooLarge;

        const body = await request.json().catch(() => ({}));
        const parsed = activeOrganizationSchema.safeParse(body);
        if (!parsed.success) {
            return invalidRequestBodyResponse(
                'INVALID_ACTIVE_ORGANIZATION',
                'A valid workspace is required'
            );
        }

        const account = await getOrCreateAccount(
            user.id,
            user.primaryEmail || '',
            user.displayName || undefined
        );
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const updated = await setActiveOrganizationForMember(
            account.id,
            parsed.data.organizationId
        );
        if (!updated) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            organizationId: parsed.data.organizationId,
        });
    } catch (error) {
        console.error('Error switching active organization:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
