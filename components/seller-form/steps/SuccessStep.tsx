'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Rocket, ArrowRight, FileDown, Loader2, Mail, Phone, Send, Check } from 'lucide-react';
import Link from 'next/link';
import type { WizardState } from '../SellerWizard';
import { trackEvent } from '@/lib/analytics/events';

interface BrandContact {
    name?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

interface SuccessStepProps {
    isDemo?: boolean;
    demoData?: {
        address: string;
        state: WizardState;
    };
    brandProfile?: BrandContact | null;
    sellerToken?: string;
    propertyAddress?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SuccessStep({ isDemo = false, demoData, brandProfile, sellerToken, propertyAddress }: SuccessStepProps) {
    const [downloading, setDownloading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState('');
    const [confirmSubmitting, setConfirmSubmitting] = useState(false);
    const [confirmSent, setConfirmSent] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    const handleSendConfirmation = async () => {
        if (!sellerToken) return;
        const trimmed = confirmEmail.trim();
        if (!EMAIL_PATTERN.test(trimmed)) {
            setConfirmError('Please enter a valid email.');
            return;
        }
        setConfirmSubmitting(true);
        setConfirmError(null);
        try {
            const res = await fetch(`/api/seller/${encodeURIComponent(sellerToken)}/send-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed }),
            });
            if (res.ok) {
                setConfirmSent(true);
                trackEvent('seller_success_email_confirmation_requested', { success: true, location: 'seller_flow' });
            } else {
                const body = await res.json().catch(() => null);
                setConfirmError(body?.error || 'Could not send. Please try again.');
                trackEvent('seller_success_email_confirmation_requested', { success: false, location: 'seller_flow' });
            }
        } catch {
            setConfirmError('Network error. Please try again.');
            trackEvent('seller_success_email_confirmation_requested', { success: false, location: 'seller_flow' });
        } finally {
            setConfirmSubmitting(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!demoData) return;

        setDownloading(true);
        try {
            const { generateDemoPdf } = await import('@/lib/demo-pdf-generator');
            await generateDemoPdf(demoData);
            setDownloaded(true);
        } catch (err) {
            console.error('Failed to generate demo PDF:', err);
        } finally {
            setDownloading(false);
        }
    };

    if (isDemo) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center flex-1 text-center space-y-6 sm:space-y-8 py-6 sm:py-10 px-2"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl relative z-10">
                        <Rocket className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
                    </div>
                </div>

                <div className="space-y-4 max-w-md w-full">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                        That&apos;s How Easy It Is!
                    </h2>
                    <div className="p-3 sm:p-4 bg-slate-500/10 border border-slate-500/20 rounded-xl">
                        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base">
                            Your sellers complete this in under 2 minutes. You get a
                            <span className="font-semibold text-foreground"> branded PDF</span> with all their utility info.
                        </p>
                    </div>

                    {/* Demo PDF Download */}
                    {demoData && (
                        <button
                            onClick={handleDownloadPdf}
                            disabled={downloading}
                            className="w-full py-3 sm:py-3.5 px-4 sm:px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-amber-600 disabled:to-orange-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] text-sm sm:text-base"
                        >
                            {downloading ? (
                                <>
                                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                    <span className="hidden sm:inline">Generating Preview PDF...</span>
                                    <span className="sm:hidden">Generating...</span>
                                </>
                            ) : downloaded ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <span className="hidden sm:inline">Downloaded! Check your downloads</span>
                                    <span className="sm:hidden">Downloaded!</span>
                                </>
                            ) : (
                                <>
                                    <FileDown className="h-4 w-4 sm:h-5 sm:w-5" />
                                    Download Sample PDF
                                </>
                            )}
                        </button>
                    )}

                    <p className="text-xs text-muted-foreground">
                        {downloaded ? 'The PDF includes a demo watermark' : 'See what your buyers receive'}
                    </p>

                    <div className="pt-3 sm:pt-4 border-t border-border">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                            Ready to use this for your own transactions?
                        </p>
                        <Link
                            href="/auth/signup"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 sm:py-4 px-4 sm:px-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-900/30 text-base sm:text-lg active:scale-[0.98]"
                        >
                            Get Started Free
                            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Link>
                    </div>

                    <Link
                        href="/"
                        className="block text-xs sm:text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                        Back to home
                    </Link>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center flex-1 text-center space-y-6 sm:space-y-8 py-6 sm:py-10 px-2"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-2xl relative z-10">
                    <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
                </div>
            </div>

            <div className="space-y-5 max-w-md w-full">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    All Done!
                </h2>
                <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-left">
                    <p className="text-emerald-700 dark:text-emerald-300 text-sm sm:text-base">
                        Thank you{propertyAddress ? ` for sharing utility details for ${propertyAddress}` : ''}.{' '}
                        {brandProfile?.name ? `${brandProfile.name} has been notified` : 'Your agent has been notified'} and will take it from here.
                    </p>
                </div>

                <div className="text-left space-y-2 text-sm">
                    <p className="font-medium text-foreground">What happens next:</p>
                    <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 pl-4 list-disc marker:text-muted-foreground/50">
                        <li>Your agent reviews the info and prepares a packet for the buyer.</li>
                        <li>If anything is unclear, your agent may reach out to confirm.</li>
                        <li>You can safely close this page. The link is now read-only.</li>
                    </ul>
                </div>

                {sellerToken && !confirmSent && (
                    <div className="rounded-xl border border-border bg-card/40 p-4 text-left space-y-2">
                        <p className="text-sm font-medium text-foreground">Want a copy?</p>
                        <p className="text-xs text-muted-foreground">We&apos;ll email you a link so you can revisit what you submitted anytime.</p>
                        <div className="flex gap-2 pt-1">
                            <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={confirmEmail}
                                placeholder="you@example.com"
                                onChange={(e) => { setConfirmEmail(e.target.value); setConfirmError(null); }}
                                disabled={confirmSubmitting}
                                className="flex-1 h-10 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent-border)]"
                            />
                            <button
                                type="button"
                                onClick={handleSendConfirmation}
                                disabled={confirmSubmitting}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white text-sm font-medium px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {confirmSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Send
                            </button>
                        </div>
                        {confirmError && <p className="text-xs text-red-400">{confirmError}</p>}
                    </div>
                )}
                {confirmSent && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <Check className="h-4 w-4" /> Sent. Check your inbox.
                    </div>
                )}

                {(brandProfile?.contact_email || brandProfile?.contact_phone) && (
                    <div className="text-left rounded-xl border border-border bg-card/40 p-4 space-y-2">
                        <p className="text-xs font-medium text-foreground">Questions? Contact {brandProfile?.name || 'your agent'}:</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                            {brandProfile?.contact_email && (
                                <a href={`mailto:${brandProfile.contact_email}`} className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent)]">
                                    <Mail className="h-3.5 w-3.5" />
                                    {brandProfile.contact_email}
                                </a>
                            )}
                            {brandProfile?.contact_phone && (
                                <a href={`tel:${brandProfile.contact_phone.replace(/[^0-9+]/g, '')}`} className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent)]">
                                    <Phone className="h-3.5 w-3.5" />
                                    {brandProfile.contact_phone}
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
