'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { FormCreationAction, FormLimitDialog, newFormHref } from './FormCreationAction';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { SavedSellerForm, SellerFormsResponse } from './types';
import { BaseLinkEditor } from './BaseLinkEditor';
import { FormCard } from './FormCard';
import { PauseFormDialog, resumeForm } from './FormAvailability';

const intro = 'Each form is a set of questions with its own link. Send the link to a seller and their answers come back to you.';

export function FormsWorkspace({ embedded = false }: {
    /** Rendered inside another page (Settings), which already has the page title. */
    embedded?: boolean;
}) {
    const router = useRouter();
    const [data, setData] = useState<SellerFormsResponse | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [defaultTarget, setDefaultTarget] = useState<SavedSellerForm | null>(null);
    const [pauseTarget, setPauseTarget] = useState<SavedSellerForm | null>(null);
    const [limitOpen, setLimitOpen] = useState(false);
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
        setBusy(id);
        try {
            const res = await fetch(`/api/seller-forms/${id}/default`, {
                method: 'POST',
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error);
            await load();
            toast.success(`"${name}" is now your default form`);
            setDefaultTarget(null);
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : 'Unable to change default',
            );
        } finally {
            setBusy(null);
        }
    }
    async function resume(form: SavedSellerForm) {
        setBusy(form.id);
        await resumeForm(form);
        await load();
        setBusy(null);
    }
    const actions = data && <FormCreationAction capabilities={data.capabilities} />;
    // With a single form its link is the main link; the main/own link distinction only matters from two forms on.
    const onlyForm = data?.forms.length === 1 && data.forms[0].isDefault;
    return (
        <div className="space-y-6">
            {embedded ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Seller forms</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
                    </div>
                    {actions}
                </div>
            ) : (
                <PageHeader title="Seller forms" description={intro} actions={actions} />
            )}
            {error && (
                <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" onClick={load}>
                        Try again
                    </Button>
                </div>
            )}
            {!data && !error && (
                <div role="status" className="grid gap-4 md:grid-cols-2">
                    <span className="sr-only">Loading seller forms…</span>
                    <Skeleton className="h-44" />
                    <Skeleton className="hidden h-44 md:block" />
                </div>
            )}
            {data?.linkBase && !onlyForm && data.forms.length > 0 && <BaseLinkEditor
                key={`${data.linkBase.slug}:${data.linkBase.revision}`}
                base={data.linkBase} isPaid={data.isPaid} onSaved={load}
            />}
            {data?.forms.length === 0 && (
                <EmptyState
                    icon={FileText}
                    title="No seller forms yet"
                    description="Create a form to get a link you can send to sellers."
                    action={actions}
                />
            )}
            {data && data.forms.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                    {data.forms.map((form) => (
                        <FormCard
                            key={`${form.id}:${form.revision}`}
                            form={form}
                            data={data}
                            onlyForm={onlyForm === true}
                            busy={busy !== null}
                            onChanged={load}
                            onDuplicate={(source) =>
                                data.capabilities.canCreate
                                    ? router.push(newFormHref(source.id))
                                    : setLimitOpen(true)
                            }
                            onMakeDefault={(target) =>
                                // The main link follows the default, so this changes links already shared.
                                data.linkBase ? setDefaultTarget(target) : void makeDefault(target)
                            }
                            onPause={setPauseTarget}
                            onResume={resume}
                        />
                    ))}
                </div>
            )}
            {data && <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                    Using {data.capabilities.usage} of {data.capabilities.allowance}{' '}
                    {data.capabilities.allowance === 1 ? 'form' : 'forms'} in {data.workspaceName}. Paused forms count.
                </p>
                {data.capabilities.usage > data.capabilities.allowance && <p>Your existing forms, links and configurations are kept. You can edit or reactivate them; incoming submissions use your current plan. Upgrade to restore paid features and create up to ten forms.</p>}
            </div>}
            {data && <FormLimitDialog capabilities={data.capabilities} open={limitOpen} onOpenChange={setLimitOpen} />}
            <PauseFormDialog form={pauseTarget} onClose={() => setPauseTarget(null)} onPaused={load} />
            <ConfirmDialog
                open={defaultTarget !== null}
                onOpenChange={(open) => { if (!open) setDefaultTarget(null); }}
                title={defaultTarget ? `Make "${defaultTarget.name}" your default form?` : 'Change default form?'}
                description={data?.linkBase
                    ? `Your main link (${data.linkBase.url}) will open it from now on, including where you have already shared it. "${data.linkBase.formName}" stays available at its own link.`
                    : ''}
                confirmLabel={busy ? 'Saving…' : 'Make default'}
                onConfirm={() => { if (defaultTarget) void makeDefault(defaultTarget); }}
                busy={busy !== null}
            />
        </div>
    );
}
