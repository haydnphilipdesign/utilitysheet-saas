import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestById, updateRequestStatus, getOrCreateAccount, deleteRequest, getOrganizationById } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';

const REQUEST_UPDATE_MAX_BODY_BYTES = 8 * 1024;

const requestUpdateBodySchema = z.object({
    status: z.enum(['draft', 'sent', 'in_progress', 'submitted']),
});

function sanitizeLockedRequest<T extends Record<string, unknown>>(r: T) {
    return {
        ...r,
        is_locked: true,
        property_address: 'Locked — upgrade to view',
        property_address_structured: null,
        seller_name: null,
        seller_email: null,
        seller_phone: null,
        public_token: '',
        seller_token: null,
        utility_entries: undefined,
    };
}

// GET /api/requests/[id] - Get a single request
export async function GET(
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
        const requestData = await getRequestById(id);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Security check: Ensure the request belongs to the user or their organization
        if (requestData.account_id !== account.id && requestData.organization_id !== account.active_organization_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const organizationId = account.active_organization_id;
        const organization = organizationId ? await getOrganizationById(organizationId) : null;
        const isPaid = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

        const row = requestData as unknown as Record<string, unknown> & { is_locked?: unknown };
        const accessLocked = Boolean(row.is_locked) && !isPaid;
        if (!accessLocked) {
            return NextResponse.json({ ...row, is_locked: false });
        }

        return NextResponse.json(sanitizeLockedRequest(row));
    } catch (error) {
        console.error('Error fetching request:', error);
        return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 });
    }
}

// PATCH /api/requests/[id] - Update a request
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
        const requestData = await getRequestById(id);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Security check: Ensure the request belongs to the user or their organization
        if (requestData.account_id !== account.id && requestData.organization_id !== account.active_organization_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, REQUEST_UPDATE_MAX_BODY_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const body = await request.json().catch(() => ({}));
        const parsedBody = requestUpdateBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse('INVALID_REQUEST_UPDATE', 'Invalid request update payload');
        }

        const updated = await updateRequestStatus(id, parsedBody.data.status);
        if (!updated) {
            return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating request:', error);
        return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }
}


// DELETE /api/requests/[id] - Delete a request
export async function DELETE(
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
        const requestData = await getRequestById(id);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Security check: Ensure the request belongs to the user or their organization
        if (requestData.account_id !== account.id && requestData.organization_id !== account.active_organization_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const success = await deleteRequest(id);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting request:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
