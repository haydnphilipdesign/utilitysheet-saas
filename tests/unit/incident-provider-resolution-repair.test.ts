import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    assertRepairApplyAuthorized,
    buildIncidentContactRepairPlan,
    parseProviderResolutionDecisions,
    summarizeIncidentContactRepairs,
    type CurrentIncidentEntry,
} from '@/scripts/incident/provider-resolution-repair-core';

const entryId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';
const expectedUpdatedAt = '2026-07-25T12:00:00.000Z';

const decisionInput = {
    incidentId: 'provider-resolution-2026-07',
    generatedAt: '2026-07-29T12:00:00.000Z',
    entries: [{
        entryId,
        requestId,
        category: 'electric',
        expectedUpdatedAt,
        expectedProviderName: 'Duke Energy',
        expectedPhone: null,
        expectedUrl: null,
        action: 'fill_missing',
        proposedPhone: '1-800-777-9898',
        proposedUrl: 'https://duke-energy.com/start',
    }],
};

const current: CurrentIncidentEntry = {
    entryId,
    requestId,
    category: 'electric',
    updatedAt: expectedUpdatedAt,
    providerName: 'Duke Energy',
    contactPhone: null,
    contactUrl: null,
};

describe('incident provider repair plan', () => {
    it('builds a null-only repair plan from exact current state', () => {
        const decisions = parseProviderResolutionDecisions(decisionInput);
        const repairs = buildIncidentContactRepairPlan(decisions, [current]);

        expect(repairs).toEqual([expect.objectContaining({
            entryId,
            proposedPhone: '1-800-777-9898',
            proposedUrl: 'https://duke-energy.com/start',
            changedFields: ['contact_phone', 'contact_url'],
        })]);
        expect(summarizeIncidentContactRepairs(repairs)).toEqual({
            selected: 1,
            requests: 1,
            phoneFields: 1,
            urlFields: 1,
        });
    });

    it('rejects a wrong incident, stale row, or overwrite attempt', () => {
        expect(() => parseProviderResolutionDecisions({
            ...decisionInput,
            incidentId: 'different-incident',
        })).toThrow();

        const decisions = parseProviderResolutionDecisions(decisionInput);
        expect(() => buildIncidentContactRepairPlan(decisions, [{
            ...current,
            updatedAt: '2026-07-29T13:00:00.000Z',
        }])).toThrow(/changed after report generation/);

        expect(() => buildIncidentContactRepairPlan(decisions, [{
            ...current,
            contactPhone: '(919) 555-0100',
        }])).toThrow(/changed after report generation/);
    });

    it('ignores non-repair decisions', () => {
        const decisions = parseProviderResolutionDecisions({
            ...decisionInput,
            entries: [{
                ...decisionInput.entries[0],
                action: 'customer_confirmation',
            }],
        });

        expect(buildIncidentContactRepairPlan(decisions, [current])).toEqual([]);
    });
});

describe('incident provider repair apply gate', () => {
    it('allows dry run without apply credentials', () => {
        expect(() => assertRepairApplyAuthorized({
            apply: false,
            confirm: null,
            adminId: null,
            adminWritesDisabled: true,
        })).not.toThrow();
    });

    it('requires enabled admin writes, exact confirmation, and an admin UUID', () => {
        expect(() => assertRepairApplyAuthorized({
            apply: true,
            confirm: 'provider-resolution-2026-07',
            adminId,
            adminWritesDisabled: true,
        })).toThrow(/blocked/);

        expect(() => assertRepairApplyAuthorized({
            apply: true,
            confirm: 'wrong',
            adminId,
            adminWritesDisabled: false,
        })).toThrow(/--confirm/);

        expect(() => assertRepairApplyAuthorized({
            apply: true,
            confirm: 'provider-resolution-2026-07',
            adminId: null,
            adminWritesDisabled: false,
        })).toThrow(/--admin-id/);

        expect(() => assertRepairApplyAuthorized({
            apply: true,
            confirm: 'provider-resolution-2026-07',
            adminId,
            adminWritesDisabled: false,
        })).not.toThrow();
    });

    it('casts incident metadata parameters for PostgreSQL JSON construction', () => {
        const source = readFileSync(
            'scripts/incident/provider-resolution-repair.ts',
            'utf8'
        );
        expect(
            source.match(/\$\{PROVIDER_RESOLUTION_INCIDENT_ID\}::text/g)
        ).toHaveLength(2);
    });
});
