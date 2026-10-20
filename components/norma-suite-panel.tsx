'use client';

import { useSyncExternalStore } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { buildSuiteUrl, suiteLinks } from '@/lib/norma-suite';

const DASHBOARD_STRIP_DISMISSED_KEY = 'utilitysheet:norma-suite-strip-dismissed';
const DASHBOARD_STRIP_DISMISSED_EVENT = 'utilitysheet:norma-suite-strip-dismissed-change';

function getDashboardStripDismissed() {
    try {
        return localStorage.getItem(DASHBOARD_STRIP_DISMISSED_KEY) === 'true';
    } catch {
        return false;
    }
}

function subscribeToDashboardStripDismissal(onStoreChange: () => void) {
    window.addEventListener('storage', onStoreChange);
    window.addEventListener(DASHBOARD_STRIP_DISMISSED_EVENT, onStoreChange);

    return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener(DASHBOARD_STRIP_DISMISSED_EVENT, onStoreChange);
    };
}

// Dismissible dashboard banner for the wider Norma Suite. The marketing footer
// uses a single text link instead (components/marketing/marketing-chrome.tsx).
export function NormaSuitePanel() {
    const stripDismissed = useSyncExternalStore(
        subscribeToDashboardStripDismissal,
        getDashboardStripDismissed,
        () => false
    );

    const dismissStrip = () => {
        try {
            localStorage.setItem(DASHBOARD_STRIP_DISMISSED_KEY, 'true');
        } catch {
            // The dismissal still applies for this session if storage is unavailable.
        }
        window.dispatchEvent(new Event(DASHBOARD_STRIP_DISMISSED_EVENT));
    };

    if (stripDismissed) {
        return null;
    }

    return (
        <div className="relative rounded-2xl border border-border/70 bg-card/70 px-4 py-4 pr-12 backdrop-blur-sm">
            <button
                type="button"
                aria-label="Dismiss Part of Norma banner"
                onClick={dismissStrip}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                        Part of Norma
                    </p>
                    <p className="text-sm text-muted-foreground">
                        UtilitySheet picks up after intake. If you want help with intake too, Norma Intake is live now.
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
