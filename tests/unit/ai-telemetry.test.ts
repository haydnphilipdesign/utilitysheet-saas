import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    sql: vi.fn(),
}));

vi.mock('@/lib/neon/db', () => ({
    sql: mocks.sql,
}));

import {
    createAiSuggestionRun,
    markAiSuggestionSelection,
    normalizeSuggestionName,
} from '@/lib/neon/queries/ai-telemetry';

describe('AI telemetry query helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sql.mockResolvedValue([{ id: 'run_1' }]);
    });

    it('persists redacted run metadata and suggestion items without raw prompts or addresses', async () => {
        const runId = await createAiSuggestionRun({
            requestId: 'req_1',
            accountId: 'acct_1',
            organizationId: 'org_1',
            feature: 'provider_suggestions',
            category: 'electric',
            provider: 'gemini',
            model: 'gemini-test',
            promptVersion: 'suggestions-v1',
            servedPipeline: 'new',
            source: 'ai_verify',
            status: 'success',
            reasonCode: null,
            upstreamReasonCode: 'quality_gate_failed',
            latencyMs: 1234,
            attemptCount: 2,
            localityState: 'PA',
            localityZip3: '183',
            localityCity: 'Stroudsburg',
            suggestionCount: 2,
            suggestions: [
                {
                    display_name: 'Acme Electric',
                    confidence: 0.91,
                    contact_phone: '(555) 111-2222',
                    canonical_id: 'acme-electric',
                },
                {
                    display_name: 'Other Power',
                    confidence: 0.72,
                },
            ],
        });

        expect(runId).toBe('run_1');
        expect(mocks.sql).toHaveBeenCalledTimes(2);

        const serializedCalls = mocks.sql.mock.calls.map((call) => JSON.stringify(call));
        expect(serializedCalls.join('\n')).not.toContain('You are an expert');
        expect(serializedCalls.join('\n')).not.toContain('123 Main');
        expect(serializedCalls.join('\n')).not.toContain('seller@example.com');
        expect(serializedCalls.join('\n')).toContain('provider_suggestions');
        expect(serializedCalls.join('\n')).toContain('Acme Electric');
        expect(serializedCalls.join('\n')).toContain('acme electric');
    });

    it('marks a selected suggestion by normalized provider name and final entry mode', async () => {
        await markAiSuggestionSelection({
            requestId: 'req_1',
            category: 'electric',
            selectedName: '  ACME   Electric ',
            finalEntryMode: 'suggested_confirmed',
            canonicalId: 'acme-electric',
            confidenceScore: 0.91,
        });

        expect(mocks.sql).toHaveBeenCalledTimes(1);
        const serialized = JSON.stringify(mocks.sql.mock.calls[0]);
        expect(serialized).toContain('acme electric');
        expect(serialized).toContain('suggested_confirmed');
        expect(serialized).toContain('acme-electric');
    });

    it('normalizes provider names consistently for matching', () => {
        expect(normalizeSuggestionName('  Acme,  Electric LLC ')).toBe('acme electric llc');
    });
});
