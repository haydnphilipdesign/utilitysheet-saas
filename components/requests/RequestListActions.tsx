'use client';

import Link from 'next/link';
import {
    Copy,
    Download,
    ExternalLink,
    Eye,
    FilePenLine,
    Loader2,
    Mail,
    MoreHorizontal,
    Play,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Request } from '@/types';

type RequestListActionsProps = {
    request: Request;
    layout: 'desktop' | 'mobile';
    onCopySellerLink: (request: Request) => void;
    onSendReminder: (request: Request) => void;
    onDownloadPdf: (request: Request) => void;
    sendingReminder: boolean;
    downloadingPdf: boolean;
};

function ActionLink({
    href,
    children,
    variant = 'outline',
    className,
    target,
}: {
    href: string;
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'ghost';
    className?: string;
    target?: '_blank';
}) {
    return (
        <Link
            href={href}
            target={target}
            rel={target === '_blank' ? 'noopener noreferrer' : undefined}
            className={cn(buttonVariants({ variant, size: 'sm' }), className)}
        >
            {children}
        </Link>
    );
}

function PrimaryAction({
    request,
    onCopySellerLink,
}: Pick<RequestListActionsProps, 'request' | 'onCopySellerLink'>) {
    const detailsHref = `/dashboard/requests/${request.id}`;
    const isLocked = Boolean(request.is_locked);

    if (isLocked) {
        return (
            <ActionLink href={detailsHref}>
                <Eye />
                View
            </ActionLink>
        );
    }

    if (request.status === 'draft') {
        return (
            <ActionLink href={detailsHref}>
                <Play />
                Continue
            </ActionLink>
        );
    }

    if (request.status === 'sent' || request.status === 'in_progress') {
        return (
            <Button
                type="button"
                size="sm"
                onClick={() => onCopySellerLink(request)}
                disabled={!request.seller_token && !request.public_token}
            >
                <Copy />
                Copy seller link
            </Button>
        );
    }

    return (
        <ActionLink href={detailsHref}>
            <Eye />
            Review
        </ActionLink>
    );
}

export function RequestListActions({
    request,
    layout,
    onCopySellerLink,
    onSendReminder,
    onDownloadPdf,
    sendingReminder,
    downloadingPdf,
}: RequestListActionsProps) {
    const isLocked = Boolean(request.is_locked);
    const detailsHref = `/dashboard/requests/${request.id}`;
    const canRemind = !isLocked
        && (request.status === 'sent' || request.status === 'in_progress')
        && Boolean(request.seller_email);
    const canOpenPacket = !isLocked && request.status === 'submitted' && Boolean(request.public_token);

    if (layout === 'mobile') {
        return (
            <div className="flex flex-wrap items-center gap-2">
                <PrimaryAction request={request} onCopySellerLink={onCopySellerLink} />

                {!isLocked && (request.status === 'sent' || request.status === 'in_progress') ? (
                    <ActionLink href={detailsHref} variant="ghost">
                        <Eye />
                        Details
                    </ActionLink>
                ) : null}

                {canRemind ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onSendReminder(request)}
                        disabled={sendingReminder}
                    >
                        {sendingReminder ? <Loader2 className="animate-spin" /> : <Mail />}
                        {sendingReminder ? 'Sending…' : 'Send reminder'}
                    </Button>
                ) : null}

                {canOpenPacket ? (
                    <>
                        <ActionLink
                            href={`/packet/${request.public_token}`}
                            target="_blank"
                            variant="ghost"
                        >
                            <ExternalLink />
                            Open packet
                        </ActionLink>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onDownloadPdf(request)}
                            disabled={downloadingPdf}
                        >
                            {downloadingPdf ? <Loader2 className="animate-spin" /> : <Download />}
                            {downloadingPdf ? 'Generating…' : 'Download PDF'}
                        </Button>
                    </>
                ) : null}

                {!isLocked && request.can_edit_submitted_sheet ? (
                    <ActionLink href={`/dashboard/requests/${request.id}/edit`} variant="ghost">
                        <FilePenLine />
                        Edit submitted sheet
                    </ActionLink>
                ) : null}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-end gap-2">
            <PrimaryAction request={request} onCopySellerLink={onCopySellerLink} />
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={`More actions for ${request.property_address}`}
                    className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-border bg-popover">
                    <DropdownMenuItem
                        className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
                        onClick={() => window.location.assign(detailsHref)}
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        View details
                    </DropdownMenuItem>

                    {!isLocked && request.status !== 'sent' && request.status !== 'in_progress' ? (
                        <DropdownMenuItem
                            className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
                            onClick={() => onCopySellerLink(request)}
                            disabled={!request.seller_token && !request.public_token}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy seller link
                        </DropdownMenuItem>
                    ) : null}

                    {canRemind ? (
                        <DropdownMenuItem
                            className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
                            onClick={() => onSendReminder(request)}
                            disabled={sendingReminder}
                        >
                            {sendingReminder
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <Mail className="mr-2 h-4 w-4" />}
                            {sendingReminder ? 'Sending…' : 'Send reminder'}
                        </DropdownMenuItem>
                    ) : null}

                    {canOpenPacket ? (
                        <>
                            <DropdownMenuItem
                                className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
                                onClick={() => window.open(`/packet/${request.public_token}`, '_blank', 'noopener,noreferrer')}
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open packet
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
                                onClick={() => onDownloadPdf(request)}
                                disabled={downloadingPdf}
                            >
                                {downloadingPdf
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <Download className="mr-2 h-4 w-4" />}
                                {downloadingPdf ? 'Generating…' : 'Download PDF'}
                            </DropdownMenuItem>
                        </>
                    ) : null}

                    {!isLocked && request.can_edit_submitted_sheet ? (
                        <DropdownMenuItem
                            className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
                            onClick={() => window.location.assign(`/dashboard/requests/${request.id}/edit`)}
                        >
                            <FilePenLine className="mr-2 h-4 w-4" />
                            Edit submitted sheet
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
