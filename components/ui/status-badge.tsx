import { CheckCircle2, Clock, FileText, Lock, Send, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RequestStatus } from '@/types';

type StatusStyle = {
    label: string;
    color: string;
    icon: LucideIcon;
};

/**
 * Canonical status -> color/label/icon map. This is the single source of truth
 * for how a request status looks anywhere in the product (list, detail,
 * dashboard). Colors are semantic and intentionally distinct from the slate
 * `--primary` brand accent: submitted reads as success (emerald), in_progress
 * as pending (amber), sent as informational (blue), draft as neutral.
 */
export const STATUS_STYLES: Record<RequestStatus, StatusStyle> = {
    draft: {
        label: 'Draft',
        color: 'bg-muted text-muted-foreground border-border',
        icon: FileText,
    },
    sent: {
        label: 'Sent',
        color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        icon: Send,
    },
    in_progress: {
        label: 'In Progress',
        color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        icon: Clock,
    },
    submitted: {
        label: 'Submitted',
        color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        icon: CheckCircle2,
    },
};

export function getStatusStyle(status: string): StatusStyle {
    return STATUS_STYLES[status as RequestStatus] ?? STATUS_STYLES.draft;
}

export function StatusBadge({
    status,
    locked = false,
    responsive = false,
    className,
}: {
    status: string;
    /** When locked, keep the status color but swap the icon/label to a lock. */
    locked?: boolean;
    /** Show only the first word of the label below the `sm` breakpoint. */
    responsive?: boolean;
    className?: string;
}) {
    const style = getStatusStyle(status);
    const Icon = locked ? Lock : style.icon;
    const label = locked ? 'Locked' : style.label;

    return (
        <Badge variant="outline" className={cn(style.color, 'border', className)}>
            <Icon />
            {responsive ? (
                <>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.split(' ')[0]}</span>
                </>
            ) : (
                label
            )}
        </Badge>
    );
}
