'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { linkSuffixError } from '@/lib/seller-forms/links';
import type { SavedSellerForm } from './types';

/** Inline editor for the ending of one form's own link (paid plans). */
export function FormLinkEnding({ form, mainUrl, onSaved, onClose }: {
    form: SavedSellerForm;
    /** The workspace's main link; a form's own link adds its ending to it. */
    mainUrl: string;
    onSaved: () => Promise<void>;
    onClose: () => void;
}) {
    const [ending, setEnding] = useState(form.linkSuffix || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [stale, setStale] = useState(false);
    const inputId = `formEnding-${form.id}`;
    async function save() {
        const invalid = linkSuffixError(ending);
        if (invalid) return setError(invalid);
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/api/seller-forms/${form.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suffix: ending, revision: form.revision }),
            });
            const body = await res.json();
            if (!res.ok) {
                setStale(body.code === 'FORM_REVISION_CONFLICT');
                throw new Error(body.message || body.error || 'Unable to rename link');
            }
            await onSaved();
            toast.success('Link renamed');
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to rename link');
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="space-y-2 rounded-md border border-border p-3">
            <Label htmlFor={inputId}>Link ending for {form.name}</Label>
            <div className="flex flex-wrap items-center gap-2">
                <span className="break-all text-sm text-muted-foreground">{mainUrl}/</span>
                <Input
                    id={inputId}
                    className="min-w-32 flex-1"
                    value={ending}
                    maxLength={60}
                    disabled={busy}
                    onChange={(e) => setEnding(e.target.value)}
                    placeholder="For example: closing"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                Use lowercase letters, numbers and dashes. Links you have already shared keep working.
            </p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
                {stale ? (
                    <Button variant="outline" onClick={onSaved}>Reload links</Button>
                ) : (
                    <Button onClick={save} disabled={busy || !ending.trim() || ending === form.linkSuffix}>
                        {busy ? 'Saving…' : 'Save link'}
                    </Button>
                )}
                <Button variant="ghost" disabled={busy} onClick={onClose}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}
