import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationMemberRole,
    updateOrganizationNotificationSettings,
} from '@/lib/neon/queries';
import { organizationNotificationSettingsBodySchema } from '@/lib/validation/schemas';
import {
    NOTIFY_ADMINS_ON_SUBMISSION,
    normalizeWorkspaceNotificationSettings,
} from '@/lib/notifications/workspace-routing';

export async function PATCH(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        // Authorization and organization isolation come from the authenticated
        // account's active organization, never from client-supplied identifiers.
        const organizationId = account.active_organization_id as string | null;
        if (!organizationId) {
            return NextResponse.json({ error: 'No active organization' }, { status: 404 });
        }

        const actorRole = await getOrganizationMemberRole(organizationId, account.id);
        if (actorRole !== 'admin') {
            return NextResponse.json(
                { error: 'Only organization admins can update workspace notifications' },
                { status: 403 }
            );
        }

        const parsed = organizationNotificationSettingsBodySchema.safeParse(
            await request.json().catch(() => ({}))
        );
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid notification settings' }, { status: 400 });
        }

        // Merge onto the existing settings so future flags are preserved.
        const current = normalizeWorkspaceNotificationSettings(
            (await getOrganizationById(organizationId))?.notification_settings
        );
        const nextSettings = {
            ...current,
            [NOTIFY_ADMINS_ON_SUBMISSION]: parsed.data.notify_admins_on_submission,
        };

        const organization = await updateOrganizationNotificationSettings(organizationId, nextSettings);
        if (!organization) {
            return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 });
        }

        return NextResponse.json({
            notification_settings: normalizeWorkspaceNotificationSettings(organization.notification_settings),
        });
    } catch (error) {
        console.error('Error updating organization notification settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
