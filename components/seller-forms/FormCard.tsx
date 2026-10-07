'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, CopyPlus, Eye, Link2, Lock, MoreHorizontal, Pause, Pencil, Play, Star } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MainLinkRename } from './BaseLinkEditor';
import { FormLinkEnding } from './FormLinkEnding';
import type { SavedSellerForm, SellerFormsResponse } from './types';

function summary(form: SavedSellerForm, isPaid: boolean) {
    const count = form.defaultUtilityCategories.length;
    return [
        `${count} ${count === 1 ? 'utility' : 'utilities'}`,
        form.collectHoaQuestions ? 'HOA questions' : null,
        form.defaultPacketMode === 'advanced' && isPaid ? 'Handoff sections' : null,
    ].filter(Boolean).join(' · ');
}

/** One saved form: its link, the main actions, and everything else in a menu. */
export function FormCard({ form, data, onlyForm, busy, onChanged, onDuplicate, onMakeDefault, onPause, onResume }: {
    form: SavedSellerForm;
    data: SellerFormsResponse;
    /** The workspace's single form: its link is the main link, so there is nothing else to explain. */
    onlyForm: boolean;
    busy: boolean;
    onChanged: () => Promise<void>;
    onDuplicate: (form: SavedSellerForm) => void;
    onMakeDefault: (form: SavedSellerForm) => void;
    onPause: (form: SavedSellerForm) => void;
    onResume: (form: SavedSellerForm) => void;
}) {
    const router = useRouter();
    const [renaming, setRenaming] = useState(false);
    const base = data.linkBase;
    const canRename = data.isPaid && base !== null && (onlyForm || form.linkSuffix !== null);
    async function copy() {
        try {
            await navigator.clipboard.writeText(form.url);
            toast.success('Link copied');
        } catch {
            toast.error('Unable to copy link');
        }
    }
    const item = 'cursor-pointer';
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                    <span className="break-words">{form.name}</span>
                    {form.isDefault && !onlyForm && (
                        <Badge variant="outline">Default</Badge>
                    )}
                    {!form.isActive && (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            Paused
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription>{summary(form, data.isPaid)}</CardDescription>
                <CardAction>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            aria-label={`More actions for ${form.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem className={item} onClick={() => router.push(`/dashboard/forms/${form.id}?preview=1`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className={item} onClick={() => onDuplicate(form)}>
                                <CopyPlus className="mr-2 h-4 w-4" />
                                Duplicate
                                {data.capabilities.upgradeRequired && <Badge variant="secondary" className="ml-auto">Pro</Badge>}
                            </DropdownMenuItem>
                            {canRename ? (
                                <DropdownMenuItem className={item} onClick={() => setRenaming(true)}>
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Rename link
                                </DropdownMenuItem>
                            ) : base && !data.isPaid ? (
                                <DropdownMenuItem className="cursor-pointer text-muted-foreground" onClick={() => router.push('/dashboard/settings?tab=billing')}>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Rename link
                                    <Badge variant="secondary" className="ml-auto">Upgrade</Badge>
                                </DropdownMenuItem>
                            ) : null}
                            {!form.isDefault && (
                                <DropdownMenuItem className={item} disabled={busy} onClick={() => onMakeDefault(form)}>
                                    <Star className="mr-2 h-4 w-4" />
                                    Make default
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {form.isActive ? (
                                <DropdownMenuItem className={item} disabled={busy} onClick={() => onPause(form)}>
                                    <Pause className="mr-2 h-4 w-4" />
                                    Pause form
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem className={item} disabled={busy} onClick={() => onResume(form)}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Resume form
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1">
                    <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{form.url}</p>
                    {!onlyForm && form.endingUrl && form.endingUrl !== form.url && (
                        <p className="break-all text-xs text-muted-foreground">
                            This is your main link. This form&apos;s own link is {form.endingUrl}
                        </p>
                    )}
                </div>
                {renaming && base && (onlyForm ? (
                    <MainLinkRename base={base} onSaved={onChanged} onClose={() => setRenaming(false)} />
                ) : (
                    <FormLinkEnding form={form} mainUrl={base.url} onSaved={onChanged} onClose={() => setRenaming(false)} />
                ))}
                {!form.isActive && (
                    <p className="text-sm text-muted-foreground">
                        Paused, so new sellers cannot start this form.
                        Sellers who already started can still finish.
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    {form.isActive ? (
                        <Button onClick={copy}>
                            <Copy />
                            Copy link
                        </Button>
                    ) : (
                        <>
                            <Button disabled={busy} onClick={() => onResume(form)}>
                                <Play />
                                Resume form
                            </Button>
                            <Button variant="outline" disabled>
                                <Copy />
                                Copy link
                            </Button>
                        </>
                    )}
                    <Link
                        className={buttonVariants({ variant: 'outline' })}
                        href={`/dashboard/forms/${form.id}`}
                    >
                        <Pencil />
                        Edit
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
