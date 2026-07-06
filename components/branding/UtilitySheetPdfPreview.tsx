'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { AdvancedModuleKey, BrandProfileFormData, PacketMode } from '@/types';
import { DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import { clampBrandingText } from '@/lib/branding/text';
import { ADVANCED_MODULE_METADATA } from '@/lib/packet/modules';
import { getPacketTitle, hexToRgba, resolveBrandColor } from '@/lib/branding/deliverable';
import { cn } from '@/lib/utils';
import { CalendarDays, Droplets, Flame, MapPin, Trash2, Wifi, Zap } from 'lucide-react';

interface UtilitySheetPdfPreviewProps {
    branding: BrandProfileFormData;
    /**
     * When false, the preview applies the same plan gating the real packet
     * applies to Free accounts (forces "Powered by", hides the welcome message,
     * ignores custom next steps) so the preview never promises Pro-only output.
     * Advanced mode is Pro/Teams only, so the Simple/Advanced toggle is also
     * hidden for Free accounts.
     */
    isPro?: boolean;
    /**
     * The account's default packet mode, used only to seed the initial
     * Simple/Advanced toggle selection (e.g. onboarding passes the reusable
     * seller link's default_packet_mode). Advanced is Pro-only, so this is
     * ignored for Free accounts. Defaults to 'simple'.
     */
    defaultMode?: PacketMode;
}

// Sample home-basics data for preview (mirrors the Home Basics card the simple
// web packet and simple PDF render from real seller answers). Advanced
// deliverables omit Home Basics, so this only renders in simple mode.
const sampleHomeBasics = [
    { label: 'Water Source', value: 'City Water' },
    { label: 'Sewer Type', value: 'Public Sewer' },
    { label: 'Heating Type', value: 'Natural Gas' },
];

// Sample utility data for preview
const sampleUtilities = [
    { category: 'electric', provider: 'Springfield Electric', phone: '(800) 555-0100', icon: Zap },
    { category: 'gas', provider: 'County Gas Co.', phone: '(800) 555-0101', icon: Flame },
    { category: 'water', provider: 'Springfield Water', phone: '(800) 555-0102', icon: Droplets },
    { category: 'trash', provider: 'Waste Services', phone: '(800) 555-0103', icon: Trash2 },
    { category: 'internet', provider: 'Xfinity', phone: '(800) 555-0104', icon: Wifi },
];

// Representative advanced modules for the advanced-mode preview. Titles and
// sample field values come straight from the canonical module metadata so the
// preview cannot drift from the real advanced deliverable (see
// buildAdvancedPacketPdfHtml). Two modules convey the modular, multi-section
// nature of the advanced packet.
const SAMPLE_ADVANCED_MODULE_KEYS: AdvancedModuleKey[] = ['service_providers', 'lawn_exterior'];

const sampleAdvancedSections = SAMPLE_ADVANCED_MODULE_KEYS.map((moduleKey) => {
    const meta = ADVANCED_MODULE_METADATA[moduleKey];
    return {
        key: moduleKey,
        title: meta.label,
        fields: meta.fields
            .filter((field) => field.example)
            .slice(0, 4)
            .map((field) => ({ label: field.label, value: field.example as string })),
    };
});

export default function UtilitySheetPdfPreview({ branding, isPro = false, defaultMode = 'simple' }: UtilitySheetPdfPreviewProps) {
    // Advanced deliverables are Pro/Teams only. Free accounts keep the simple
    // preview (no toggle) so the preview never promises Pro-only output.
    const [mode, setMode] = useState<PacketMode>(defaultMode);
    const effectiveMode: PacketMode = isPro ? mode : 'simple';

    const brandName = clampBrandingText(branding.name, BRAND_PROFILE_LIMITS.brandNameMax) || 'Brand Name';
    const primaryColor = resolveBrandColor(branding.primary_color);
    const contactName = clampBrandingText(branding.contact_name, BRAND_PROFILE_LIMITS.contactNameMax);
    const contactPhone = clampBrandingText(branding.contact_phone, BRAND_PROFILE_LIMITS.contactPhoneMax);
    const contactEmail = clampBrandingText(branding.contact_email, BRAND_PROFILE_LIMITS.contactEmailMax);
    const contactWebsite = clampBrandingText(branding.contact_website, BRAND_PROFILE_LIMITS.contactWebsiteMax);
    // Mirror the Free/Pro gating applied in lib/packet/packet-data.ts so the
    // preview shows exactly what the real packet will render for this plan.
    const showPoweredBy = isPro ? (branding.show_powered_by ?? true) : true;
    const showGenerationDate = isPro ? (branding.show_generation_date ?? true) : true;
    const welcomeMessage = isPro ? clampBrandingText(branding.welcome_message, BRAND_PROFILE_LIMITS.welcomeMessageMax) : '';
    const disclaimerText = clampBrandingText(branding.disclaimer_text, BRAND_PROFILE_LIMITS.disclaimerTextMax);
    const nextStepsTitle = (isPro
        ? clampBrandingText(branding.next_steps_title, BRAND_PROFILE_LIMITS.nextStepsTitleMax)
        : '') || 'Buyer Next Steps';
    const buyerSteps = ((isPro && branding.buyer_next_steps) ? branding.buyer_next_steps : DEFAULT_BUYER_STEPS)
        .map((step) => clampBrandingText(step, BRAND_PROFILE_LIMITS.buyerNextStepMax))
        .filter(Boolean)
        .slice(0, BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems);
    const generatedOn = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    // Generate initials for fallback when no logo
    const initials = brandName
        .split(' ')
        .map((w) => w[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="space-y-4">
            {/* Mode toggle: advanced is Pro/Teams only, so it is hidden for Free.
                A single brand profile drives both simple and advanced requests,
                so the toggle lets the agent verify their branding in either
                deliverable. */}
            {isPro && (
                <div className="flex justify-center">
                    <div
                        className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs font-medium"
                        role="group"
                        aria-label="Preview packet mode"
                    >
                        {(['simple', 'advanced'] as PacketMode[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setMode(option)}
                                aria-pressed={mode === option}
                                className={cn(
                                    'rounded-md px-3 py-1 transition-colors',
                                    mode === option
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {option === 'simple' ? 'Simple' : 'Advanced'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="relative">
                {/* Preview Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-slate-700 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                        PREVIEW
                    </span>
                </div>

                {/* PDF Preview Container - scaled down representation */}
                <div
                    className="bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden"
                    style={{
                        fontSize: '10px',
                        fontFamily: 'Arial, sans-serif, system-ui',
                    }}
                >
                    {/* Branding Header */}
                    <div
                        className="flex items-center justify-between p-4 border-b-2"
                        style={{ borderBottomColor: '#e4e4e7' }}
                    >
                        <div className="flex items-center gap-3">
                            {/* Logo or Initials */}
                            {branding.logo_url ? (
                                <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                                    <Image
                                        src={branding.logo_url}
                                        alt={brandName}
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {initials || 'US'}
                                </div>
                            )}
                            <div>
                                <h2 className="font-bold text-neutral-900 text-xs leading-tight">
                                    {brandName}
                                </h2>
                                {contactName && (
                                    <p className="text-neutral-700 text-[9px] font-medium">{contactName}</p>
                                )}
                                {contactPhone && (
                                    <p className="text-neutral-500 text-[9px]">{contactPhone}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right text-[9px] text-neutral-500">
                            {contactEmail && <p>{contactEmail}</p>}
                            {contactWebsite && <p>{contactWebsite}</p>}
                        </div>
                    </div>

                    {/* Title Section: the document title tracks the selected mode
                        via getPacketTitle so it always matches the real
                        deliverable ("Utility Info Sheet" for simple, "Utility
                        Information Sheet" for advanced). */}
                    <div className="text-center py-4 px-3">
                        <h1 className="text-sm font-extrabold text-neutral-900 mb-2 tracking-tight">
                            {getPacketTitle(effectiveMode)}
                        </h1>
                        <div className="inline-flex items-center gap-1.5 bg-neutral-100 px-2.5 py-1.5 rounded-lg border border-neutral-200">
                            <MapPin className="h-3 w-3" style={{ color: primaryColor }} aria-hidden="true" />
                            <span className="font-semibold text-neutral-900">123 Main St, Springfield</span>
                        </div>
                        {showGenerationDate && (
                            <div className="flex items-center justify-center gap-1 mt-2 text-neutral-500 text-[9px]">
                                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                                <span>Generated on {generatedOn}</span>
                            </div>
                        )}
                    </div>

                    {/* Welcome Message */}
                    {welcomeMessage && (
                        <div
                            className="mx-3 mb-3 p-3 rounded-lg"
                            style={{
                                backgroundColor: hexToRgba(primaryColor, 0.08),
                                border: `1px solid ${hexToRgba(primaryColor, 0.25)}`,
                                borderLeft: `3px solid ${primaryColor}`,
                            }}
                        >
                            <p className="text-neutral-700 text-[9px] leading-relaxed line-clamp-4">{welcomeMessage}</p>
                        </div>
                    )}

                    {/* Home Basics (sample): simple deliverable only; advanced
                        packets omit it. */}
                    {effectiveMode === 'simple' && (
                        <div className="mx-3 mb-3 border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-neutral-50 px-3 py-2 border-b border-neutral-200">
                                <h3 className="font-semibold text-neutral-900 text-[11px]">Home Basics</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2 px-3 py-2">
                                {sampleHomeBasics.map((item) => (
                                    <div key={item.label}>
                                        <p className="text-[8px] uppercase tracking-wide text-neutral-500">{item.label}</p>
                                        <p className="text-[9px] font-medium text-neutral-900">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Utility Table */}
                    <div className="mx-3 mb-3 border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="bg-neutral-50 px-3 py-2 border-b border-neutral-200">
                            <h3 className="font-semibold text-neutral-900 text-[11px]">
                                {effectiveMode === 'advanced' ? 'Utilities' : 'Utility Providers'}
                            </h3>
                        </div>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="bg-white border-b border-neutral-200 text-[8px] text-neutral-500 uppercase tracking-wider font-semibold">
                                    <th className="text-left px-3 py-1.5">Utility</th>
                                    <th className="text-left px-3 py-1.5">Provider</th>
                                    <th className="text-left px-3 py-1.5">Contact</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sampleUtilities.map((utility, idx) => {
                                    const Icon = utility.icon;
                                    return (
                                        <tr
                                            key={utility.category}
                                            className={idx !== sampleUtilities.length - 1 ? 'border-b border-neutral-100' : ''}
                                        >
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Icon className="h-3 w-3" style={{ color: primaryColor }} aria-hidden="true" />
                                                    <span className="font-medium text-neutral-900 capitalize">
                                                        {utility.category}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 text-neutral-700 font-medium">
                                                {utility.provider}
                                            </td>
                                            <td className="px-3 py-1.5 font-medium" style={{ color: primaryColor }}>
                                                {utility.phone}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Advanced Modules (sample): advanced deliverable only.
                        Mirrors the titled, label/value section structure of
                        buildAdvancedPacketPdfHtml, with the brand-colored accent
                        border on each section header. */}
                    {effectiveMode === 'advanced' && sampleAdvancedSections.map((section) => (
                        <div key={section.key} className="mx-3 mb-3 border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
                            <div
                                className="bg-neutral-50 px-3 py-2 border-b border-neutral-200"
                                style={{ borderLeft: `3px solid ${primaryColor}` }}
                            >
                                <h3 className="font-semibold text-neutral-900 text-[11px]">{section.title}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2 px-3 py-2">
                                {section.fields.map((field) => (
                                    <div key={field.label}>
                                        <p className="text-[8px] uppercase tracking-wide text-neutral-500">{field.label}</p>
                                        <p className="text-[9px] font-medium text-neutral-900">{field.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Buyer Next Steps */}
                    <div className="mx-3 mb-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                        <h3 className="font-semibold text-neutral-900 text-[11px] mb-2">{nextStepsTitle}</h3>
                        <ol className="space-y-1.5">
                            {buyerSteps
                                .map((step, i) => (
                                    <li key={i} className="flex gap-2 text-neutral-600 items-start">
                                        <span
                                            className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold"
                                            style={{
                                                backgroundColor: hexToRgba(primaryColor, 0.12),
                                                color: primaryColor,
                                            }}
                                        >
                                            {i + 1}
                                        </span>
                                        <span className="leading-relaxed text-[9px]">{step}</span>
                                    </li>
                                ))}
                        </ol>
                    </div>

                    {/* Footer */}
                    {(disclaimerText || showPoweredBy || contactEmail) && (
                        <div className="text-center py-2 border-t border-neutral-200 text-[9px] text-neutral-500">
                            {disclaimerText && (
                                <div className="px-3 mb-1 text-[8px] leading-snug text-neutral-500 line-clamp-2">
                                    {disclaimerText}
                                </div>
                            )}
                            {showPoweredBy && 'Powered by utilitysheet.com'}
                            {showPoweredBy && contactEmail && ' • '}
                            {contactEmail && <span>{contactEmail}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
