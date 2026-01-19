'use client';

import Image from 'next/image';
import type { BrandProfileFormData } from '@/types';
import { DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import { clampBrandingText } from '@/lib/branding/text';
import { CalendarDays, Droplets, Flame, MapPin, Trash2, Wifi, Zap } from 'lucide-react';

interface UtilitySheetPdfPreviewProps {
    branding: BrandProfileFormData;
}

function hexToRgb(hex: string) {
    const normalized = hex.replace('#', '').trim();
    if (normalized.length !== 6) return null;

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
}

function rgbaFromHex(hex: string, alpha: number) {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(16, 185, 129, ${alpha})`; // emerald-500 fallback
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// Sample utility data for preview
const sampleUtilities = [
    { category: 'electric', provider: 'Springfield Electric', phone: '(800) 555-0100', icon: Zap },
    { category: 'gas', provider: 'County Gas Co.', phone: '(800) 555-0101', icon: Flame },
    { category: 'water', provider: 'Springfield Water', phone: '(800) 555-0102', icon: Droplets },
    { category: 'trash', provider: 'Waste Services', phone: '(800) 555-0103', icon: Trash2 },
    { category: 'internet', provider: 'Xfinity', phone: '(800) 555-0104', icon: Wifi },
];

export default function UtilitySheetPdfPreview({ branding }: UtilitySheetPdfPreviewProps) {
    const brandName = clampBrandingText(branding.name, BRAND_PROFILE_LIMITS.brandNameMax) || 'Brand Name';
    const primaryColor = branding.primary_color || '#10b981';
    const contactPhone = clampBrandingText(branding.contact_phone, BRAND_PROFILE_LIMITS.contactPhoneMax);
    const contactEmail = clampBrandingText(branding.contact_email, BRAND_PROFILE_LIMITS.contactEmailMax);
    const contactWebsite = clampBrandingText(branding.contact_website, BRAND_PROFILE_LIMITS.contactWebsiteMax);
    const showPoweredBy = branding.show_powered_by ?? true;
    const showGenerationDate = branding.show_generation_date ?? true;
    const welcomeMessage = clampBrandingText(branding.welcome_message, BRAND_PROFILE_LIMITS.welcomeMessageMax);
    const disclaimerText = clampBrandingText(branding.disclaimer_text, BRAND_PROFILE_LIMITS.disclaimerTextMax);
    const nextStepsTitle = clampBrandingText(branding.next_steps_title, BRAND_PROFILE_LIMITS.nextStepsTitleMax) || 'Buyer Next Steps';
    const buyerSteps = (branding.buyer_next_steps || DEFAULT_BUYER_STEPS)
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

                {/* Title Section */}
                <div className="text-center py-4 px-3">
                    <h1 className="text-sm font-extrabold text-neutral-900 mb-2 tracking-tight">
                        Utility Info Sheet
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
                    <div className="mx-3 mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-neutral-700 text-[9px] leading-relaxed line-clamp-4">{welcomeMessage}</p>
                    </div>
                )}

                {/* Utility Table */}
                <div className="mx-3 mb-3 border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-neutral-50 px-3 py-2 border-b border-neutral-200">
                        <h3 className="font-semibold text-neutral-900 text-[11px]">Utility Providers</h3>
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
                                            backgroundColor: rgbaFromHex(primaryColor, 0.12),
                                            color: primaryColor,
                                        }}
                                    >
                                        {i + 1}
                                    </span>
                                    <span className="leading-snug text-[9px] line-clamp-2">{step}</span>
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
    );
}
