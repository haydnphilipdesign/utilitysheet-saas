import { collectsHoaQuestions } from '@/lib/packet/hoa';

export interface RequestQuestionOverrides {
    collect_hoa_questions?: boolean | null;
    collect_electric_meter_number?: boolean | null;
}

/** Explicit request choices win; legacy and reusable requests inherit live defaults. */
export function resolveRequestQuestionSettings(request: RequestQuestionOverrides, preferences: unknown) {
    const defaults = preferences && typeof preferences === 'object'
        ? preferences as Record<string, unknown>
        : {};
    return {
        collectHoaQuestions: request.collect_hoa_questions ?? collectsHoaQuestions(defaults),
        collectElectricMeterNumber: request.collect_electric_meter_number ?? (defaults.collect_electric_meter_number !== false),
    };
}
