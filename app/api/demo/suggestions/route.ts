import { NextResponse } from 'next/server';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import { UtilityCategory } from '@/types';

// Public API endpoint for demo - fetches AI suggestions for any address
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { address } = body;

        if (!address || typeof address !== 'string' || address.length < 10) {
            return NextResponse.json(
                { error: 'Please provide a valid address' },
                { status: 400 }
            );
        }

        // Default categories for demo
        const categories: UtilityCategory[] = ['electric', 'gas', 'water', 'sewer', 'trash', 'internet', 'cable', 'propane'];

        // Fetch real AI suggestions
        const suggestions = await getAllSuggestions(address, categories);

        return NextResponse.json({ suggestions });
    } catch (error) {
        console.error('Demo suggestions error:', error);
        return NextResponse.json(
            { error: 'Failed to get suggestions' },
            { status: 500 }
        );
    }
}
