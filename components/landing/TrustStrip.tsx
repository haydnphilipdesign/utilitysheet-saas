import Link from 'next/link';
import { Building2, Users, Award, MapPin } from 'lucide-react';

export function TrustStrip() {
    return (
        <section className="border-y border-border/50 bg-muted/20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    {/* Value Props */}
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            <span>Built for real estate TCs</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span>By transaction coordinators</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Award className="w-4 h-4 text-slate-500" />
                            <span>Free plan available</span>
                        </div>
                    </div>

                    {/* Company Info */}
                    <div className="flex items-center justify-center lg:justify-end gap-4">
                        <img
                            src="/pa-real-estate-support.png"
                            alt="PA Real Estate Support Services, LLC"
                            className="h-8 w-auto dark:brightness-110"
                        />
                        <div className="text-sm">
                            <div className="font-semibold text-foreground leading-tight">PA Real Estate Support Services, LLC</div>
                            <div className="text-muted-foreground leading-tight flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                The TC business that inspired UtilitySheet
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
