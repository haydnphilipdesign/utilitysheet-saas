import { describe, expect, it } from 'vitest';
import { buildProviderIncidentEmail } from '@/lib/email/provider-incident-update';

describe('provider incident customer email', () => {
    it('renders an affected paid apology without overclaiming review completion', () => {
        const email = buildProviderIncidentEmail({
            segment: 'affected_paid',
            firstName: 'Taylor',
            state: {
                hotfixDeployed: true,
                creditApplied: true,
                reviewComplete: false,
            },
        });

        expect(email.subject).toMatch(/apology/i);
        expect(email.text).toContain('one-month credit');
        expect(email.text).toContain('I am reviewing');
        expect(email.text).not.toContain('Gemini');
        expect(email.text).not.toContain('all affected sheets');
    });

    it('never promises a credit to an affected non-billed account', () => {
        const email = buildProviderIncidentEmail({
            segment: 'affected_non_billed',
            firstName: null,
            state: {
                hotfixDeployed: true,
                creditApplied: true,
                reviewComplete: false,
            },
        });

        expect(email.text).not.toMatch(/credit|invoice/i);
    });

    it('uses state-dependent credit and resolution language', () => {
        const pending = buildProviderIncidentEmail({
            segment: 'reporting_customer',
            firstName: 'Taylor',
            state: {
                hotfixDeployed: false,
                creditApplied: false,
                reviewComplete: false,
            },
        });

        expect(pending.text).toContain('I will apply');
        expect(pending.text).not.toContain('I applied a one-month credit');
        expect(pending.text).toContain('while I finish validating');
    });

    it('escapes the greeting in HTML and includes no customer identifiers', () => {
        const email = buildProviderIncidentEmail({
            segment: 'reporting_customer',
            firstName: '<script>alert(1)</script>',
            state: {
                hotfixDeployed: true,
                creditApplied: true,
                reviewComplete: true,
            },
        });

        expect(email.html).not.toContain('<script>');
        expect(email.html).toContain('&lt;script&gt;');
        expect(email.text).not.toMatch(/account_id|request_id|property_address/i);
    });
});
