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
    const preview = `${base.url.slice(0, -base.slug.length)}${slug}`;
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
                throw new Error(body.message || body.error || 'Unable to save base link');
            }
            await onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save base link');
        } finally {
            setBusy(false);
        }
    }
    return (
        <Card>
            <CardHeader><CardTitle>Base link</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Your base link opens your default form. Every form also has its own link, which adds an ending to this one. Previously shared links keep working.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor="sellerFormBase">Base link name</Label>
                        <Input id="sellerFormBase" value={slug} disabled={!isPaid || busy}
                            onChange={e => setSlug(e.target.value)} aria-describedby="sellerFormBasePreview" />
                    </div>
                    {isPaid && <Button onClick={save} disabled={busy || stale || slug === base.slug || !slug.trim()}>
                        {busy ? 'Saving…' : 'Save base link'}
                    </Button>}
                </div>
                <p id="sellerFormBasePreview" className="break-all text-sm">{preview}</p>
                <p className="text-sm text-muted-foreground">
                    The base link currently opens <span className="font-medium">{base.formName}</span>{!base.isActive ? ' (paused, so sellers cannot start from it)' : ''}.
                    {' '}Make another form the default to change this.
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
