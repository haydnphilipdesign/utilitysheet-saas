'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SellerFormLinkBase } from './types';

export function BaseLinkEditor({ base, isPaid, onSaved }: {
    base: SellerFormLinkBase;
    isPaid: boolean;
    onSaved: () => Promise<void>;
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
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save link name');
        } finally {
            setBusy(false);
        }
    }
    return (
        <Card>
            <CardHeader><CardTitle>Main link</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <p id="sellerFormBaseHelp" className="text-sm text-muted-foreground">
                    Your main link opens your default form. Each form also has its own link, which adds an ending to this one. Links you have already shared keep working.
                </p>
                <div className="space-y-2">
                    <Label htmlFor="sellerFormBase">Link name</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all text-sm text-muted-foreground">{prefix}</span>
                        <Input id="sellerFormBase" className="min-w-32 flex-1" value={slug} disabled={!isPaid || busy}
                            onChange={e => setSlug(e.target.value)} aria-describedby="sellerFormBaseHelp" />
                        {isPaid && <Button onClick={save} disabled={busy || stale || slug === base.slug || !slug.trim()}>
                            {busy ? 'Saving…' : 'Save link name'}
                        </Button>}
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Your main link currently opens <span className="font-medium">{base.formName}</span>{!base.isActive ? ' (paused, so sellers cannot start from it)' : ''}.
                    {' '}To change that, choose Make default on another form.
                </p>
                {!isPaid && <p className="text-sm text-muted-foreground">
                    Customize links on <Link href="/dashboard/settings?tab=billing" className="text-primary underline">Pro or Teams</Link>.
                    {' '}Your existing links keep working.
                </p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {stale && <Button variant="outline" onClick={onSaved}>Reload links</Button>}
            </CardContent>
        </Card>
    );
}
