'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Megaphone, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductUpdate, UpdateCategory } from '@/types';
import { AdminActionReasonField } from '@/components/admin/AdminActionReasonField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatAdminDate } from '@/lib/admin/date-format';
import {
    createProductUpdateAdminAction,
    deleteProductUpdateAdminAction,
    publishProductUpdateAdminAction,
} from '@/app/(admin)/admin/updates/actions';

type ConfirmAction = {
    type: 'publish' | 'delete';
    update: ProductUpdate;
} | null;

function categoryLabel(category: string) {
    if (category === 'bugfix') return 'Bugfix';
    if (category === 'feature') return 'Feature';
    if (category === 'announcement') return 'Announcement';
    return category;
}

function categoryBadgeClass(category: string) {
    if (category === 'bugfix') return 'border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    if (category === 'feature') return 'border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (category === 'announcement') return 'border-blue-500/20 bg-blue-500/15 text-blue-700 dark:text-blue-300';
    return 'border-border bg-muted text-muted-foreground';
}

function UpdatePreview({ update }: { update: Pick<ProductUpdate, 'title' | 'body' | 'category'> }) {
    return (
        <div className="rounded-lg border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">{update.title}</h3>
                <Badge className={categoryBadgeClass(update.category)}>{categoryLabel(update.category)}</Badge>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{update.body}</p>
        </div>
    );
}

export function ProductUpdatesAdmin({ updates }: { updates: ProductUpdate[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState<UpdateCategory>('announcement');
    const [createReason, setCreateReason] = useState('');
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [confirmReason, setConfirmReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

    const createValid = title.trim().length >= 3 && body.trim().length >= 3 && createReason.trim().length >= 3;
    const confirmValid = confirmReason.trim().length >= 3 && confirmed;

    const closeConfirm = () => {
        setConfirmAction(null);
        setConfirmReason('');
        setConfirmed(false);
        setConfirmError('');
    };

    const handleCreate = () => {
        if (!createValid || isPending) return;
        setFeedback(null);

        startTransition(async () => {
            const result = await createProductUpdateAdminAction({
                title: title.trim(),
                body: body.trim(),
                category,
                reason: createReason.trim(),
            });

            if (!result.success) {
                setFeedback({ tone: 'error', message: result.error });
                toast.error(result.error);
                return;
            }

            setTitle('');
            setBody('');
            setCategory('announcement');
            setCreateReason('');
            setFeedback({ tone: 'success', message: 'Draft saved. Review it below before publishing.' });
            toast.success('Product Update saved as a draft');
            router.refresh();
        });
    };

    const handleConfirmedAction = () => {
        if (!confirmAction || !confirmValid || isPending) return;
        setFeedback(null);
        setConfirmError('');

        startTransition(async () => {
            const input = { reason: confirmReason.trim(), confirmed: true };
            const result = confirmAction.type === 'publish'
                ? await publishProductUpdateAdminAction(confirmAction.update.id, input)
                : await deleteProductUpdateAdminAction(confirmAction.update.id, input);

            if (!result.success) {
                setConfirmError(result.error);
                toast.error(result.error);
                return;
            }

            const message = confirmAction.type === 'publish'
                ? 'Product Update published.'
                : 'Product Update deleted.';
            setFeedback({ tone: 'success', message });
            toast.success(message);
            closeConfirm();
            router.refresh();
        });
    };

    return (
        <div className="space-y-6">
            <Card className="border-border/70 bg-card shadow-sm">
                <CardHeader>
                    <CardTitle>New update</CardTitle>
                    <CardDescription>
                        Save a draft first. Publication is a separate reviewed and audited action.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground" htmlFor="product-update-title">Title</label>
                            <Input
                                id="product-update-title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="e.g., Branding fixes for packets + PDFs"
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground" htmlFor="product-update-category">Category</label>
                            <select
                                id="product-update-category"
                                value={category}
                                onChange={(event) => setCategory(event.target.value as UpdateCategory)}
                                disabled={isPending}
                                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:h-8"
                            >
                                <option value="announcement">Announcement</option>
                                <option value="feature">Feature</option>
                                <option value="bugfix">Bugfix</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground" htmlFor="product-update-body">Body</label>
                        <Textarea
                            id="product-update-body"
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            placeholder="Describe the customer-visible change. Plain text and new lines are preserved."
                            rows={7}
                            disabled={isPending}
                        />
                    </div>

                    <AdminActionReasonField
                        value={createReason}
                        onChange={setCreateReason}
                        disabled={isPending}
                        placeholder="Why is this Product Update draft being created?"
                    />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">New updates are not visible to customers until separately published.</p>
                        <Button type="button" onClick={handleCreate} disabled={!createValid || isPending}>
                            <Save className="h-4 w-4" />
                            {isPending && !confirmAction ? 'Saving draft...' : 'Save draft'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {feedback ? (
                <div
                    role={feedback.tone === 'error' ? 'alert' : 'status'}
                    className={feedback.tone === 'error'
                        ? 'rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
                        : 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200'}
                >
                    {feedback.message}
                </div>
            ) : null}

            <Card className="border-border/70 bg-card shadow-sm">
                <CardHeader>
                    <CardTitle>Recent updates</CardTitle>
                    <CardDescription>{updates.length} total, including drafts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {updates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No updates yet.</p>
                    ) : updates.map((update) => (
                        <article key={update.id} className="rounded-lg border border-border bg-background/40 p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-foreground">{update.title}</h3>
                                        <Badge className={categoryBadgeClass(update.category)}>{categoryLabel(update.category)}</Badge>
                                        {update.is_published ? <Badge variant="secondary">Published</Badge> : <Badge variant="outline">Draft</Badge>}
                                        <span className="text-xs text-muted-foreground">
                                            {update.is_published ? 'Published' : 'Created'} {formatAdminDate(update.is_published ? update.published_at : update.created_at)}
                                        </span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{update.body}</p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    {!update.is_published ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setConfirmError('');
                                                setConfirmAction({ type: 'publish', update });
                                            }}
                                            disabled={isPending}
                                            aria-label={`Preview and publish ${update.title}`}
                                        >
                                            <Megaphone className="h-4 w-4" />
                                            Publish
                                        </Button>
                                    ) : null}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => {
                                            setConfirmError('');
                                            setConfirmAction({ type: 'delete', update });
                                        }}
                                        disabled={isPending}
                                        aria-label={`Review deletion of ${update.title}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </article>
                    ))}
                </CardContent>
            </Card>

            <Dialog
                open={Boolean(confirmAction)}
                onOpenChange={(open) => {
                    if (!open && !isPending) closeConfirm();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    {confirmAction ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {confirmAction.type === 'publish' ? 'Preview and publish Product Update' : 'Confirm Product Update deletion'}
                                </DialogTitle>
                                <DialogDescription>
                                    {confirmAction.type === 'publish'
                                        ? 'Publishing makes this content visible in the customer dashboard.'
                                        : 'Deletion permanently removes this update. Review the exact record before continuing.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <UpdatePreview update={confirmAction.update} />
                                <AdminActionReasonField
                                    value={confirmReason}
                                    onChange={setConfirmReason}
                                    disabled={isPending}
                                    placeholder={confirmAction.type === 'publish'
                                        ? 'Why is this update ready to publish?'
                                        : 'Why should this update be deleted?'}
                                />
                                {confirmError ? (
                                    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                        {confirmError}
                                    </p>
                                ) : null}
                                <label className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={confirmed}
                                        onChange={(event) => setConfirmed(event.target.checked)}
                                        disabled={isPending}
                                        className="mt-0.5 h-4 w-4 accent-primary"
                                    />
                                    <span>
                                        {confirmAction.type === 'publish'
                                            ? 'I have reviewed this preview and confirm it should be visible to customers.'
                                            : 'I have reviewed this record and confirm it should be permanently deleted.'}
                                    </span>
                                </label>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={closeConfirm} disabled={isPending}>Cancel</Button>
                                <Button
                                    onClick={handleConfirmedAction}
                                    disabled={!confirmValid || isPending}
                                    variant={confirmAction.type === 'delete' ? 'destructive' : 'default'}
                                >
                                    {confirmAction.type === 'publish' ? <Eye className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                    {isPending
                                        ? confirmAction.type === 'publish' ? 'Publishing...' : 'Deleting...'
                                        : confirmAction.type === 'publish' ? 'Publish update' : 'Delete update'}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
