'use client';

import { CheckCircle2, RefreshCw } from 'lucide-react';
import { wizardPrimaryButton } from '../wizard-ui';

// Contact details are shown by SellerLayout's footer, so only the name is used here.
interface BrandContact {
    name?: string;
}

interface SellerStatusNoticeProps {
    /**
     * submitted: the form was already sent and is read-only.
     * stale: the form changed after this page was opened (the agent reopened or
     *   closed it), so this page's answers can no longer be sent.
     */
    kind: 'submitted' | 'stale';
    address?: string;
    brandProfile?: BrandContact | null;
}

export function SellerStatusNotice({ kind, address, brandProfile }: SellerStatusNoticeProps) {
    const agent = brandProfile?.name || 'your real estate team';

    return (
        <div
            className="flex flex-col items-center justify-center flex-1 text-center space-y-6 py-6 sm:py-10 px-2"
            data-testid={`seller-notice-${kind}`}
        >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--brand-accent-soft)] flex items-center justify-center ring-1 ring-border">
                {kind === 'submitted'
                    ? <CheckCircle2 className="h-9 w-9 sm:h-11 sm:w-11 text-[color:var(--brand-accent)]" aria-hidden="true" />
                    : <RefreshCw className="h-9 w-9 sm:h-11 sm:w-11 text-[color:var(--brand-accent)]" aria-hidden="true" />}
            </div>

            <div className="space-y-3 max-w-md w-full">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {kind === 'submitted' ? 'Already submitted' : 'This form was updated'}
                </h2>
                {kind === 'submitted' ? (
                    <>
                        <p className="text-sm sm:text-base text-muted-foreground">
                            The utility details{address ? ` for ${address}` : ''} have been sent. There is nothing more to do here.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Need to change something? Ask {agent} to reopen the form for you.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-sm sm:text-base text-muted-foreground">
                            This page was opened before the form changed, so it can&apos;t be sent from here. Reload to see the current version.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            data-testid="seller-notice-reload"
                            className={`w-full py-3 text-sm sm:text-base ${wizardPrimaryButton}`}
                        >
                            Reload
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
