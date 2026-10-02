import { beforeEach, describe, expect, it, vi } from 'vitest';
const sqlMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/neon/db', () => ({ sql: sqlMock, generateToken: () => 'fixture-token' }));
import { createRequest } from '@/lib/neon/queries/requests';

describe('createRequest question persistence', () => {
    beforeEach(() => sqlMock.mockReset().mockResolvedValue([{ id: 'fixture-request' }]));
    it.each([true, false, undefined])('stores %s without changing inheritance for omitted settings', async (value) => {
        await createRequest({ accountId: 'fixture-account', propertyAddress: '123 Test Lane', utilityCategories: ['electric'], collectHoaQuestions: value, collectElectricMeterNumber: value });
        const [strings, ...values] = sqlMock.mock.calls[0];
        expect(strings.join('')).toContain('collect_hoa_questions,\n            collect_electric_meter_number,');
        expect(values.slice(3, 5)).toEqual([value ?? null, value ?? null]);
    });
});
