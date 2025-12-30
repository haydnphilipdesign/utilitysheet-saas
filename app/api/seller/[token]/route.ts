import { NextResponse } from 'next/server';
import { getRequestByToken, getBrandProfile, getUtilityEntriesByRequestId, getDefaultBrandProfile, getAccountById } from '@/lib/neon/queries';
import { sql } from '@/lib/neon/db';
import type { UtilityEntry } from '@/types';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import { sendTCCompletionNotificationEmail } from '@/lib/email/email-service';

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

        // Fallback to default brand if none assigned to request
        if (!brandProfile) {
            brandProfile = await getDefaultBrandProfile(requestData.account_id, requestData.organization_id ?? undefined);
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
            heating_type = ${body.primary_heating_type || null},
            status = 'submitted',
            last_activity_at = NOW()
            WHERE id = ${requestData.id}
        `;

        // Delete existing entries and insert new ones
        await sql`DELETE FROM utility_entries WHERE request_id = ${requestData.id}`;

        // Insert utility entries
        for (const [category, entry] of Object.entries(body.utilities || {})) {
            const e = entry as {
                entry_mode: string;
                display_name?: string;
                raw_text?: string;
                hidden?: boolean;
                contact_phone?: string;
                contact_url?: string;
                extra?: any
            };
            if (e.entry_mode && !e.hidden) {
                let finalRawText = e.raw_text || '';
                if (e.extra) {
                    const extraParts = [];
                    if (e.extra.tank) extraParts.push(`Tank: ${e.extra.tank}`);
                    if (e.extra.auto_delivery) extraParts.push(`Auto-delivery: ${e.extra.auto_delivery}`);
                    if (e.extra.trash_type) extraParts.push(`Type: ${e.extra.trash_type}`);
                    if (e.extra.notes) extraParts.push(`Notes: ${e.extra.notes}`);
                    if (extraParts.length > 0) {
                        finalRawText = finalRawText ? `${finalRawText} (${extraParts.join(', ')})` : extraParts.join(', ');
                    }
                }

                await sql`
                    INSERT INTO utility_entries (
                        request_id, category, entry_mode, display_name, raw_text, contact_phone, contact_url
                    ) VALUES (
                        ${requestData.id},
                        ${category},
                        ${e.entry_mode},
                        ${e.display_name || null},
                        ${finalRawText || null},
                        ${e.contact_phone || null},
                        ${e.contact_url || null}
                    )
                `;
            }
        }

        // Log event
        await sql`
            INSERT INTO event_logs (request_id, event_type, event_data)
            VALUES (${requestData.id}, 'seller_submitted', ${JSON.stringify(body)})
        `;

        // Send TC notification email
        const account = await getAccountById(requestData.account_id);
        if (account?.email) {
            sendTCCompletionNotificationEmail({
                tcEmail: account.email,
                tcName: account.full_name || undefined,
                propertyAddress: requestData.property_address,
                sellerName: requestData.seller_name || undefined,
                requestId: requestData.id,
            }).catch((error) => {
                // Log but don't fail the request
                console.error('Failed to send TC completion notification email:', error);
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting seller form:', error);
        return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
    }
}
