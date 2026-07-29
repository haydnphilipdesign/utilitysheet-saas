import { describe, expect, it } from 'vitest';
import {
    classifyIncidentEntry,
    renderIncidentReviewHtml,
    type IncidentEntry,
    type IncidentReport,
} from '@/scripts/incident/provider-resolution-core';

const entry: IncidentEntry = {
    entryId: '00000000-0000-0000-0000-000000000001',
    requestId: '00000000-0000-0000-0000-000000000002',
    propertyAddress: '123 Main St, Raleigh, NC 27601',
    category: 'electric',
    entryMode: 'free_text',
    providerName: 'Duke Energy',
    contactPhone: null,
    contactUrl: null,
    updatedAt: '2026-07-25T12:00:00.000Z',
};

const acceptedSearch = {
    suggestions: [{
        display_name: 'Duke Energy',
        confidence: 0.93,
        rationale_short: 'Serves the property area',
        contact_phone: '800-777-9898',
        contact_website: 'https://www.duke-energy.com/',
    }],
    outcome: {
        category: 'electric' as const,
        source: 'ai_verify' as const,
        reasonCode: null,
        upstreamReasonCode: null,
        attemptCount: 2,
        latencyMs: 100,
        suggestionCount: 1,
        localityState: 'NC',
        localityZip3: '276',
        localityCity: 'Raleigh',
        servedPipeline: 'new' as const,
    },
};

const acceptedContact = {
    contact: {
        customer_service_phone: '1-800-777-9898',
        start_stop_service_url: 'https://duke-energy.com/start',
        main_website: 'https://duke-energy.com/',
    },
    failure: null,
    groundingSourceUrls: ['https://duke-energy.com/contact'],
};

describe('incident provider resolution classifier', () => {
    it('automatically proposes only blank contact fields after independent corroboration', () => {
        expect(classifyIncidentEntry({
            entry,
            search: acceptedSearch,
            contact: acceptedContact,
        })).toMatchObject({
            disposition: 'automatic_contact_repair',
            proposedPhone: '1-800-777-9898',
            proposedUrl: 'https://duke-energy.com/start',
        });

        expect(classifyIncidentEntry({
            entry: { ...entry, contactPhone: '(919) 555-0100' },
            search: acceptedSearch,
            contact: acceptedContact,
        })).toMatchObject({
            disposition: 'automatic_contact_repair',
            proposedPhone: null,
            proposedUrl: 'https://duke-energy.com/start',
        });
    });

    it('requires exact provider match, accepted provenance, and sufficient confidence', () => {
        expect(classifyIncidentEntry({
            entry: { ...entry, entryMode: 'suggested_confirmed' },
            search: {
                ...acceptedSearch,
                suggestions: [{ ...acceptedSearch.suggestions[0], display_name: 'Dominion Energy' }],
            },
            contact: acceptedContact,
        }).disposition).toBe('needs_customer_confirmation');

        expect(classifyIncidentEntry({
            entry,
            search: {
                ...acceptedSearch,
                outcome: { ...acceptedSearch.outcome, source: 'fallback' },
            },
            contact: acceptedContact,
        }).disposition).toBe('leave_unchanged');

        expect(classifyIncidentEntry({
            entry,
            search: {
                ...acceptedSearch,
                suggestions: [{ ...acceptedSearch.suggestions[0], confidence: 0.79 }],
            },
            contact: acceptedContact,
        }).disposition).toBe('leave_unchanged');
    });

    it('rejects contact data not corroborated by phone or domain', () => {
        const proposal = classifyIncidentEntry({
            entry: { ...entry, entryMode: 'search_selected' },
            search: {
                ...acceptedSearch,
                suggestions: [{
                    ...acceptedSearch.suggestions[0],
                    contact_phone: '919-555-0100',
                    contact_website: 'https://different.example/',
                }],
            },
            contact: acceptedContact,
        });

        expect(proposal).toMatchObject({
            disposition: 'needs_customer_confirmation',
            proposedPhone: null,
            proposedUrl: null,
        });
    });
});

describe('incident provider review HTML', () => {
    it('escapes untrusted content and embeds only the repair decision fields', () => {
        const maliciousEntry = {
            ...entry,
            propertyAddress: '</script><script>alert(1)</script>',
            providerName: '<img src=x onerror=alert(1)>',
        };
        const proposal = classifyIncidentEntry({
            entry: maliciousEntry,
            search: {
                ...acceptedSearch,
                suggestions: [{
                    ...acceptedSearch.suggestions[0],
                    display_name: maliciousEntry.providerName,
                }],
            },
            contact: acceptedContact,
        });
        const report: IncidentReport = {
            incidentId: 'provider-resolution-2026-07',
            generatedAt: '2026-07-29T12:00:00.000Z',
            startedAt: '2026-07-24T19:03:00.000Z',
            endedAt: '2026-07-29T12:00:00.000Z',
            rows: [{
                entry: maliciousEntry,
                search: acceptedSearch,
                contact: acceptedContact,
                proposal,
            }],
        };

        const html = renderIncidentReviewHtml(report);

        expect(html).not.toContain('</script><script>alert(1)</script>');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toContain('sellerEmail');
        expect(html).not.toContain('accountEmail');
        expect(html).toContain('Export decisions');
    });
});
