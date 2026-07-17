'use client';

import { Check, Copy, ExternalLink, Mail, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Compact readonly seller-link share bar. Pass only the callbacks that should
 * be rendered so onboarding and dashboard surfaces can share the same actions.
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
        <div className={cn('flex flex-col gap-2 xl:flex-row xl:items-center', className)}>
            <Input
                value={url}
                readOnly
                aria-label="Reusable seller link"
                className="min-w-0 bg-background/70 font-mono text-xs sm:text-sm xl:flex-1"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:shrink-0">
                <Button
                    type="button"
                    size="sm"
                    aria-label="Copy reusable seller link"
                    onClick={onCopyLink}
                    disabled={disabled}
                    className="min-h-11 active:scale-[0.98] sm:min-h-0"
                >
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
                {onCopySms ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label="Copy reusable seller link SMS message"
                        onClick={onCopySms}
                        className="min-h-11 active:scale-[0.98] sm:min-h-0"
                    >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        SMS
                    </Button>
                ) : null}
                {onOpenEmail ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label="Open email with reusable seller link"
                        onClick={onOpenEmail}
                        className="min-h-11 active:scale-[0.98] sm:min-h-0"
                    >
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                    </Button>
                ) : null}
                {onOpenLink ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label="Open reusable seller link"
                        onClick={onOpenLink}
                        className="min-h-11 active:scale-[0.98] sm:min-h-0"
                    >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
