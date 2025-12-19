import { NextResponse } from 'next/server';
import { getBrandProfile, updateBrandProfile, deleteBrandProfile, getOrCreateAccount } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const profile = await getBrandProfile(params.id);

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
    { params }: { params: { id: string } }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Verify ownership first
        const profile = await getBrandProfile(params.id);
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

        const updatedProfile = await updateBrandProfile(params.id, {
            name: body.name,
            primary_color: body.primary_color,
            secondary_color: body.secondary_color,
            contact_name: body.contact_name,
            contact_phone: body.contact_phone,
            contact_email: body.contact_email,
            contact_website: body.contact_website,
            disclaimer_text: body.disclaimer_text,
            is_default: body.is_default,
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
    { params }: { params: { id: string } }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const profile = await getBrandProfile(params.id);
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

        const success = await deleteBrandProfile(params.id);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete brand profile' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting brand profile:', error);
        return NextResponse.json({ error: 'Failed to delete brand profile' }, { status: 500 });
    }
}
