'use client';

import { ReactNode, CSSProperties, useEffect, useRef, useState } from 'react';
import { Mail, Phone, Globe, Check, Send, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import { buildBrandAccentStyle, resolveBrandColor } from '@/lib/branding/deliverable';

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
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
            } else {
                const body = await res.json().catch(() => null);
                setError(body?.error || 'Could not send. Please try again.');
                trackEvent('seller_save_link_sent', { step: stepName, success: false, location: 'seller_flow' });
            }
        } catch {
            setError('Network error. Please check your connection.');
            trackEvent('seller_save_link_sent', { step: stepName, success: false, location: 'seller_flow' });
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <span className="inline-flex items-center gap-1 text-emerald-500">
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
                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent)] transition-colors underline-offset-2 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                    className="flex-1 h-9 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent-border)]"
                    data-testid="seller-save-link-email"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 rounded-md bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white text-sm font-medium px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
    } = props;
    const headerRef = useRef<HTMLElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState<number | null>(null);

    useEffect(() => {
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
    const safePrimaryColor = resolveBrandColor(brandProfile?.primary_color);
    const accentStyle = buildBrandAccentStyle(brandProfile?.primary_color);
    const fallbackHeaderHeight = 144;
    const mainTopPadding = (headerHeight ?? fallbackHeaderHeight) + 16;

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30" style={accentStyle as CSSProperties}>
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-900/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/50 backdrop-blur-xl">
                <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
                    {/* Top row: Brand + Property */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            {brandProfile?.logo_url ? (
                                <img
                                    src={brandProfile.logo_url}
                                    alt={brandProfile.name || 'Organization'}
                                    className="h-8 sm:h-10 w-auto max-w-[100px] sm:max-w-[120px] object-contain shrink-0"
                                />
                            ) : brandProfile?.name ? (
                                <div
                                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0"
                                    style={{ backgroundColor: safePrimaryColor }}
                                >
                                    {brandProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                            ) : (
                                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20 shrink-0">
                                    <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-3 w-3 sm:h-4 sm:w-4" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h1 className="font-bold text-xs sm:text-sm text-foreground truncate">
                                    {brandProfile?.name || 'UtilitySheet'}
                                </h1>
                                <p className="text-xs text-muted-foreground truncate">
                                    {brandProfile?.name ? 'Utility Information Request' : 'Simplify Utility Handoffs'}
                                </p>
                            </div>
                        </div>
                        {address && (
                            <div className="text-right hidden sm:block shrink-0">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Property</p>
                                <p className="text-sm text-foreground font-medium truncate max-w-[180px]">{address}</p>
                            </div>
                        )}
                    </div>

                    {/* Mobile address display */}
                    {address && (
                        <div className="sm:hidden mb-3 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Property</p>
                            <p className="text-xs text-foreground font-medium truncate">{address}</p>
                        </div>
                    )}

                    {isTestDrive ? (
                        <div role="status" className="mb-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
                            <strong>Test UtilitySheet:</strong> use fictional answers to experience the same flow your seller will complete.
                        </div>
                    ) : null}

                    {/* Progress Bar */}
                    <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                            <span className="font-medium truncate">{stepName || 'Progress'}</span>
                            <span className="flex items-center gap-2 shrink-0">
                                {autosaveFlash && (
                                    <span className="inline-flex items-center gap-1 text-emerald-500 transition-opacity">
                                        <Check className="h-3 w-3" />
                                        <span className="hidden sm:inline">Saved</span>
                                    </span>
                                )}
                                {stepNumber != null && stepTotal != null && stepNumber > 0 && stepNumber <= stepTotal && (
                                    <span className="text-muted-foreground/80">{stepNumber} of {stepTotal}</span>
                                )}
                                <span>{Math.round(progress)}%</span>
                            </span>
                        </div>
                        <div className="h-1.5 sm:h-1 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    background: 'linear-gradient(to right, var(--brand-accent), var(--brand-accent-strong))',
                                }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area - adjusted padding for mobile */}
            <main
                className="relative z-10 pb-6 px-4 min-h-screen flex flex-col max-w-2xl mx-auto"
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
                            {brandProfile?.name ? `Contact ${brandProfile.name}` : 'Contact your agent'}:
                        </span>
                        {brandProfile?.contact_email && (
                            <a
                                href={`mailto:${brandProfile.contact_email}`}
                                onClick={() => trackEvent('seller_help_contact_clicked', {
                                    contact_type: 'email',
                                    step: stepName || 'unknown',
                                    location: 'seller_flow',
                                })}
                                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent)] transition-colors"
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
                                    location: 'seller_flow',
                                })}
                                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent)] transition-colors"
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
                                    location: 'seller_flow',
                                })}
                                className="inline-flex items-center gap-1 text-foreground hover:text-[color:var(--brand-accent)] transition-colors"
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

