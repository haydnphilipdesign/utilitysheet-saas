import { NextResponse } from 'next/server';
import { getPacketDataByPublicToken, PACKET_LOCKED_MESSAGE } from '@/lib/packet/packet-data';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const packetResult = await getPacketDataByPublicToken(token);

        if (packetResult.status === 'not_submitted') {
            // The link is valid; the seller simply has not submitted yet.
            return NextResponse.json(
                { error: 'Not submitted yet', state: 'not_submitted' },
                { status: 404 }
            );
        }

        if (packetResult.status === 'not_found') {
            return NextResponse.json(
                { error: 'Request not found', state: 'not_found' },
                { status: 404 }
            );
        }

        if (packetResult.status === 'locked') {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    state: 'locked',
                    message: packetResult.message || PACKET_LOCKED_MESSAGE,
                },
                { status: 402 }
            );
        }

        return NextResponse.json(packetResult.data);
    } catch (error) {
        console.error('Error fetching info sheet data:', error);
        return NextResponse.json({ error: 'Failed to fetch info sheet data' }, { status: 500 });
    }
}
