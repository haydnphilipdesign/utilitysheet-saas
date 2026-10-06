'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FormCreationAction } from './FormCreationAction';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { SavedSellerForm, SellerFormsResponse } from './types';
import { BaseLinkEditor } from './BaseLinkEditor';
import { FormLinkEnding } from './FormLinkEnding';

export function FormsWorkspace() {
    const [data, setData] = useState<SellerFormsResponse | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    async function load() {
        try {
            const res = await fetch('/api/seller-forms');
            const body = await res.json();
            if (!res.ok) throw new Error(body.error);
            setData(body);
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load forms');
        }
    }
    useEffect(() => {
        void load();
    }, []);
    async function makeDefault({ id, name }: SavedSellerForm) {
        // The main link follows the default, so this changes links already shared.
        if (
            data?.linkBase &&
            !window.confirm(
                `Make "${name}" your default form?\n\nYour main link (${data.linkBase.url}) will open it from now on, including where you have already shared it. "${data.linkBase.formName}" stays available at its own link.`,
            )
        )
            return;
        setBusy(id);
        try {
            const res = await fetch(`/api/seller-forms/${id}/default`, {
                method: 'POST',
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error);
            await load();
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : 'Unable to change default',
            );
        } finally {
            setBusy(null);
        }
    }
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Seller forms</h1>
                    <p className="text-sm text-muted-foreground">
                        Create reusable forms and share a link with your sellers.
                    </p>
                </div>
                {data && <FormCreationAction capabilities={data.capabilities} />}
            </div>
            {error && (
                <div role="alert" className="space-y-2">
                    <p>{error}</p>
                    <Button variant="outline" onClick={load}>
                        Retry
                    </Button>
                </div>
            )}
            {!data && !error && <p role="status">Loading seller forms…</p>}
            {data?.linkBase && <BaseLinkEditor
                key={`${data.linkBase.slug}:${data.linkBase.revision}`}
                base={data.linkBase} isPaid={data.isPaid} onSaved={load}
            />}
            {data && <div className="space-y-1 text-sm text-muted-foreground">
                <p>{data.capabilities.usage} of {data.capabilities.allowance} forms in this workspace (including paused forms).</p>
                {data.capabilities.usage > data.capabilities.allowance && <p>Your existing forms, links and configurations are kept. You can edit or reactivate them; incoming submissions use your current plan. Upgrade to restore paid features and create up to ten forms.</p>}
            </div>}
            {data?.forms.length === 0 && (
                <p>No form is available in this workspace yet.</p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
                {data?.forms.map((form) => (
                    <Card key={form.id}>
                        <CardHeader>
                            <CardTitle className="flex flex-wrap items-center gap-2">
                                <span className="break-words">{form.name}</span>
                                {form.isDefault && (
                                    <Badge variant="outline">Default</Badge>
                                )}
                                <Badge variant="secondary">
                                    {form.isActive ? 'Active' : 'Paused'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {data.workspaceName} ·{' '}
                                {form.defaultUtilityCategories.length} utilities
                                {form.collectHoaQuestions ? ' · HOA' : ''}
                                {form.defaultPacketMode === 'advanced' &&
                                data.isPaid
                                    ? ' · Handoff sections'
                                    : ''}
                            </p>
                            <FormLinkEnding
                                key={`${form.id}:${form.revision}`}
                                form={form}
                                mainUrl={data.linkBase?.url ?? null}
                                canRename={data.isPaid}
                                onSaved={load}
                            />
                            {!form.isActive && (
                                <p className="text-sm text-muted-foreground">
                                    New starts are paused. Existing requests
                                    remain available. Reactivate in Edit to
                                    share.
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    disabled={!form.isActive}
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(
                                                form.url,
                                            );
                                            toast.success('Link copied');
                                        } catch {
                                            toast.error('Unable to copy link');
                                        }
                                    }}
                                >
                                    Copy link
                                </Button>
                                <Link
                                    className={buttonVariants({
                                        variant: 'outline',
                                    })}
                                    href={`/dashboard/forms/${form.id}`}
                                >
                                    Edit
                                </Link>
                                <Link
                                    className={buttonVariants({
                                        variant: 'outline',
                                    })}
                                    href={`/dashboard/forms/${form.id}?preview=1`}
                                >
                                    Preview
                                </Link>
                                <FormCreationAction capabilities={data.capabilities} duplicateId={form.id} />
                                {!form.isDefault && (
                                    <Button
                                        variant="ghost"
                                        disabled={busy !== null}
                                        onClick={() => makeDefault(form)}
                                    >
                                        Make default
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
