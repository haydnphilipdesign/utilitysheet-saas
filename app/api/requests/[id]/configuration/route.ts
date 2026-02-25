import { NextResponse } from 'next/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getRequestById,
    updateRequestConfiguration,
} from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { requestConfigurationBodySchema } from '@/lib/validation/schemas';
import { normalizeAdvancedModules } from '@/lib/packet/modules';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
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
        const existing = await getRequestById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (existing.account_id !== account.id && existing.organization_id !== account.active_organization_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!['draft', 'sent'].includes(existing.status)) {
            return NextResponse.json(
                { error: 'Configuration locked', message: 'Mode can only be changed before seller opens the request.' },
                { status: 409 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsedBody = requestConfigurationBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsedBody.error.flatten() },
                { status: 400 }
            );
        }

        const organization = account.active_organization_id
            ? await getOrganizationById(account.active_organization_id)
            : null;
        const isPaid = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

        if (parsedBody.data.packetMode === 'advanced' && !isPaid) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Advanced Utility Packets are available on Pro and Teams.',
                },
                { status: 403 }
            );
        }

        const nextModules = parsedBody.data.packetMode === 'advanced'
            ? normalizeAdvancedModules(parsedBody.data.advancedModules)
            : [];

        const updated = await updateRequestConfiguration(id, {
            packetMode: parsedBody.data.packetMode,
            advancedModules: nextModules,
        });

        if (!updated) {
            return NextResponse.json(
                { error: 'Configuration locked', message: 'Mode can only be changed before seller opens the request.' },
                { status: 409 }
            );
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating request configuration:', error);
        return NextResponse.json({ error: 'Failed to update request configuration' }, { status: 500 });
    }
}
