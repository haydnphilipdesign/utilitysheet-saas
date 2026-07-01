import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Shared empty-state block: an optional icon in a muted circle, a heading, a
 * supporting line, and an optional action slot (usually one or two Buttons).
 * Use this instead of hand-rolling "no data" markup so every empty state in the
 * product reads the same. For admin surfaces use `AdminEmptyState`.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center', className)}>
            {Icon ? (
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
            ) : null}
            <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            {action ? <div className="mt-6 flex flex-col gap-2 sm:flex-row">{action}</div> : null}
        </div>
    );
}
