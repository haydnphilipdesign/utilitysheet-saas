'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { SavedSellerForm } from './types';

/** Pauses or resumes one form right away and returns the saved form. */
export async function saveFormActive(
    form: Pick<SavedSellerForm, 'id' | 'revision'>,
    isActive: boolean,
): Promise<SavedSellerForm> {
    const res = await fetch(`/api/seller-forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive, revision: form.revision }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(
            body.message || body.error || (isActive ? 'Unable to resume form' : 'Unable to pause form'),
        );
    return body.form;
}

/** Resumes a paused form; reports the outcome and returns the saved form, or null on failure. `quiet` skips the success toast. */
export async function resumeForm(form: SavedSellerForm, quiet = false): Promise<SavedSellerForm | null> {
    try {
        const next = await saveFormActive(form, true);
        if (!quiet) toast.success('Form resumed. Sellers can start it again.');
        return next;
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Unable to resume form');
        return null;
    }
}

/** Explains what pausing does, then pauses the form. Open while `form` is set. */
export function PauseFormDialog({ form, onClose, onPaused, quiet = false }: {
    form: SavedSellerForm | null;
    onClose: () => void;
    onPaused: (form: SavedSellerForm) => void | Promise<void>;
    /** Skip the success toast where the page already shows the new state. */
    quiet?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    async function pause() {
        if (!form) return;
        setBusy(true);
        try {
            const next = await saveFormActive(form, false);
            if (!quiet) toast.success('Form paused');
            await onPaused(next);
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Unable to pause form');
        } finally {
            setBusy(false);
        }
    }
    return (
        <ConfirmDialog
            open={form !== null}
            onOpenChange={(open) => { if (!open) onClose(); }}
            title={form ? `Pause "${form.name}"?` : 'Pause form?'}
            description={
                <>
                    New sellers will not be able to start this form from its link.
                    Sellers who already started can still finish, and you can
                    resume the form at any time.
                    {form?.isDefault
                        ? ' This is your default form, so your main link will not work for new sellers while it is paused.'
                        : ''}
                </>
            }
            confirmLabel={busy ? 'Pausing…' : 'Pause form'}
            onConfirm={pause}
            busy={busy}
        />
    );
}
