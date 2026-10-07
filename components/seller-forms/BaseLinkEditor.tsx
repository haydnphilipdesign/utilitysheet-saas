'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { SellerFormLinkBase } from './types';

/** Inline editor for the name at the end of the workspace's main link. */
export function MainLinkRename({ base, onSaved, onClose }: {
    base: SellerFormLinkBase;
    onSaved: () => Promise<void>;
    onClose: () => void;
}) {
    const [slug, setSlug] = useState(base.slug);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [stale, setStale] = useState(false);
    const prefix = base.url.slice(0, -base.slug.length);
    async function save() {
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/seller-form-link-base', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base: slug, revision: base.revision }),
            });
            const body = await res.json();
            if (!res.ok) {
                setStale(body.code === 'FORM_REVISION_CONFLICT');
                throw new Error(body.message || body.error || 'Unable to save link name');
            }
            await onSaved();
            toast.success('Link renamed');
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save link name');
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="space-y-2 rounded-md border border-border p-3">
            <Label htmlFor="sellerFormBase">Link name</Label>
            <div className="flex flex-wrap items-center gap-2">
                <span className="break-all text-sm text-muted-foreground">{prefix}</span>
                <Input id="sellerFormBase" className="min-w-32 flex-1" value={slug} maxLength={60} disabled={busy}
                    onChange={e => setSlug(e.target.value)} aria-describedby="sellerFormBaseHelp" />
            </div>
            <p id="sellerFormBaseHelp" className="text-xs text-muted-foreground">
                Use lowercase letters, numbers and dashes. Links you have already shared keep working.
            </p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
                {stale ? (
                    <Button variant="outline" onClick={onSaved}>Reload links</Button>
                ) : (
                    <Button onClick={save} disabled={busy || slug === base.slug || !slug.trim()}>
                        {busy ? 'Saving…' : 'Save link name'}
                    </Button>
                )}
                <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            </div>
        </div>
    );
}

/** The workspace's main link, shown once there is more than one form to choose between. */
export function BaseLinkEditor({ base, isPaid, onSaved }: {
    base: SellerFormLinkBase;
    isPaid: boolean;
    onSaved: () => Promise<void>;
}) {
    const [renaming, setRenaming] = useState(false);
    async function copy() {
        try {
            await navigator.clipboard.writeText(base.url);
            toast.success('Main link copied');
        } catch {
            toast.error('Unable to copy link');
        }
    }
    return (
        <Card>
            <CardHeader><CardTitle>Main link</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    One link you can share everywhere. Your main link currently opens{' '}
                    <span className="font-medium text-foreground">{base.formName}</span>
                    {!base.isActive ? ' (paused, so sellers cannot start from it)' : ''}.
                    {' '}To change that, choose Make default in another form&apos;s menu.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 basis-full break-all sm:basis-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{base.url}</p>
                    <Button variant="outline" disabled={!base.isActive} onClick={copy} aria-label="Copy main link">
                        <Copy />
                        Copy
                    </Button>
                    {isPaid && !renaming && (
                        <Button variant="ghost" onClick={() => setRenaming(true)} aria-label="Rename main link">
                            <Pencil />
                            Rename
                        </Button>
                    )}
                </div>
                {renaming && <MainLinkRename base={base} onSaved={onSaved} onClose={() => setRenaming(false)} />}
                {!isPaid && <p className="text-sm text-muted-foreground">
                    Customize links on <Link href="/dashboard/settings?tab=billing" className="text-primary underline">Pro or Teams</Link>.
                    {' '}Your existing links keep working.
                </p>}
            </CardContent>
        </Card>
    );
}
