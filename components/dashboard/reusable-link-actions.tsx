'use client';

import { Check, Copy, ExternalLink, Mail, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The readonly seller-link field plus its action buttons (Copy Link / Copy SMS
 * / Open Email / Open Link). This is the block that was duplicated across the
 * onboarding card and the two dashboard reusable-link cards. The primary
 * "Copy Link" action routes through the shared <Button> (default = primary
 * accent); the secondary actions are outline. Pass only the callbacks you want
 * rendered, so a minimal surface (just Copy) and the full four-button surface
 * share one implementation.
 */
export function ReusableLinkActions({
    url,
    copied,
    onCopyLink,
    onCopySms,
    onOpenEmail,
    onOpenLink,
    disabled = false,
    className,
}: {
    url: string;
    copied: boolean;
    onCopyLink: () => void;
    onCopySms?: () => void;
    onOpenEmail?: () => void;
    onOpenLink?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-2 lg:flex-row lg:items-center', className)}>
            <Input value={url} readOnly className="bg-background/70 font-mono text-xs sm:text-sm" />
            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                <Button type="button" onClick={onCopyLink} disabled={disabled} className="active:scale-[0.98]">
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy Link'}
                </Button>
                {onCopySms ? (
                    <Button type="button" variant="outline" onClick={onCopySms} className="active:scale-[0.98]">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Copy SMS
                    </Button>
                ) : null}
                {onOpenEmail ? (
                    <Button type="button" variant="outline" onClick={onOpenEmail} className="active:scale-[0.98]">
                        <Mail className="mr-2 h-4 w-4" />
                        Open Email
                    </Button>
                ) : null}
                {onOpenLink ? (
                    <Button type="button" variant="outline" onClick={onOpenLink} className="active:scale-[0.98]">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Link
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
