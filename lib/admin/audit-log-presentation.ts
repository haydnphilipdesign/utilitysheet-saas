import type { AdminAuditLogRow } from '@/lib/admin';

type RelatedRecord = {
    href: string;
    label: string;
};

export type AuditLogPresentation = {
    label: string;
    summary: string;
    reason: string | null;
    relatedRecords: RelatedRecord[];
    metadata: Record<string, unknown>;
    userAgent: string | null;
};

const actionLabels: Record<string, string> = {
    impersonation_started: 'Impersonation started',
    impersonation_ended: 'Impersonation ended',
    user_banned: 'User banned',
    user_unbanned: 'User unbanned',
    role_changed: 'User role changed',
    plan_changed: 'Entitlement changed',
    request_status_changed: 'Request status changed',
    request_seller_updated: 'Seller information updated',
    request_reminder_sent: 'Seller reminder sent',
    testimonial_request_sent: 'Testimonial request sent',
    testimonial_test_sent: 'Testimonial test sent',
    user_updated: 'User updated',
    product_update_created: 'Product Update created',
    product_update_published: 'Product Update published',
    product_update_deleted: 'Product Update deleted',
};

export function getAuditActionLabel(action: string) {
    return actionLabels[action] || titleCase(action);
}

const secretKeyPattern = /(authorization|cookie|credential|password|secret|token|api[_-]?key|private[_-]?key)/i;

function titleCase(value: unknown) {
    const text = String(value || '').replace(/_/g, ' ').trim();
    if (!text) return 'Unknown';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function metadataString(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function shortId(value: string) {
    return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export function sanitizeAuditMetadata(value: unknown, key = ''): unknown {
    if (key && secretKeyPattern.test(key)) return '[REDACTED]';
    if (Array.isArray(value)) return value.map((item) => sanitizeAuditMetadata(item));
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
                entryKey,
                sanitizeAuditMetadata(entryValue, entryKey),
            ])
        );
    }
    return value;
}

export function parseAuditDateFilter(value: string | undefined): string | undefined {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        return undefined;
    }
    return value;
}

function buildSummary(action: string, metadata: Record<string, unknown>) {
    const title = metadataString(metadata, 'title');
    switch (action) {
        case 'request_status_changed':
            return `Changed request status from ${titleCase(metadata.previousStatus)} to ${titleCase(metadata.newStatus)}.`;
        case 'request_seller_updated':
            return 'Updated seller contact information for a request.';
        case 'request_reminder_sent':
            return 'Sent a seller reminder for a request.';
        case 'testimonial_request_sent':
            return metadata.result === 'dry_run'
                ? 'Recorded a dry run of testimonial outreach; no email was sent.'
                : metadata.result === 'failed'
                    ? 'Attempted testimonial outreach, but the send failed.'
                    : 'Sent a testimonial request to a selected customer.';
        case 'testimonial_test_sent':
            return metadata.result === 'dry_run'
                ? 'Recorded a dry run of the testimonial test email.'
                : 'Sent a testimonial test email to the Admin inbox.';
        case 'product_update_created':
            return metadata.is_published === true
                ? `Created and published the Product Update${title ? ` “${title}”` : ''}.`
                : `Created the draft Product Update${title ? ` “${title}”` : ''}.`;
        case 'product_update_published':
            return `Published the Product Update${title ? ` “${title}”` : ''}.`;
        case 'product_update_deleted':
            return `Deleted the Product Update${title ? ` “${title}”` : ''}.`;
        case 'role_changed':
            return `Changed user role from ${titleCase(metadata.previousRole)} to ${titleCase(metadata.newRole)}.`;
        case 'plan_changed':
            return `Changed account entitlement from ${titleCase(metadata.previousPlan)} to ${titleCase(metadata.newPlan)}.`;
        case 'user_banned':
            return metadata.blocked ? 'Blocked an attempted user ban.' : 'Banned a user account.';
        case 'user_unbanned':
            return metadata.blocked ? 'Blocked an attempted user unban.' : 'Restored access to a banned user account.';
        default:
            return `${actionLabels[action] || titleCase(action)}.`;
    }
}

export function buildAuditLogPresentation(log: AdminAuditLogRow): AuditLogPresentation {
    const rawMetadata = log.metadata || {};
    const reason = metadataString(rawMetadata, 'reason');
    const userAgent = metadataString(rawMetadata, 'userAgent');
    const requestId = metadataString(rawMetadata, 'requestId');
    const updateId = metadataString(rawMetadata, 'updateId');
    const sanitized = sanitizeAuditMetadata(rawMetadata) as Record<string, unknown>;
    const metadata = Object.fromEntries(
        Object.entries(sanitized).filter(([key]) => key !== 'reason' && key !== 'userAgent')
    );
    const relatedRecords: RelatedRecord[] = [];

    if (requestId) {
        relatedRecords.push({ href: `/admin/requests/${requestId}`, label: `Request ${shortId(requestId)}` });
    }
    if (updateId) {
        relatedRecords.push({ href: '/admin/updates', label: 'Product Updates' });
    }
    if (log.target_user_id) {
        relatedRecords.push({
            href: `/admin/users/${log.target_user_id}`,
            label: log.target_name || log.target_email || `User ${shortId(log.target_user_id)}`,
        });
    }

    return {
        label: log.action === 'product_update_created'
            ? rawMetadata.is_published === true
                ? 'Product Update created and published'
                : 'Product Update draft created'
            : getAuditActionLabel(log.action),
        summary: buildSummary(log.action, rawMetadata),
        reason,
        relatedRecords,
        metadata,
        userAgent,
    };
}
