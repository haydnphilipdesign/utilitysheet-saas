import { describe, expect, it } from 'vitest';
import { segmentProviderIncidentRecipients } from '@/scripts/incident/provider-incident-recipient-core';

describe('provider incident recipient segmentation', () => {
    it('segments, deduplicates, and excludes without hardcoded customer data', () => {
        const recipients = segmentProviderIncidentRecipients({
            reportingAccountId: 'reporting',
            excludedEmails: ['owner@example.net'],
            excludedDomains: ['utilitysheet.test'],
            candidates: [
                { accountId: 'reporting', email: 'reporting@company.com', fullName: 'Riley Customer', affected: true, paid: true },
                { accountId: 'affected-paid', email: 'paid@company.com', fullName: 'Pat Paid', affected: true, paid: true },
                { accountId: 'goodwill', email: 'good.will+team@gmail.com', fullName: 'Gale Goodwill', affected: false, paid: true },
                { accountId: 'goodwill-duplicate', email: 'goodwill@gmail.com', fullName: 'Duplicate', affected: false, paid: true },
                { accountId: 'affected-free', email: 'free@company.com', fullName: 'Frank Free', affected: true, paid: false },
                { accountId: 'free-unaffected', email: 'none@company.com', fullName: null, affected: false, paid: false },
                { accountId: 'test', email: 'demo@utilitysheet.test', fullName: null, affected: true, paid: true },
            ],
        });

        expect(recipients.map((recipient) => recipient.segment)).toEqual([
            'affected_non_billed',
            'affected_paid',
            'paid_goodwill',
            'reporting_customer',
        ]);
        expect(recipients).toHaveLength(4);
        expect(recipients.some((recipient) => recipient.email === 'none@company.com')).toBe(false);
        expect(recipients.some((recipient) => recipient.email.endsWith('@utilitysheet.test'))).toBe(false);
    });
});
