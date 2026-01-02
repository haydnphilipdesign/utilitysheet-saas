import { NextResponse } from 'next/server';
import { getRequestById, updateRequestStatus, getOrCreateAccount, deleteRequest } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

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

        return NextResponse.json(requestData);
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

        const body = await request.json();

        if (body.status) {
            const updated = await updateRequestStatus(id, body.status);
            if (!updated) {
                return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
            }
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
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
