'use server';

import { sendSellerReminderEmail } from '@/lib/email/email-service';
import { sql } from '@/lib/neon/db';
import { createEventLog, getBrandProfile, getRequestById, updateRequestStatus } from '@/lib/neon/queries';
import {
    assertAdminActionReason,
    assertAdminWritesEnabled,
    createAuditLogWithContext,
    getRequestContext,
    requireAdmin,
} from '@/lib/admin';
import type { RequestStatus } from '@/types';

export async function updateRequestStatusAdminAction(requestId: string, status: RequestStatus, reason: string) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        const before = await getRequestById(requestId, { includeDeleted: true });
        if (!before) {
            return { success: false, error: 'Request not found' };
        }

        const previousStatus = before.status;
        const updated = await updateRequestStatus(requestId, status);
        if (!updated) {
            return { success: false, error: 'Failed to update request status' };
        }

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: before.account_id,
            action: 'request_status_changed',
            metadata: {
                reason,
                requestId,
                previousStatus,
                newStatus: status,
                propertyAddress: before.property_address,
            },
        });

        const { ipAddress, userAgent } = await getRequestContext();
        await createEventLog({
            requestId,
            eventType: 'admin_request_status_changed',
            eventData: {
                actor: 'admin',
                adminId: account.id,
                previousStatus,
                newStatus: status,
                reason,
            },
            ipAddress,
            userAgent,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function updateRequestSellerAdminAction(
    requestId: string,
    data: { sellerName?: string; sellerEmail?: string; sellerPhone?: string },
    reason: string
) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        if (!sql) {
            return { success: false, error: 'Database not configured' };
        }

        const before = await getRequestById(requestId, { includeDeleted: true });
        if (!before) {
            return { success: false, error: 'Request not found' };
        }

        const sellerName = data.sellerName?.trim() || null;
        const sellerEmail = data.sellerEmail?.trim() || null;
        const sellerPhone = data.sellerPhone?.trim() || null;

        const result = await sql`
            UPDATE requests
            SET
                seller_name = ${sellerName},
                seller_email = ${sellerEmail},
                seller_phone = ${sellerPhone},
                last_activity_at = NOW()
            WHERE id = ${requestId}
            RETURNING *
        `;

        const after = result[0];
        if (!after) {
            return { success: false, error: 'Failed to update request' };
        }

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: before.account_id,
            action: 'request_seller_updated',
            metadata: {
                reason,
                requestId,
                before: {
                    seller_name: before.seller_name,
                    seller_email: before.seller_email,
                    seller_phone: before.seller_phone,
                },
                after: {
                    seller_name: after.seller_name,
                    seller_email: after.seller_email,
                    seller_phone: after.seller_phone,
                },
                propertyAddress: before.property_address,
            },
        });

        const { ipAddress, userAgent } = await getRequestContext();
        await createEventLog({
            requestId,
            eventType: 'admin_request_seller_updated',
            eventData: {
                actor: 'admin',
                adminId: account.id,
                reason,
            },
            ipAddress,
            userAgent,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function sendSellerReminderAdminAction(requestId: string, reason: string) {
    try {
        const { account, user } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(reason);

        const requestData = await getRequestById(requestId, { includeDeleted: true });
        if (!requestData) {
            return { success: false, error: 'Request not found' };
        }

        if (!requestData.seller_email) {
            return { success: false, error: 'Seller email is required to send a reminder' };
        }

        let agentName: string | undefined;
        let brandProfile = null;
        if (requestData.brand_profile_id) {
            brandProfile = await getBrandProfile(requestData.brand_profile_id);
            agentName = brandProfile?.contact_name || undefined;
        }

        if (!agentName) {
            agentName = account.full_name || user.displayName || account.email;
        }

        const result = await sendSellerReminderEmail({
            sellerEmail: requestData.seller_email,
            sellerName: requestData.seller_name || undefined,
            propertyAddress: requestData.property_address,
            closingDate: requestData.closing_date || undefined,
            agentName,
            brandProfile: brandProfile || undefined,
            sellerToken: requestData.seller_token || requestData.public_token,
        });

        if (!result.success) {
            return { success: false, error: result.error || 'Failed to send reminder' };
        }

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: requestData.account_id,
            action: 'request_reminder_sent',
            metadata: {
                reason,
                requestId,
                sellerEmail: requestData.seller_email,
                propertyAddress: requestData.property_address,
            },
        });

        const { ipAddress, userAgent } = await getRequestContext();
        await createEventLog({
            requestId,
            eventType: 'reminder_sent',
            eventData: {
                actor: 'admin',
                channel: 'email',
                adminId: account.id,
                reason,
            },
            ipAddress,
            userAgent,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
