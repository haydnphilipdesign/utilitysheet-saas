import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared product page header: a title, an optional supporting description, and
 * an optional actions slot on the right. Mirrors the repeated
 * `flex-col sm:flex-row ... justify-between` header used across the dashboard,
 * requests, settings, and branding pages. Admin pages use `AdminPageHeader`.
 */
export function PageHeader({
    title,
    description,
    actions,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
                {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{actions}</div> : null}
        </div>
    );
}
