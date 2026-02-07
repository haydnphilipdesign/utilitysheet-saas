import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        {
            error: 'This endpoint is deprecated. Use /api/seller/[token]/suggestions/search instead.',
        },
        { status: 403 }
    );
}
