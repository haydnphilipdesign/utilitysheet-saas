import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    sql: vi.fn(),
    transaction: vi.fn(),
    token: 0,
}));

vi.mock('@/lib/neon/db', () => ({
    sql: Object.assign(mocks.sql, { transaction: mocks.transaction }),
    generateToken: () => `token-${++mocks.token}`,
    isDbConfigured: () => true,
}));

import { getOrCreateTestDriveRequest } from '@/lib/neon/queries/requests';

type CapturedQuery = { strings: TemplateStringsArray; values: unknown[] };

function queryText(query: CapturedQuery): string {
    return Array.from(query.strings).join('');
}

describe('getOrCreateTestDriveRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.token = 0;
        mocks.sql.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }));
    });

    it('serializes by account and inserts only one unmetered demo before returning the canonical row', async () => {
        const request = {
            id: 'req_demo',
            account_id: 'acct_1',
            organization_id: 'org_1',
            public_token: 'public',
            seller_token: 'seller',
            status: 'sent',
            is_demo: true,
        };
        mocks.transaction.mockResolvedValue([[], [request], [request], [{ has_live_submission: false }], [{ test_count: 1 }]]);

        const result = await getOrCreateTestDriveRequest({
            accountId: 'acct_1',
            organizationId: 'org_1',
            brandProfileId: 'brand_1',
            propertyAddress: '[TEST] 123 Maple Street, Anytown, PA 18301',
            propertyAddressStructured: null,
            sellerName: 'UtilitySheet Test Seller',
            sellerEmail: 'verified@example.com',
            utilityCategories: ['electric', 'water'],
            packetMode: 'simple',
            advancedModules: [],
            advancedModuleExclusions: {},
            limit: 3,
        });

        expect(result).toEqual({ request, created: true, hasLiveSubmission: false, testCount: 1 });
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        const queries = mocks.transaction.mock.calls[0][0] as CapturedQuery[];
        expect(queries).toHaveLength(5);

        const text = queries.map(queryText).join('\n');
        expect(text).toContain('pg_advisory_xact_lock');
        expect(text).toContain('INSERT INTO requests');
        expect(text).toContain('COALESCE(is_demo, FALSE) = TRUE');
        expect(text).toContain("status = 'submitted'");
        expect(text).toContain('COALESCE(is_demo, FALSE) = FALSE');
        expect(text).toContain("'sent'");
        expect(text).toContain('NULL');
        expect(text).toContain('ORDER BY created_at DESC, id DESC');
        expect(text).toContain('SELECT COUNT(*)');

        const values = queries.flatMap((query) => query.values);
        expect(values).toContain('test-drive:acct_1');
        expect(values).toContain('acct_1');
        expect(values).toContain('org_1');
        expect(values).toContain('verified@example.com');
        expect(values).toContain('[TEST] 123 Maple Street, Anytown, PA 18301');
    });

    it('reports a resumed row without claiming creation', async () => {
        const request = { id: 'req_existing', status: 'in_progress' };
        mocks.transaction.mockResolvedValue([[], [], [request], [{ has_live_submission: false }], [{ test_count: 1 }]]);

        const result = await getOrCreateTestDriveRequest({
            accountId: 'acct_1',
            propertyAddress: '[TEST] 123 Maple Street, Anytown, PA 18301',
            sellerName: 'UtilitySheet Test Seller',
            sellerEmail: 'verified@example.com',
            utilityCategories: ['electric'],
            packetMode: 'simple',
            advancedModules: [],
            advancedModuleExclusions: {},
            limit: 3,
        });

        expect(result).toEqual({ request, created: false, hasLiveSubmission: false, testCount: 1 });
        // Without startAnother only a first test may be inserted.
        const insert = (mocks.transaction.mock.calls[0][0] as CapturedQuery[])[1];
        expect(insert.values).toContain(false);
        expect(insert.values).toContain(3);
    });

    it('asks for another test up to the limit and returns the inserted row', async () => {
        const inserted = { id: 'req_new', status: 'sent' };
        const older = { id: 'req_old', status: 'submitted' };
        mocks.transaction.mockResolvedValue([[], [inserted], [older], [{ has_live_submission: false }], [{ test_count: 2 }]]);

        const result = await getOrCreateTestDriveRequest({
            accountId: 'acct_1',
            propertyAddress: '[TEST] 123 Maple Street, Austin, TX 78704',
            sellerName: 'UtilitySheet Test Seller',
            sellerEmail: 'verified@example.com',
            utilityCategories: ['electric'],
            packetMode: 'simple',
            advancedModules: [],
            advancedModuleExclusions: {},
            startAnother: true,
            limit: 3,
        });

        expect(result).toEqual({ request: inserted, created: true, hasLiveSubmission: false, testCount: 2 });
        const insert = (mocks.transaction.mock.calls[0][0] as CapturedQuery[])[1];
        expect(queryText(insert)).toContain('THEN');
        expect(insert.values).toContain(true);
        expect(insert.values).toContain(3);
        expect(insert.values).toContain('[TEST] 123 Maple Street, Austin, TX 78704');
    });
});
