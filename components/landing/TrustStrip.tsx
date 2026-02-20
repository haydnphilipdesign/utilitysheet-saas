import { Clock, Smartphone, FileCheck, Plug } from 'lucide-react';

export function TrustStrip() {
    return (
        <section className="border-y border-border/50 bg-muted/20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    {/* Value Props */}
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span>Sellers finish in ~2 minutes</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Smartphone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span>No seller login or app required</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span>Web sheet + PDF output, ready to share</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Plug className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span>Works alongside Dotloop, Skyslope &amp; Brokermint</span>
                        </div>
                    </div>

                    {/* Company Credibility */}
                    <div className="flex items-center justify-center lg:justify-end gap-4 flex-shrink-0">
                        <img
                            src="/pa-real-estate-support.png"
                            alt="PA Real Estate Support Services, LLC"
                            className="h-8 w-auto dark:brightness-110"
                        />
                        <div className="text-sm">
                            <div className="font-semibold text-foreground leading-tight">PA Real Estate Support Services, LLC</div>
                            <div className="text-muted-foreground leading-tight text-xs mt-0.5">
                                The TC business that inspired and uses UtilitySheet
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
