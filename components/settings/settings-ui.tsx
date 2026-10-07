'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** One Settings card: a title, a one-line description, then the controls. */
export function SettingsSection({ icon: Icon, title, description, children }: {
    icon?: LucideIcon;
    title: string;
    description: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">{children}</CardContent>
        </Card>
    );
}

/** Save feedback shown next to the control it belongs to. */
export function InlineStatus({ tone = 'muted', children, className }: {
    tone?: 'muted' | 'saving' | 'saved' | 'error';
    children: ReactNode;
    className?: string;
}) {
    if (tone === 'error') {
        return <p role="alert" className={cn('text-sm text-destructive', className)}>{children}</p>;
    }
    return (
        <p role="status" className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)}>
            {tone === 'saving' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
            {tone === 'saved' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
            {children}
        </p>
    );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive">{message}</p>
            {onRetry && (
                <Button variant="outline" onClick={onRetry}>
                    Try again
                </Button>
            )}
        </div>
    );
}

export function LoadingRows({ label, rows = 2 }: { label: string; rows?: number }) {
    return (
        <div role="status" className="space-y-3">
            <span className="sr-only">{label}</span>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-12" />
            ))}
        </div>
    );
}

/** A quiet note explaining why something is read-only or unavailable. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={cn('rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground', className)}>
            {children}
        </p>
    );
}
