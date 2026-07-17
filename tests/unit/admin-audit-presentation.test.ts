import { describe, expect, it } from 'vitest';
import {
    buildAuditLogPresentation,
    parseAuditDateFilter,
    sanitizeAuditMetadata,
} from '@/lib/admin/audit-log-presentation';
import type { AdminAuditLogRow } from '@/lib/admin';

function log(overrides: Partial<AdminAuditLogRow> = {}): AdminAuditLogRow {
    return {
        id: 'audit-1',
        admin_id: 'admin-1',
        target_user_id: 'user-1',
        action: 'request_status_changed',
        metadata: {
            reason: 'Corrected after support verification',
            requestId: 'request-1',
            previousStatus: 'sent',
            newStatus: 'in_progress',
            userAgent: 'Mozilla/5.0 Test Browser',
        },
        ip_address: '127.0.0.1',
        created_at: '2026-07-17T14:30:00.000Z',
        admin_email: 'admin@example.com',
        admin_name: 'Admin User',
        target_email: 'customer@example.com',
        target_name: 'Customer User',
        ...overrides,
    };
}

describe('Admin audit presentation', () => {
    it('builds a readable summary, reason, and safe related-record links', () => {
        const presentation = buildAuditLogPresentation(log());

        expect(presentation.label).toBe('Request status changed');
        expect(presentation.summary).toBe('Changed request status from Sent to In progress.');
        expect(presentation.reason).toBe('Corrected after support verification');
        expect(presentation.relatedRecords).toContainEqual({
            href: '/admin/requests/request-1',
            label: 'Request request-1',
        });
        expect(presentation.userAgent).toBe('Mozilla/5.0 Test Browser');
        expect(presentation.metadata).not.toHaveProperty('userAgent');
    });

    it('redacts secret-like values recursively from rendered metadata', () => {
        expect(sanitizeAuditMetadata({
            apiKey: 'secret-value',
            nested: { authorization: 'Bearer private', safe: 'visible' },
        })).toEqual({
            apiKey: '[REDACTED]',
            nested: { authorization: '[REDACTED]', safe: 'visible' },
        });
    });

    it('distinguishes historical published creates from new draft creates', () => {
        const published = buildAuditLogPresentation(log({
            action: 'product_update_created',
            metadata: { title: 'Historical update', is_published: true },
        }));
        const draft = buildAuditLogPresentation(log({
            action: 'product_update_created',
            metadata: { title: 'Draft update', is_published: false },
        }));

        expect(published.label).toBe('Product Update created and published');
        expect(published.summary).toBe('Created and published the Product Update “Historical update”.');
        expect(draft.label).toBe('Product Update draft created');
        expect(draft.summary).toBe('Created the draft Product Update “Draft update”.');
    });

    it('accepts real ISO dates and rejects malformed filters', () => {
        expect(parseAuditDateFilter('2026-07-17')).toBe('2026-07-17');
        expect(parseAuditDateFilter('2026-02-30')).toBeUndefined();
        expect(parseAuditDateFilter('07/17/2026')).toBeUndefined();
        expect(parseAuditDateFilter(undefined)).toBeUndefined();
    });
});
