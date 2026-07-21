import { NextResponse } from 'next/server';
import {
    getOrCreateAccount,
    getRequestById,
    updateRequestConfiguration,
} from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { requestConfigurationBodySchema } from '@/lib/validation/schemas';
import { normalizeAdvancedModuleExclusions, normalizeAdvancedModules } from '@/lib/packet/modules';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';
import { canAccessOwnedOrActiveOrganizationResource, getAuthorizedActiveOrganization } from '@/lib/auth/organization-access';

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

        if (!await canAccessOwnedOrActiveOrganizationResource(account, existing)) {
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
            return invalidRequestBodyResponse();
        }

        const organization = await getAuthorizedActiveOrganization(account);
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
        const nextAdvancedModuleExclusions = parsedBody.data.packetMode === 'advanced'
            ? normalizeAdvancedModuleExclusions(parsedBody.data.advancedModuleExclusions, nextModules)
            : {};

        const updated = await updateRequestConfiguration(id, {
            packetMode: parsedBody.data.packetMode,
            advancedModules: nextModules,
            advancedModuleExclusions: nextAdvancedModuleExclusions,
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
