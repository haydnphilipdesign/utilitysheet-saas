import { describe, expect, it } from 'vitest';
import { resolveRequestQuestionSettings } from '@/lib/requests/question-settings';
import { createRequestBodySchema } from '@/lib/validation/schemas';
import { resolveHoaSubmission } from '@/lib/packet/hoa';

describe('request question settings', () => {
    it('defaults legacy and reusable requests to on without preferences', () => {
        for (const preferences of [undefined, null, {}]) {
            expect(resolveRequestQuestionSettings({}, preferences)).toEqual({
                collectHoaQuestions: true, collectElectricMeterNumber: true,
            });
        }
    });

    it('inherits changing account defaults when the stored values are null', () => {
        const request = { collect_hoa_questions: null, collect_electric_meter_number: null };
        expect(resolveRequestQuestionSettings(request, { collect_hoa_questions: false })).toEqual({
            collectHoaQuestions: false, collectElectricMeterNumber: true,
        });
        expect(resolveRequestQuestionSettings(request, { collect_electric_meter_number: false })).toEqual({
            collectHoaQuestions: true, collectElectricMeterNumber: false,
        });
    });

    it.each([true, false])('keeps explicit %s choices across account-default changes', (value) => {
        const request = { collect_hoa_questions: value, collect_electric_meter_number: value };
        for (const accountValue of [true, false]) {
            expect(resolveRequestQuestionSettings(request, {
                collect_hoa_questions: accountValue, collect_electric_meter_number: accountValue,
            })).toEqual({ collectHoaQuestions: value, collectElectricMeterNumber: value });
        }
    });

    it('resolves each choice independently and enforces HOA submission overrides', () => {
        const settings = resolveRequestQuestionSettings({ collect_hoa_questions: false }, { collect_electric_meter_number: false });
        expect(settings).toEqual({ collectHoaQuestions: false, collectElectricMeterNumber: false });
        expect(resolveHoaSubmission({ has_hoa: 'yes', hoa_name: 'Example HOA' }, settings.collectHoaQuestions).update).toBe(false);
        expect(resolveHoaSubmission({ has_hoa: 'yes' }, resolveRequestQuestionSettings({ collect_hoa_questions: true }, { collect_hoa_questions: false }).collectHoaQuestions).update).toBe(true);
    });

    it('validates explicit booleans and still accepts older creation payloads', () => {
        const body = { propertyAddress: '123 Test Lane' };
        expect(createRequestBodySchema.parse(body)).toEqual(body);
        expect(createRequestBodySchema.parse({ ...body, collectHoaQuestions: false, collectElectricMeterNumber: true })).toMatchObject({ collectHoaQuestions: false, collectElectricMeterNumber: true });
        for (const key of ['collectHoaQuestions', 'collectElectricMeterNumber']) {
            for (const value of ['false', 0, null]) {
                expect(createRequestBodySchema.safeParse({ ...body, [key]: value }).success).toBe(false);
            }
        }
    });
});
