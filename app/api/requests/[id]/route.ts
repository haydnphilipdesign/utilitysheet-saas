import { NextResponse } from 'next/server';
import { getRequestById, updateRequestStatus } from '@/lib/neon/queries';

// GET /api/requests/[id] - Get a single request
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const requestData = await getRequestById(id);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
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
        const { id } = await params;
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
