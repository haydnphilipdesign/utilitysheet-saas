import type { createEventLog } from '@/lib/neon/queries/event-logs';
import { writeAuxiliary, type AuxiliaryObservation } from './auxiliary-write';

type AuxiliaryEvent = Extract<AuxiliaryObservation,
    'request_created' | 'seller_opened' | 'seller_self_send_link' |
    'suggestions_fetched' | 'suggestions_search' |
    'test_drive_invitation_succeeded' | 'test_drive_invitation_failed' |
    'test_drive_delivery_succeeded' | 'test_drive_delivery_failed'>;

/** Explicit opt-in: the strict event writer remains available for required evidence. */
export function auxiliaryEventWriter(writer: typeof createEventLog) {
    return (params: Omit<Parameters<typeof createEventLog>[0], 'eventType'> & { eventType: AuxiliaryEvent }) =>
        writeAuxiliary(params.eventType, async (signal) => {
            await writer(params, { signal });
        }, undefined);
}
