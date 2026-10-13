import { logDiagnostic } from './diagnostics';

export const AUXILIARY_WRITE_BUDGET_MS = 500;
export type AuxiliaryObservation =
    | 'request_created' | 'seller_opened' | 'seller_self_send_link'
    | 'suggestions_fetched' | 'suggestions_search'
    | 'test_drive_invitation_succeeded' | 'test_drive_invitation_failed'
    | 'test_drive_delivery_succeeded' | 'test_drive_delivery_failed'
    | 'ai_run' | 'ai_selection' | 'operational_event' | 'operational_success'
    | 'job_start' | 'job_finish' | 'seller_observation' | 'handoff_evidence';

/**
 * Only auxiliary observations belong here. Pass the signal to the actual I/O.
 * The guard bounds local waiting even if a sink ignores abort; Neon fetch is
 * actively aborted. This cannot prove remote rollback, so never retry here.
 */
export async function writeAuxiliary<T>(
    observation: AuxiliaryObservation,
    write: (signal: AbortSignal) => Promise<T>,
    fallback: T,
): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                controller.abort();
                reject(new Error('Auxiliary write deadline'));
            }, AUXILIARY_WRITE_BUDGET_MS);
        });
        return await Promise.race([Promise.resolve().then(() => write(controller.signal)), deadline]);
    } catch (error) {
        logDiagnostic('warn', 'auxiliary_write_failed', {
            observation,
            reason: controller.signal.aborted ? 'deadline' : 'write_failed',
        }, error);
        return fallback;
    } finally {
        clearTimeout(timer);
    }
}
