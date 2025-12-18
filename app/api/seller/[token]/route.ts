import { NextResponse } from 'next/server';
import { getRequestByToken } from '@/lib/neon/queries';
import { sql } from '@/lib/neon/db';
import type { UtilityEntry } from '@/types';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';

// GET /api/seller/[token] - Get request data for seller form
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const requestData = await getRequestByToken(token);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Get associated brand profile if exists
        let brandProfile = null;
        if (requestData.brand_profile_id && sql) {
            const result = await sql`
        SELECT * FROM brand_profiles WHERE id = ${requestData.brand_profile_id}
      `;
            brandProfile = result[0] || null;
        }

        // Get existing utility entries
        let utilityEntries: UtilityEntry[] = [];
        if (sql) {
            const entries = await sql`
        SELECT * FROM utility_entries WHERE request_id = ${requestData.id}
      `;
            utilityEntries = entries as UtilityEntry[];
        }

        // Get AI suggestions for each category
        const suggestions = await getAllSuggestions(
            requestData.property_address,
            (requestData as any).utility_categories || ['electric', 'gas', 'water', 'sewer', 'trash']
        );

        return NextResponse.json({
            request: requestData,
            brandProfile,
            utilityEntries,
            suggestions,
        });
    } catch (error) {
        console.error('Error fetching seller data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST /api/seller/[token] - Submit seller form
export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const body = await request.json();

        const requestData = await getRequestByToken(token);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (!sql) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
        }

        // Update request with applicability info
        await sql`
      UPDATE requests SET
        water_source = ${body.water_source || null},
        sewer_type = ${body.sewer_type || null},
        heating_type = ${body.heating_type || null},
        status = 'submitted',
        last_activity_at = NOW()
      WHERE id = ${requestData.id}
    `;

        // Delete existing entries and insert new ones
        await sql`DELETE FROM utility_entries WHERE request_id = ${requestData.id}`;

        // Insert utility entries
        for (const [category, entry] of Object.entries(body.utilities || {})) {
            const e = entry as { entry_mode: string; display_name?: string; raw_text?: string };
            if (e.entry_mode) {
                await sql`
          INSERT INTO utility_entries (
            request_id, category, entry_mode, display_name, raw_text
          ) VALUES (
            ${requestData.id},
            ${category},
            ${e.entry_mode},
            ${e.display_name || null},
            ${e.raw_text || null}
          )
        `;
            }
        }

        // Log event
        await sql`
      INSERT INTO event_logs (request_id, event_type, event_data)
      VALUES (${requestData.id}, 'seller_submitted', ${JSON.stringify(body)})
    `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting seller form:', error);
        return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
    }
}
