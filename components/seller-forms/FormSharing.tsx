'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { SavedSellerForm } from './types';

/** A form's own link without its ending. A shared form keeps its creator's link name. */
export function formLinkPrefix(form: Pick<SavedSellerForm, 'endingUrl'>, fallback: string) {
    return form.endingUrl ? form.endingUrl.slice(0, form.endingUrl.lastIndexOf('/')) : fallback;
}

async function failure(res: Response, fallback: string) {
    const body = await res.json().catch(() => ({}));
    return new Error(body.message || body.error || fallback);
}

/** Explains sharing or taking a form back, then saves it. Open while `target` is set. */
export function ShareFormDialog({ target, workspaceName, onClose, onSaved }: {
    target: { form: SavedSellerForm; shared: boolean } | null;
    workspaceName: string;
    onClose: () => void;
    onSaved: (form: SavedSellerForm) => void | Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const form = target?.form;
    const sharing = target?.shared === true;
    async function confirm() {
        if (!target) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/seller-forms/${target.form.id}/share`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shared: target.shared, revision: target.form.revision }),
            });
            if (!res.ok) throw await failure(res, sharing ? 'Unable to share form' : 'Unable to stop sharing');
            const body = await res.json();
            toast.success(sharing ? `"${target.form.name}" is now shared with ${workspaceName}` : `"${target.form.name}" is no longer shared`);
            await onSaved(body.form);
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Unable to save');
        } finally {
            setBusy(false);
        }
    }
    const owner = form && !form.isMine ? `${form.ownerName || 'its creator'}’s` : 'your';
    return (
        <ConfirmDialog
            open={target !== null}
            onOpenChange={(open) => { if (!open) onClose(); }}
            title={!form ? 'Share form?' : sharing ? `Share "${form.name}" with ${workspaceName}?` : `Stop sharing "${form.name}"?`}
            description={sharing
                ? 'Everyone in this workspace will be able to copy its link and create requests from it. Only you and workspace admins can change it. Its link stays the same. If you leave the workspace, the form stays with the team and is handed to an admin.'
                : `It goes back to being ${owner} own form. Teammates will no longer see it or create requests from it. Its link keeps working, and requests already created from it are not affected.`}
            confirmLabel={busy ? 'Saving…' : sharing ? 'Share form' : 'Stop sharing'}
            onConfirm={confirm}
            busy={busy}
        />
    );
}

/** Explains that deleting is permanent, then deletes the form. Open while `form` is set. */
export function DeleteFormDialog({ form, onClose, onDeleted }: {
    form: SavedSellerForm | null;
    onClose: () => void;
    onDeleted: () => void | Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    async function confirm() {
        if (!form) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/seller-forms/${form.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revision: form.revision }),
            });
            if (!res.ok) throw await failure(res, 'Unable to delete form');
            toast.success(`"${form.name}" was deleted`);
            await onDeleted();
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Unable to delete form');
        } finally {
            setBusy(false);
        }
    }
    return (
        <ConfirmDialog
            open={form !== null}
            onOpenChange={(open) => { if (!open) onClose(); }}
            title={form ? `Delete "${form.name}"?` : 'Delete form?'}
            description={
                <>
                    Its link will stop working for new sellers and the form is removed
                    {form?.shared ? ' for everyone in the workspace' : ' from your list'}.
                    This cannot be undone. Requests already created from it are kept, and
                    sellers who already started can still finish. Afterwards you can give
                    its link ending to another form.
                </>
            }
            confirmLabel={busy ? 'Deleting…' : 'Delete form'}
            destructive
            onConfirm={confirm}
            busy={busy}
        />
    );
}
