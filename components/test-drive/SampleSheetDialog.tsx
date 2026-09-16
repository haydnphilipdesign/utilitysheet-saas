'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { trackEvent } from '@/lib/analytics/events';
import { generateTestPdf } from '@/lib/test-pdf-generator';
import type { TestDriveSource } from '@/lib/test-drive/types';
import type { BrandProfile, BrandProfileFormData, PacketMode } from '@/types';

type SampleSheetDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source: TestDriveSource;
};

type AccountPlanResponse = {
    account?: { subscription_status?: string | null } | null;
    activeOrganization?: { subscription_status?: string | null } | null;
};

type SampleContext = {
    branding: BrandProfileFormData;
    /** saved: default Branding Profile; none: account has no profile; unavailable: load failed. */
    brandingSource: 'saved' | 'none' | 'unavailable';
    isPro: boolean;
};

const GENERIC_BRANDING: BrandProfileFormData = {
    name: 'Your Brand',
    primary_color: '#475569',
    secondary_color: '#334155',
    is_default: true,
    show_powered_by: true,
    show_generation_date: true,
};

function toFormData(profile: BrandProfile): BrandProfileFormData {
    return {
        name: profile.name,
        logo_url: profile.logo_url,
        primary_color: profile.primary_color,
        secondary_color: profile.secondary_color,
        contact_name: profile.contact_name,
        contact_phone: profile.contact_phone,
        contact_email: profile.contact_email,
        contact_website: profile.contact_website,
        disclaimer_text: profile.disclaimer_text,
        company_name: profile.company_name,
        professional_title: profile.professional_title,
        license_number: profile.license_number,
        license_state: profile.license_state,
        compliance_line: profile.compliance_line,
        is_default: profile.is_default,
        buyer_next_steps: profile.buyer_next_steps,
        next_steps_title: profile.next_steps_title,
        show_powered_by: profile.show_powered_by,
        show_generation_date: profile.show_generation_date,
        welcome_message: profile.welcome_message,
    };
}

async function loadSampleContext(): Promise<SampleContext> {
    // Always read the latest saved values: branding can change between openings.
    const [brandingResult, accountResult] = await Promise.allSettled([
        fetch('/api/branding', { cache: 'no-store' }).then((response) => {
            if (!response.ok) throw new Error(`Branding request failed with ${response.status}`);
            return response.json();
        }),
        fetch('/api/account', { cache: 'no-store' }).then((response): Promise<AccountPlanResponse> => (response.ok ? response.json() : Promise.resolve({}))),
    ]);

    const accountData: AccountPlanResponse = accountResult.status === 'fulfilled' ? accountResult.value : {};
    const isPro = accountData?.account?.subscription_status === 'pro'
        || accountData?.activeOrganization?.subscription_status === 'team';

    if (brandingResult.status === 'rejected' || !Array.isArray(brandingResult.value)) {
        return { branding: GENERIC_BRANDING, brandingSource: 'unavailable', isPro };
    }

    const profiles = brandingResult.value as BrandProfile[];
    const profile = profiles.find((item) => item.is_default) || profiles[0] || null;
    return profile
        ? { branding: toFormData(profile), brandingSource: 'saved', isPro }
        : { branding: GENERIC_BRANDING, brandingSource: 'none', isPro };
}

const BRANDING_NOTES: Record<SampleContext['brandingSource'], string> = {
    saved: 'Fictional property and provider details, shown with your saved default Branding Profile.',
    none: 'Fictional property and provider details with placeholder branding. Your own branding appears once it is saved.',
    unavailable: 'Fictional property and provider details with placeholder branding, because your saved branding could not be loaded. Close and reopen to try again.',
};

/**
 * Shows a fictional finished sheet rendered by the production document
 * builder (via UtilitySheetPdfPreview) and offers the matching sample PDF from
 * POST /api/branding/test-pdf. Nothing here creates a request.
 */
export function SampleSheetDialog({ open, onOpenChange, source }: SampleSheetDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-2xl">
                {/* The popup unmounts when closed, so every opening mounts a
                    fresh body that loads the current branding and plan. */}
                <SampleSheetBody source={source} onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}

function SampleSheetBody({ source, onClose }: { source: TestDriveSource; onClose: () => void }) {
    const [context, setContext] = useState<SampleContext | null>(null);
    const [mode, setMode] = useState<PacketMode>('simple');
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void loadSampleContext().then((next) => {
            // A response from a closed opening must never land in a newer one.
            if (cancelled) return;
            setContext(next);
            trackEvent('sample_sheet_viewed', {
                source,
                branding: next.brandingSource === 'saved' ? 'saved' : 'generic',
            });
        });
        return () => {
            cancelled = true;
        };
    }, [source]);

    const downloadPdf = async () => {
        if (!context) return;
        setDownloading(true);
        try {
            // Same context and plan gating as the preview on screen.
            await generateTestPdf(context.branding, context.isPro ? mode : 'simple');
            trackEvent('sample_sheet_pdf_downloaded', { source, success: true });
        } catch (error) {
            trackEvent('sample_sheet_pdf_downloaded', { source, success: false });
            toast.error(error instanceof Error ? error.message : 'Could not download the sample PDF.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <>
            <DialogHeader className="pr-8">
                <DialogTitle className="text-base font-semibold text-foreground">Sample utility sheet</DialogTitle>
                <DialogDescription className="text-sm">
                    This is what you get when a seller finishes. You can review it online, download the PDF, and share it with the buyer.
                </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {!context ? (
                    <div aria-busy="true" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading sample sheet…
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            {BRANDING_NOTES[context.brandingSource]}
                        </p>
                        <UtilitySheetPdfPreview
                            branding={context.branding}
                            isPro={context.isPro}
                            mode={mode}
                            onModeChange={setMode}
                            label="Sample sheet"
                            frameLabel="Sample utility info sheet with fictional details"
                            scrollContained={false}
                        />
                    </div>
                )}
            </div>

            <DialogFooter className="border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={onClose}>
                    Close
                </Button>
                <Button type="button" onClick={downloadPdf} disabled={!context || downloading}>
                    {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                    {downloading ? 'Preparing PDF…' : 'Download sample PDF'}
                </Button>
            </DialogFooter>
        </>
    );
}
