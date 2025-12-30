'use client';

import { useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Mail, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmailVerificationBanner() {
    const user = useUser();
    const [dismissed, setDismissed] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Don't show if user is not loaded, already verified, or banner dismissed
    if (!user || user.primaryEmailVerified || dismissed) {
        return null;
    }

    const handleResendVerification = async () => {
        setSending(true);
        setError(null);
        try {
            await user.sendVerificationEmail();
            setSent(true);
        } catch (err: any) {
            if (err?.message?.includes('EmailAlreadyVerified')) {
                // Email was verified in the meantime
                setSent(true);
            } else {
                setError('Failed to send. Try again later.');
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="relative mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <Mail className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-500">
                        Verify your email
                    </p>
                    <p className="text-sm text-amber-500/80 mt-0.5">
                        Verify <span className="font-medium">{user.primaryEmail}</span> to ensure you never lose access to your account.
                    </p>
                    {error && (
                        <p className="text-xs text-red-400 mt-1">{error}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {sent ? (
                        <span className="flex items-center gap-1 text-sm text-green-500">
                            <CheckCircle2 className="h-4 w-4" />
                            Sent!
                        </span>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/20"
                            onClick={handleResendVerification}
                            disabled={sending}
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Resend email'
                            )}
                        </Button>
                    )}
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-amber-500/60 hover:text-amber-500 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
