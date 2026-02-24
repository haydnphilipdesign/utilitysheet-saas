import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AdminPageHeader(props: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{props.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
            </div>
            {props.action ? <div>{props.action}</div> : null}
        </div>
    );
}

type AdminStat = {
    label: string;
    value: string;
    hint?: string;
    icon?: LucideIcon;
};

export function AdminStatStrip({ stats }: { stats: AdminStat[] }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
                <Card key={stat.label} className="border-border/70 bg-card/70 backdrop-blur">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground/90">
                            {stat.label}
                        </CardDescription>
                        <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                            {stat.icon ? <stat.icon className="h-4 w-4 text-muted-foreground" /> : null}
                            {stat.value}
                        </CardTitle>
                    </CardHeader>
                    {stat.hint ? (
                        <CardContent>
                            <p className="text-xs text-muted-foreground">{stat.hint}</p>
                        </CardContent>
                    ) : null}
                </Card>
            ))}
        </div>
    );
}

export function AdminFilterBar({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'sticky top-[4.5rem] z-20 rounded-lg border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur',
                className
            )}
        >
            {children}
        </div>
    );
}

export function AdminDataTableShell({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-xl border border-border/70 bg-card/60 shadow-sm backdrop-blur', className)}>
            {children}
        </div>
    );
}

export function AdminEmptyState(props: { title: string; description: string; icon?: LucideIcon }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            {props.icon ? <props.icon className="h-10 w-10 text-muted-foreground/60" /> : null}
            <h3 className="text-base font-semibold text-foreground">{props.title}</h3>
            <p className="max-w-sm text-sm text-muted-foreground">{props.description}</p>
        </div>
    );
}

function PagerLink({
    href,
    disabled,
    icon,
    label,
}: {
    href: string;
    disabled: boolean;
    icon: ReactNode;
    label: string;
}) {
    return (
        <Link
            href={href}
            aria-disabled={disabled}
            className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                disabled ? 'pointer-events-none opacity-50' : ''
            )}
        >
            {icon}
            <span className="sr-only">{label}</span>
        </Link>
    );
}

export function AdminPagination(props: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    prevHref: string;
    nextHref: string;
    buildPageSizeHref: (size: number) => string;
    pageSizes?: readonly number[];
}) {
    const pageSizes = props.pageSizes ?? [25, 50, 100];

    return (
        <div className="flex flex-col gap-3 border-t border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
                Showing page {props.page} of {props.totalPages} • {props.total} total
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background/60 p-1">
                    {pageSizes.map((size) => (
                        <Link
                            key={size}
                            href={props.buildPageSizeHref(size)}
                            className={cn(
                                'rounded px-2 py-1 text-xs font-medium transition-colors',
                                size === props.pageSize
                                    ? 'bg-secondary text-foreground'
                                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                            )}
                        >
                            {size}/page
                        </Link>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <PagerLink
                        href={props.prevHref}
                        disabled={props.page <= 1}
                        icon={<ChevronLeft className="h-4 w-4" />}
                        label="Previous page"
                    />
                    <PagerLink
                        href={props.nextHref}
                        disabled={props.page >= props.totalPages}
                        icon={<ChevronRight className="h-4 w-4" />}
                        label="Next page"
                    />
                </div>
            </div>
        </div>
    );
}
