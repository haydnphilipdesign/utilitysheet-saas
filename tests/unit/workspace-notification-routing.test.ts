import { describe, expect, it } from 'vitest';

import {
    NOTIFY_ADMINS_ON_SUBMISSION,
    buildSubmissionRecipients,
    normalizeWorkspaceNotificationSettings,
} from '@/lib/notifications/workspace-routing';

describe('normalizeWorkspaceNotificationSettings', () => {
    it('defaults routing off for missing, empty, or invalid input', () => {
        for (const raw of [null, undefined, {}, [], 42, 'not json', '"true"']) {
            expect(normalizeWorkspaceNotificationSettings(raw)).toEqual({
                [NOTIFY_ADMINS_ON_SUBMISSION]: false,
            });
        }
    });

    it('reads the flag from an object', () => {
        expect(normalizeWorkspaceNotificationSettings({ notify_admins_on_submission: true })).toEqual({
            [NOTIFY_ADMINS_ON_SUBMISSION]: true,
        });
    });

    it('parses the flag from a JSON string column', () => {
        expect(
            normalizeWorkspaceNotificationSettings('{"notify_admins_on_submission":true}')
        ).toEqual({ [NOTIFY_ADMINS_ON_SUBMISSION]: true });
    });

    it('only treats a strict boolean true as enabled', () => {
        expect(
            normalizeWorkspaceNotificationSettings({ notify_admins_on_submission: 'true' })
        ).toEqual({ [NOTIFY_ADMINS_ON_SUBMISSION]: false });
    });
});

describe('buildSubmissionRecipients', () => {
    it('returns the owner alone when there are no other candidates', () => {
        const recipients = buildSubmissionRecipients(
            [{ email: 'owner@example.com', name: 'Owner', prefs: {} }],
            { accessLocked: false }
        );

        expect(recipients).toEqual([
            { email: 'owner@example.com', name: 'Owner', attachPdf: true },
        ]);
    });

    it('appends admins and de-duplicates the owner who is also an admin', () => {
        const recipients = buildSubmissionRecipients(
            [
                { email: 'owner@example.com', name: 'Owner', prefs: {} },
                { email: 'Owner@example.com', name: 'Owner (admin row)', prefs: {} },
                { email: 'admin2@example.com', name: 'Second Admin', prefs: {} },
            ],
            { accessLocked: false }
        );

        expect(recipients.map((r) => r.email)).toEqual([
            'owner@example.com',
            'admin2@example.com',
        ]);
    });

    it('skips candidates who disabled seller submissions personally', () => {
        const recipients = buildSubmissionRecipients(
            [
                { email: 'owner@example.com', prefs: {} },
                { email: 'optedout@example.com', prefs: { seller_submissions: false } },
            ],
            { accessLocked: false }
        );

        expect(recipients.map((r) => r.email)).toEqual(['owner@example.com']);
    });

    it('skips candidates without a usable email', () => {
        const recipients = buildSubmissionRecipients(
            [
                { email: null, prefs: {} },
                { email: '   ', prefs: {} },
                { email: 'ok@example.com', prefs: {} },
            ],
            { accessLocked: false }
        );

        expect(recipients.map((r) => r.email)).toEqual(['ok@example.com']);
    });

    it('honors each recipient personal PDF preference', () => {
        const recipients = buildSubmissionRecipients(
            [
                { email: 'a@example.com', prefs: { seller_submission_pdf_attachment: true } },
                { email: 'b@example.com', prefs: { seller_submission_pdf_attachment: false } },
            ],
            { accessLocked: false }
        );

        expect(recipients).toEqual([
            { email: 'a@example.com', name: undefined, attachPdf: true },
            { email: 'b@example.com', name: undefined, attachPdf: false },
        ]);
    });

    it('never attaches a PDF when the request is access-locked', () => {
        const recipients = buildSubmissionRecipients(
            [{ email: 'a@example.com', prefs: { seller_submission_pdf_attachment: true } }],
            { accessLocked: true }
        );

        expect(recipients[0].attachPdf).toBe(false);
    });
});
