import { NextResponse } from 'next/server';
import { getRequestById, getOrCreateAccount, getBrandProfile } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { sendSellerReminderEmail } from '@/lib/email/email-service';

export async function POST(
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

        const { id: requestId } = await params;
        const requestData = await getRequestById(requestId);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Security check: Ensure the request belongs to the user or their organization
        if (requestData.account_id !== account.id && requestData.organization_id !== account.active_organization_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!requestData.seller_email) {
            return NextResponse.json({ error: 'Seller email is required to send a reminder' }, { status: 400 });
        }

        // Get agent name for the email
        let agentName: string | undefined;
        if (requestData.brand_profile_id) {
            const brandProfile = await getBrandProfile(requestData.brand_profile_id);
            agentName = brandProfile?.contact_name || undefined;
        }

        if (!agentName) {
            agentName = account.full_name || user.displayName || undefined;
        }

        const result = await sendSellerReminderEmail({
            sellerEmail: requestData.seller_email,
            sellerName: requestData.seller_name || undefined,
            propertyAddress: requestData.property_address,
            closingDate: requestData.closing_date || undefined,
            agentName,
            publicToken: requestData.public_token,
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send reminder' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending reminder:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
