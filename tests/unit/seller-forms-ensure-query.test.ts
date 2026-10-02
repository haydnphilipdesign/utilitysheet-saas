import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    sql: vi.fn(),
    token: vi.fn(() => 'synthetic-form-slug'),
}));
vi.mock('@/lib/neon/db', () => ({
    sql: mocks.sql,
    generateToken: mocks.token,
}));
import { ensureIntakeLink } from '@/lib/neon/queries/intake-links';
import { savedForm } from '../fixtures/saved-seller-forms';
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'false');
    vi.stubEnv('SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS', '');
    vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', '');
    mocks.sql.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
describe('automatic default provisioning capability', () => {
    it.each(['disabled', 'nonpilot', 'eligible'])(
        'passes verified %s capability and cap into the atomic writer',
        async (mode) => {
            vi.stubEnv(
                'SAVED_SELLER_FORMS_ENABLED',
                mode === 'disabled' ? 'false' : 'true',
            );
            vi.stubEnv(
                'SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS',
                mode === 'nonpilot' ? 'someone-else' : savedForm.account_id,
            );
            vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', '2');
            expect(
                await ensureIntakeLink(savedForm.account_id, 'workspace-b'),
            ).toEqual({ intakeLink: null, created: false });
            expect(mocks.sql.mock.calls[0].slice(1)).toEqual([
                savedForm.account_id,
                'workspace-b',
                'synthetic-',
                mode === 'eligible',
                2,
            ]);
        },
    );
    it('returns an existing form while the gate is disabled', async () => {
        mocks.sql.mockResolvedValue([savedForm]);
        expect(await ensureIntakeLink(savedForm.account_id)).toEqual({
            intakeLink: savedForm,
            created: false,
        });
        expect(mocks.sql.mock.calls[0].slice(-2)).toEqual([false, null]);
    });
});
