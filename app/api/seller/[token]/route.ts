import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken, getDefaultBrandProfile, getAccountById, createEventLog } from '@/lib/neon/queries';
import { sql } from '@/lib/neon/db';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import { hasValidContact, resolveContact } from '@/lib/providers/contact-service';
import { sendTCCompletionNotificationEmail, sendContactResolutionAlertEmail } from '@/lib/email/email-service';
import { formSubmissionRatelimit, checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { sellerSubmissionBodySchema } from '@/lib/validation/schemas';

// GET /api/seller/[token] - Get request data for seller form
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const requestData =
            (await getRequestBySellerToken(token)) ||
            (await getRequestByToken(token));

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Enforce seller-token access when available (prevents packet token from granting write-side access)
        if (requestData.seller_token && requestData.seller_token !== requestData.public_token) {
            if (token !== requestData.seller_token) {
                return NextResponse.json({ error: 'Request not found' }, { status: 404 });
            }
        }

        // Log seller opened + transition status to in_progress on first open
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            null;
        const userAgent = request.headers.get('user-agent') || null;

        await createEventLog({
            requestId: requestData.id,
            eventType: 'seller_opened',
            eventData: { actor: 'seller' },
            ipAddress,
            userAgent,
        });

        if (sql) {
            await sql`
                UPDATE requests
                SET status = 'in_progress', last_activity_at = NOW()
                WHERE id = ${requestData.id}
                AND status = 'sent'
            `;
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

        const publicBrandProfile = brandProfile ? {
            name: brandProfile.name,
            logo_url: brandProfile.logo_url,
            primary_color: brandProfile.primary_color,
            contact_email: brandProfile.contact_email,
            contact_phone: brandProfile.contact_phone,
            contact_website: brandProfile.contact_website,
        } : null;

        // Get AI suggestions for each category
        const utilityCategories =
            (requestData as any).utility_categories ||
            UTILITY_CATEGORY_KEYS;

        const suggestions = await getAllSuggestions(requestData.property_address, utilityCategories);

        return NextResponse.json({
            request: {
                property_address: requestData.property_address,
                utility_categories: utilityCategories,
                status: requestData.status,
            },
            brandProfile: publicBrandProfile,
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

        // Rate limit by token to prevent submission spam
        const rateLimitResult = await checkRateLimit(formSubmissionRatelimit, token);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many submissions. Please wait a moment before trying again.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        const body = await request.json();
        const parsedBody = sellerSubmissionBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: 'Invalid submission', details: parsedBody.error.flatten() },
                { status: 400 }
            );
        }

        const requestData =
            (await getRequestBySellerToken(token)) ||
            (await getRequestByToken(token));

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Enforce seller-token access when available (prevents packet token from granting write-side access)
        if (requestData.seller_token && requestData.seller_token !== requestData.public_token) {
            if (token !== requestData.seller_token) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        if (!sql) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
        }

        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            null;
        const userAgent = request.headers.get('user-agent') || null;

        const requestedCategories = new Set<string>(
            (requestData as any).utility_categories || UTILITY_CATEGORY_KEYS
        );

        // Update request with applicability info
        await sql`
            UPDATE requests SET
            water_source = ${parsedBody.data.water_source || null},
            sewer_type = ${parsedBody.data.sewer_type || null},
            heating_type = ${parsedBody.data.primary_heating_type || null},
            status = 'submitted',
            last_activity_at = NOW()
            WHERE id = ${requestData.id}
        `;

        // Delete existing entries and insert new ones
        await sql`DELETE FROM utility_entries WHERE request_id = ${requestData.id}`;

        // Track entries that need contact resolution
        const contactResolutionTargets: { category: string; providerName: string }[] = [];

        // Insert utility entries
        for (const [category, entry] of Object.entries(parsedBody.data.utilities || {})) {
            if (!requestedCategories.has(category)) {
                continue;
            }

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

                const providerName = String(e.display_name || e.raw_text || '').trim();
                if (providerName && !e.contact_phone && !e.contact_url && e.entry_mode !== 'unknown') {
                    contactResolutionTargets.push({ category, providerName });
                }
            }
        }

        // Attempt contact resolution for missing contact info
        const unresolvedEntries: { category: string; displayName?: string }[] = [];
        const seenContactTargets = new Set<string>();

        for (const target of contactResolutionTargets) {
            const dedupeKey = `${target.category}:${target.providerName.toLowerCase()}`;
            if (seenContactTargets.has(dedupeKey)) continue;
            seenContactTargets.add(dedupeKey);

            const contact = await resolveContact(target.providerName);
            if (hasValidContact(contact)) {
                const resolvedPhone = contact?.customer_service_phone || null;
                const resolvedUrl = contact?.start_stop_service_url || contact?.main_website || null;

                await sql`
                    UPDATE utility_entries
                    SET
                        contact_phone = COALESCE(contact_phone, ${resolvedPhone}),
                        contact_url = COALESCE(contact_url, ${resolvedUrl})
                    WHERE request_id = ${requestData.id}
                    AND category = ${target.category}
                `;
            } else {
                unresolvedEntries.push({
                    category: target.category,
                    displayName: target.providerName,
                });
            }
        }

        // Log event
        await createEventLog({
            requestId: requestData.id,
            eventType: 'seller_submitted',
            eventData: parsedBody.data,
            ipAddress,
            userAgent,
        });

        // Get account and notification preferences
        const account = await getAccountById(requestData.account_id);
        const notificationPrefs = (account?.notification_preferences || {}) as {
            seller_submissions?: boolean;
            contact_resolution?: boolean;
            weekly_summary?: boolean;
        };

        console.log('TC Notification Debug:', {
            accountId: requestData.account_id,
            accountFound: !!account,
            accountEmail: account?.email,
            propertyAddress: requestData.property_address,
            notificationPrefs,
        });

        if (account?.email) {
            // Send TC completion notification (if enabled, defaults to true)
            if (notificationPrefs.seller_submissions !== false) {
                console.log('Sending TC notification email to:', account.email);
                try {
                    const emailResult = await sendTCCompletionNotificationEmail({
                        tcEmail: account.email,
                        tcName: account.full_name || undefined,
                        propertyAddress: requestData.property_address,
                        sellerName: requestData.seller_name || undefined,
                        requestId: requestData.id,
                    });
                    console.log('TC notification email result:', emailResult);
                } catch (emailError) {
                    console.error('Failed to send TC completion notification email:', emailError);
                }
            } else {
                console.log('TC notification skipped: seller_submissions is disabled');
            }

            // Send contact resolution alert (if enabled and there are unresolved entries)
            if (notificationPrefs.contact_resolution !== false && unresolvedEntries.length > 0) {
                console.log('Sending contact resolution alert for unresolved entries:', unresolvedEntries);
                try {
                    const alertResult = await sendContactResolutionAlertEmail({
                        tcEmail: account.email,
                        tcName: account.full_name || undefined,
                        propertyAddress: requestData.property_address,
                        unresolvedEntries,
                        requestId: requestData.id,
                    });
                    console.log('Contact resolution alert result:', alertResult);
                } catch (alertError) {
                    console.error('Failed to send contact resolution alert:', alertError);
                }
            }
        } else {
            console.warn('TC notification skipped: No account email found for account_id:', requestData.account_id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting seller form:', error);
        return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
    }
}

