'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, Wrench } from 'lucide-react';
import { checkMaintenanceStatus, formatExpectedBack, type MaintenanceNotice as Notice } from '@/lib/maintenance/client';

/** Whether this browser is actually holding the seller's answers. */
export type DraftStorageState = 'saved' | 'unavailable' | 'none';

/**
 * Says only what is true for this browser: answers are kept locally on a best
 * effort, never on the server before they are sent.
 */
export function draftGuidance(state: DraftStorageState): string | null {
    if (state === 'saved') {
        return 'Your answers so far are stored in this browser on this device, not on our servers. If you come back in this same browser they should still be here. A different device, a private window or cleared browsing data will not have them.';
    }
    if (state === 'unavailable') {
        return 'This browser is not letting us store your answers on this device. Keep this page open so they stay on the screen. If you close or reload it, you would need to enter them again.';
    }
    return null;
}

export function expectedBackSentence(notice: Notice | null | undefined): string | null {
    const time = formatExpectedBack(notice?.expectedBackAt);
    return time ? `We expect to be back around ${time}.` : null;
}

interface MaintenanceNoticeProps {
    /** screen: stands in for the page. banner: sits above content that stays usable. */
    variant: 'screen' | 'banner';
    title: string;
    children: ReactNode;
    notice: Notice | null;
    /** Called once the status endpoint says the pause is over. Nothing is resent on the person's behalf. */
    onReopened: () => void;
    /** A refused action is announced at once; a passive notice waits its turn. */
    urgent?: boolean;
    testId?: string;
}

export function MaintenanceNotice({ variant, title, children, notice, onReopened, urgent = false, testId = 'maintenance-notice' }: MaintenanceNoticeProps) {
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<'paused' | 'unknown' | null>(null);
    const expected = expectedBackSentence(notice);

    const handleCheck = async () => {
        setChecking(true);
        setResult(null);
        const check = await checkMaintenanceStatus();
        setChecking(false);
        if (check.state === 'open') {
            onReopened();
            return;
        }
        setResult(check.state);
    };

    const feedback = (
        <p aria-live="polite" className="text-xs text-muted-foreground min-h-4" data-testid={`${testId}-check-result`}>
            {result === 'paused' && 'Still paused. Thank you for your patience.'}
            {result === 'unknown' && 'We couldn’t check just now. Please try again in a moment.'}
        </p>
    );
    const spinner = checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null;

    if (variant === 'screen') {
        return (
            <div className="flex-1 flex items-center justify-center" data-testid={testId}>
                <div
                    role={urgent ? 'alert' : 'status'}
                    className="w-full max-w-md bg-card/60 border border-border rounded-2xl p-6 sm:p-8 text-center space-y-5"
                >
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Wrench className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-xl font-bold text-foreground">{title}</h1>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            {children}
                            {expected && <p className="text-foreground font-medium">{expected}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={handleCheck}
                            disabled={checking}
                            data-testid={`${testId}-check`}
                            className="inline-flex min-h-11 items-center justify-center gap-2 px-6 py-2.5 bg-foreground text-background font-medium rounded-full text-sm hover:opacity-90 transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {spinner}
                            Check again
                        </button>
                        {feedback}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            role={urgent ? 'alert' : 'status'}
            data-testid={testId}
            className="rounded-xl border border-border bg-muted/50 p-4 flex items-start gap-3 text-left"
        >
            <Wrench className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm text-foreground font-medium">{title}</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                    {children}
                    {expected && <p className="text-foreground">{expected}</p>}
                </div>
                <button
                    type="button"
                    onClick={handleCheck}
                    disabled={checking}
                    data-testid={`${testId}-check`}
                    className="inline-flex min-h-11 sm:min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    {spinner}
                    Check again
                </button>
                {feedback}
            </div>
        </div>
    );
}
