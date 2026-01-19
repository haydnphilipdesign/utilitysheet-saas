import { NextResponse } from 'next/server';
import { getBrandProfile, updateBrandProfile, deleteBrandProfile, getOrCreateAccount } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { brandProfileUpdateBodySchema } from '@/lib/validation/schemas';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const profile = await getBrandProfile(id);

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // Verify ownership
        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (profile.organization_id) {
            if (profile.organization_id !== account.active_organization_id) {
                return NextResponse.json({ error: 'Unauthorized access to organization profile' }, { status: 403 });
            }
        } else {
            if (profile.account_id !== account.id) {
                return NextResponse.json({ error: 'Unauthorized access to account profile' }, { status: 403 });
            }
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Error fetching brand profile:', error);
        return NextResponse.json({ error: 'Failed to fetch brand profile' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const parsedBody = brandProfileUpdateBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsedBody.error.flatten() },
                { status: 400 }
            );
        }
        const payload = parsedBody.data;

        // Verify ownership first
        const { id } = await params;
        const profile = await getBrandProfile(id);
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (profile.organization_id) {
            if (profile.organization_id !== account.active_organization_id) {
                return NextResponse.json({ error: 'Unauthorized access to organization profile' }, { status: 403 });
            }
        } else {
            if (profile.account_id !== account.id) {
                return NextResponse.json({ error: 'Unauthorized access to account profile' }, { status: 403 });
            }
        }

        const isPro = account.subscription_status === 'pro';

        const updatedProfile = await updateBrandProfile(id, {
            name: payload.name,
            logo_url: payload.logo_url,
            primary_color: payload.primary_color,
            secondary_color: payload.secondary_color,
            contact_name: payload.contact_name,
            contact_phone: payload.contact_phone,
            contact_email: payload.contact_email,
            contact_website: payload.contact_website,
            disclaimer_text: payload.disclaimer_text,
            ...(isPro ? { is_default: payload.is_default } : {}),
            // Advanced customization (Pro only)
            ...(isPro ? {
                buyer_next_steps: payload.buyer_next_steps,
                next_steps_title: payload.next_steps_title,
                show_powered_by: payload.show_powered_by,
                show_generation_date: payload.show_generation_date,
                welcome_message: payload.welcome_message,
            } : {}),
            // Pass context for default handling
            accountId: account.id,
            organizationId: account.active_organization_id || undefined
        });

        if (!updatedProfile) {
            return NextResponse.json({ error: 'Failed to update brand profile' }, { status: 500 });
        }

        return NextResponse.json(updatedProfile);
    } catch (error) {
        console.error('Error updating brand profile:', error);
        return NextResponse.json({ error: 'Failed to update brand profile' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const { id } = await params;
        const profile = await getBrandProfile(id);
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (profile.organization_id) {
            if (profile.organization_id !== account.active_organization_id) {
                return NextResponse.json({ error: 'Unauthorized access to organization profile' }, { status: 403 });
            }
        } else {
            if (profile.account_id !== account.id) {
                return NextResponse.json({ error: 'Unauthorized access to account profile' }, { status: 403 });
            }
        }

        if (account.subscription_status !== 'pro') {
            return NextResponse.json({
                error: 'Custom branding is available on the Pro plan',
                code: 'UPGRADE_REQUIRED'
            }, { status: 403 });
        }

        const success = await deleteBrandProfile(id);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete brand profile' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting brand profile:', error);
        return NextResponse.json({ error: 'Failed to delete brand profile' }, { status: 500 });
    }
}
