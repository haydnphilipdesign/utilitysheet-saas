'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buildSuiteUrl, suiteLinks } from '@/lib/norma-suite';

type Variant = 'footer' | 'strip';

type NormaSuitePanelProps = {
    variant: Variant;
};

const products = [
    {
        id: 'norma-intake',
        name: 'Norma Intake',
        description: 'Contract-first intake for cleaner handoffs before utility setup starts.',
        status: 'Live',
        href: suiteLinks.intake,
    },
    {
        id: 'utilitysheet',
        name: 'UtilitySheet by Norma',
        description: 'One seller link for polished utility coordination and clean closing packets.',
        status: 'Live',
        href: suiteLinks.utilitysheet,
    },
    {
        id: 'normatc',
        name: 'NormaTC',
        description: 'Full transaction coordination hub opening to private beta soon.',
        status: 'Private beta soon',
        href: suiteLinks.normatc,
    },
] as const;

function statusClasses(status: string) {
    return status === 'Live'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

export function NormaSuitePanel({ variant }: NormaSuitePanelProps) {
    if (variant === 'strip') {
        return (
            <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-4 backdrop-blur-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                            Part of Norma
                        </p>
                        <p className="text-sm text-muted-foreground">
                            UtilitySheet fits after intake. If you want the upstream handoff too, Norma Intake is live now.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={buildSuiteUrl(suiteLinks.intake, 'utilitysheet_dashboard_strip')}
                            className="inline-flex min-h-10 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
                        >
                            Explore Norma Intake
                        </a>
                        <a
                            href={buildSuiteUrl(suiteLinks.productsHub, 'utilitysheet_dashboard_strip')}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90"
                        >
                            Explore the suite
                            <ArrowRight className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section className="mt-10 rounded-3xl border border-border/70 bg-muted/30 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Part of Norma
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">Explore the rest of the suite</h3>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Norma keeps each tool focused. Intake handles the front-end handoff, UtilitySheet handles utility coordination, and NormaTC is opening to private beta as the transaction hub.
                    </p>
                </div>
                <a
                    href={buildSuiteUrl(suiteLinks.productsHub, 'utilitysheet_footer')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-emerald-600"
                >
                    Explore the suite
                    <ArrowRight className="h-4 w-4" />
                </a>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
                {products.map((product) => {
                    const isCurrent = product.id === 'utilitysheet';
                    return (
                        <article
                            key={product.id}
                            className={`rounded-2xl border p-4 ${isCurrent ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border/70 bg-background/90'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{product.name}</p>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                                </div>
                                <Badge variant="outline" className={statusClasses(product.status)}>
                                    {product.status}
                                </Badge>
                            </div>
                            <div className="mt-4">
                                {isCurrent ? (
                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">You&apos;re here</span>
                                ) : (
                                    <a
                                        href={buildSuiteUrl(product.href, `utilitysheet_footer_${product.id}`)}
                                        className="text-sm font-semibold text-foreground underline decoration-border underline-offset-4 transition hover:text-emerald-600"
                                    >
                                        Learn more
                                    </a>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
