import { NextResponse } from 'next/server';
import { searchProviders } from '@/lib/providers/suggestion-service';
import { UtilityCategory } from '@/types';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const category = searchParams.get('category') as UtilityCategory | null;
    const address = searchParams.get('address');

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const results = await searchProviders(query, category || undefined, address || undefined);
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error searching providers:', error);
        return NextResponse.json({ error: 'Failed to search providers' }, { status: 500 });
    }
}
