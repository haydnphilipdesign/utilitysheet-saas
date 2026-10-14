'use client';

import { ReactNode, CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, Globe, Check, Send, Loader2, MapPin } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import { buildBrandAccentStyle } from '@/lib/branding/deliverable';
import { wizardBrandScope } from './wizard-ui';
import { detectMaintenance } from '@/lib/maintenance/client';

interface BrandProfile {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

interface SellerLayoutProps {
    children: ReactNode;
    progress: number; // 0 to 100
    address?: string;
    stepName?: string;
    completedCount: number;
    totalCount: number;
    brandProfile?: BrandProfile | null;
    stepNumber?: number;
    stepTotal?: number;
    autosaveFlash?: boolean;
    sellerToken?: string;
    showSaveLink?: boolean;
    isTestDrive?: boolean;
    /** False on screens that are not a step of the form (paused, already submitted). */
    showProgress?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Success green that keeps 4.5:1 on the light and dark page backgrounds.
const SUCCESS_TEXT = 'text-emerald-700 dark:text-emerald-400';
// Before the first measurement; the layout effect replaces it before paint.
const FALLBACK_HEADER_HEIGHT = 96;
// The header measures before paint so the content padding never jumps. The
// server render (reusable intake link) has nothing to measure.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const SAVE_LINK_PAUSED_MESSAGE = 'Emailing this link is paused for a short planned update, so nothing was sent. This page’s web address is your link: bookmark or copy it to come back later.';

function SaveLinkAffordance({ token, stepName }: { token: string; stepName: string }) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = async () => {
        const trimmed = email.trim();
        if (!EMAIL_PATTERN.test(trimmed)) {
            setError('Please enter a valid email address.');
            return;
        }
        setSubmitting(true);
        setError(null);
        trackEvent('seller_save_link_requested', { step: stepName, location: 'seller_flow' });
        try {
            const res = await fetch(`/api/seller/${encodeURIComponent(token)}/send-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed }),
            });
            if (res.ok) {
                setDone(true);
                trackEvent('seller_save_link_sent', { step: stepName, success: true, location: 'seller_flow' });
            } else if (await detectMaintenance(res)) {
                // Not sent, and not a failure: the seller is told how to come back without the email.
                setError(SAVE_LINK_PAUSED_MESSAGE);
                trackEvent('seller_save_link_sent', { step: stepName, success: false, location: 'seller_flow' });
            } else {
                const body = await res.json().catch(() => null);
                setError(body?.error || 'Could not send. Please try again.');
                trackEvent('seller_save_link_sent', { step: stepName, success: false, location: 'seller_flow' });
            }
        } catch {
            setError('We couldn’t reach the server. Check your connection and try again.');
            trackEvent('seller_save_link_sent', { step: stepName, success: false, location: 'seller_flow' });
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <span className={`inline-flex items-center gap-1 ${SUCCESS_TEXT}`}>
                <Check className="h-3.5 w-3.5" />
                Sent! Check your inbox.
            </span>
        );
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                data-testid="seller-save-link-open"
                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent-text)] transition-colors underline-offset-2 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <Mail className="h-3.5 w-3.5" />
                Email me this link to come back later
            </button>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto flex flex-col gap-2">
            <div className="flex gap-2">
                <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    placeholder="you@example.com"
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    disabled={submitting}
                    aria-label="Email address"
                    className="flex-1 h-11 sm:h-9 rounded-md border border-border bg-background/60 px-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent-border)]"
                    data-testid="seller-save-link-email"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 rounded-md bg-[color:var(--brand-accent-fill)] hover:bg-[color:var(--brand-accent-strong)] text-[color:var(--brand-accent-contrast)] text-sm font-medium px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    data-testid="seller-save-link-send"
                >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send
                </button>
            </div>
            {error && <p role="alert" className="text-xs text-destructive text-left">{error}</p>}
            <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="text-[11px] text-muted-foreground hover:text-foreground self-start"
            >
                Cancel
            </button>
        </div>
    );
}

export function SellerLayout(props: SellerLayoutProps) {
    const {
        children,
        progress,
        address,
        stepName,
        brandProfile,
        stepNumber,
        stepTotal,
        autosaveFlash,
        sellerToken,
        showSaveLink,
        isTestDrive,
        showProgress = true,
    } = props;
    const headerRef = useRef<HTMLElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState<number | null>(null);

    useEffect(() => {
        // A long step's scroll position can hide the next step behind the fixed
        // header. Field edits keep their position; only step navigation resets it.
        if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }, [stepName]);

    useIsomorphicLayoutEffect(() => {
        const headerEl = headerRef.current;
        if (!headerEl) return;

        const measure = () => {
            const nextHeight = Math.ceil(headerEl.getBoundingClientRect().height);
            setHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        };

        measure();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => measure());
            observer.observe(headerEl);
        }

        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    // Honor the agent's brand color across the whole deliverable (safe fallback
    // to the product default). The same resolved color drives the header, the
    // progress bar, and every step CTA/selection/checkmark via CSS variables.
    const accentStyle = buildBrandAccentStyle(brandProfile?.primary_color);
    const mainTopPadding = (headerHeight ?? FALLBACK_HEADER_HEIGHT) + 16;
    const roundedProgress = Math.round(progress);
    const stepCount = stepNumber != null && stepTotal != null && stepNumber > 0 && stepNumber <= stepTotal
        ? `${stepNumber} of ${stepTotal}`
        : null;

    return (
        <div className={`min-h-screen bg-background text-foreground selection:bg-primary/30 ${wizardBrandScope}`} style={accentStyle as CSSProperties}>
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-900/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[128px]" />
            </div>

            {/*
              Sized by the screen, never by scrolling, so it does not jump.
              Phones show the property under the brand name; short screens
              (landscape phones, zoomed windows) use one row with the progress
              bar along the bottom edge.
            */}
            <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
                <div className="relative max-w-2xl mx-auto px-4 py-2.5 sm:py-3 short:py-1.5">
                    {/* Short screens reserve the right edge for the step count below. */}
                    <div className={`flex items-center gap-3 short:h-9 ${showProgress ? 'short:pr-28' : ''}`}>
                        {brandProfile?.logo_url ? (
                            // The brand name is shown beside the logo, so the image is decorative.
                            <img
                                src={brandProfile.logo_url}
                                alt=""
                                className="h-8 sm:h-10 short:h-7 w-auto max-w-[88px] sm:max-w-[120px] object-contain shrink-0"
                            />
                        ) : brandProfile?.name ? (
                            <div
                                aria-hidden="true"
                                className="h-8 w-8 sm:h-10 sm:w-10 short:h-7 short:w-7 rounded-lg sm:rounded-xl shadow-sm flex items-center justify-center bg-[color:var(--brand-accent-fill)] text-[color:var(--brand-accent-contrast)] font-bold text-xs sm:text-sm shrink-0"
                            >
                                {brandProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                        ) : (
                            <div className="h-8 w-8 sm:h-10 sm:w-10 short:h-7 short:w-7 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-sm flex items-center justify-center shrink-0">
                                <img src="/logo-sm.png" alt="" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <h1 className="font-bold text-sm text-foreground truncate leading-5">
                                {brandProfile?.name || 'UtilitySheet'}
                            </h1>
                            {address ? (
                                <p className="sm:hidden flex items-center gap-1 text-xs leading-4 text-muted-foreground" title={address} data-testid="seller-header-address">
                                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    <span className="sr-only">Property: </span>
                                    <span className="truncate">{address}</span>
                                </p>
                            ) : null}
                            <p className={`${address ? 'hidden sm:block' : ''} short:hidden text-xs leading-4 text-muted-foreground truncate`}>
                                {brandProfile?.name ? 'Utility information request' : 'Utility information'}
                            </p>
                        </div>
                        {address && (
                            <div className="hidden sm:block min-w-0 max-w-[55%] text-right">
                                <p className="short:hidden text-[11px] leading-4 text-muted-foreground uppercase tracking-widest font-medium">Property</p>
                                <p className="text-sm leading-5 text-foreground font-medium truncate" title={address} data-testid="seller-header-address-wide">
                                    <span className="sr-only">Property: </span>
                                    {address}
                                </p>
                            </div>
                        )}
                    </div>

                    {isTestDrive ? (
                        <div
                            data-testid="seller-test-drive-banner"
                            className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
                        >
                            <p className="min-w-0">
                                <strong>Test mode.</strong>{' '}
                                <span className="hidden sm:inline">You are seeing what your seller sees. </span>
                                Use made-up answers.
                            </p>
                            <Link
                                href="/dashboard"
                                onClick={() => trackEvent('test_drive_dashboard_returned', { source: 'seller_banner' })}
                                className="inline-flex min-h-9 shrink-0 items-center rounded-md px-2 font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                                Exit test
                            </Link>
                        </div>
                    ) : null}

                    {showProgress && (
                        <div className="mt-2 sm:mt-3 short:contents">
                            {/* Short screens: the count moves up beside the brand row and the step name is left to the page heading. */}
                            <div aria-hidden="true" className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground short:absolute short:right-4 short:top-1.5 short:mb-0 short:h-9">
                                <span className="font-medium truncate short:hidden">{stepName || 'Progress'}</span>
                                <span className="flex items-center gap-2 shrink-0 tabular-nums">
                                    {autosaveFlash && (
                                        <span className={`inline-flex items-center gap-1 ${SUCCESS_TEXT} transition-opacity`}>
                                            <Check className="h-3 w-3" />
                                            <span className="hidden sm:inline short:hidden">Saved</span>
                                        </span>
                                    )}
                                    {stepCount && <span>{stepCount}</span>}
                                    <span>{roundedProgress}%</span>
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-label="Form progress"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={roundedProgress}
                                aria-valuetext={[stepName, stepCount && `step ${stepCount}`, `${roundedProgress}% complete`].filter(Boolean).join(', ')}
                                className="h-1.5 sm:h-1 bg-muted rounded-full overflow-hidden short:absolute short:inset-x-0 short:bottom-0 short:h-0.5 short:rounded-none"
                            >
                                <div
                                    className="h-full transition-all duration-500 ease-out motion-reduce:transition-none"
                                    style={{
                                        width: `${progress}%`,
                                        background: 'linear-gradient(to right, var(--brand-accent), var(--brand-accent-strong))',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    {/* Announces each new step; screen readers do not read it on load. */}
                    <p className="sr-only" aria-live="polite" data-testid="seller-step-announcement">
                        {stepName ? [stepName, stepCount && `step ${stepCount}`].filter(Boolean).join(', ') : ''}
                    </p>
                </div>
            </header>

            {/* Main Content Area - top padding follows the measured header. Steps slide in
                from the side; clipping keeps that from widening the page for a moment. */}
            <main
                className="relative z-10 pb-6 px-4 min-h-screen flex flex-col max-w-2xl mx-auto overflow-x-clip"
                style={{ paddingTop: `${mainTopPadding}px` }}
            >
                {children}
            </main>

            {/* Footer - help / contact agent + save link */}
            {(showSaveLink || brandProfile?.contact_email || brandProfile?.contact_phone || brandProfile?.contact_website) && (
                <footer className="relative z-10 pb-8 sm:pb-10 px-4 space-y-3">
                    {showSaveLink && sellerToken && (
                        <div className="max-w-2xl mx-auto pt-4 text-xs text-muted-foreground text-center">
                            <SaveLinkAffordance token={sellerToken} stepName={stepName || 'unknown'} />
                        </div>
                    )}
                    {(brandProfile?.contact_email || brandProfile?.contact_phone || brandProfile?.contact_website) && (
                    <div className="max-w-2xl mx-auto border-t border-border pt-4 text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                        <span>
                            Need help?{' '}
                            {brandProfile?.name ? `Contact ${brandProfile.name}` : 'Contact your real estate team'}:
                        </span>
                        {brandProfile?.contact_email && (
                            <a
                                href={`mailto:${brandProfile.contact_email}`}
                                onClick={() => trackEvent('seller_help_contact_clicked', {
                                    contact_type: 'email',
                                    step: stepName || 'unknown',
                                    location: isTestDrive ? 'test_drive_seller_flow' : 'seller_flow',
                                })}
                                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent-text)] transition-colors"
                            >
                                <Mail className="h-3.5 w-3.5" />
                                {brandProfile.contact_email}
                            </a>
                        )}
                        {brandProfile?.contact_phone && (
                            <a
                                href={`tel:${brandProfile.contact_phone.replace(/[^0-9+]/g, '')}`}
                                onClick={() => trackEvent('seller_help_contact_clicked', {
                                    contact_type: 'phone',
                                    step: stepName || 'unknown',
                                    location: isTestDrive ? 'test_drive_seller_flow' : 'seller_flow',
                                })}
                                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent-text)] transition-colors"
                            >
                                <Phone className="h-3.5 w-3.5" />
                                {brandProfile.contact_phone}
                            </a>
                        )}
                        {brandProfile?.contact_website && !brandProfile?.contact_email && !brandProfile?.contact_phone && (
                            <a
                                href={brandProfile.contact_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackEvent('seller_help_contact_clicked', {
                                    contact_type: 'website',
                                    step: stepName || 'unknown',
                                    location: isTestDrive ? 'test_drive_seller_flow' : 'seller_flow',
                                })}
                                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent-text)] transition-colors"
                            >
                                <Globe className="h-3.5 w-3.5" />
                                Website
                            </a>
                        )}
                    </div>
                    )}
                </footer>
            )}
        </div>
    );
}

