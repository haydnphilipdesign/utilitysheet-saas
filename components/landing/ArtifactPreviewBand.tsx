import { CheckCircle2, FileText, Link2, Smartphone } from 'lucide-react';

import { UtilitySheetPreview } from '@/components/landing/UtilitySheetPreview';

const workflowArtifacts = [
    {
        icon: Link2,
        title: 'Reusable seller link',
        copy: 'Add it to your listing email, text template, transaction checklist, or signature once.',
    },
    {
        icon: Smartphone,
        title: 'Phone-friendly seller flow',
        copy: 'Sellers enter the property address, confirm suggested providers when available, or type their own answers.',
    },
    {
        icon: FileText,
        title: 'Buyer-ready utility sheet',
        copy: 'Review the finished web sheet, make Pro/Team edits if needed, and download the clean PDF.',
    },
] as const;

export function ArtifactPreviewBand() {
    return (
        <section className="border-y border-border/50 bg-muted/25 px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
            <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
                        What UtilitySheet replaces
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
                        One link in, one clean utility handoff out.
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                        UtilitySheet is not another transaction platform. It handles the small, repeated closing task that still turns into texts, blank forms, inconsistent answers, and last-minute cleanup.
                    </p>

                    <div className="mt-8 space-y-5">
                        {workflowArtifacts.map((item) => (
                            <div key={item.title} className="flex gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
                                    <item.icon className="h-5 w-5 text-slate-600" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 inline-flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                            Make utility collection a repeatable TC workflow instead of a one-off message thread on every file.
                        </span>
                    </div>
                </div>

                <div className="relative min-h-[460px] overflow-hidden rounded-lg border border-border bg-background/70 shadow-2xl shadow-slate-950/10">
                    <div className="absolute inset-x-0 top-0 border-b border-border bg-muted/45 px-4 py-3">
                        <div className="flex items-center justify-between gap-4 text-xs font-semibold text-muted-foreground">
                            <span>Finished utility handoff</span>
                            <span>Ready to review and share</span>
                        </div>
                    </div>
                    <div className="pt-12">
                        <UtilitySheetPreview />
                    </div>
                </div>
            </div>
        </section>
    );
}
