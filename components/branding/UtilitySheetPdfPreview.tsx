'use client';

import Image from 'next/image';
import type { BrandProfileFormData } from '@/types';

interface UtilitySheetPdfPreviewProps {
    branding: BrandProfileFormData;
}

// Sample utility data for preview
const sampleUtilities = [
    { category: 'electric', provider: 'Springfield Electric', phone: '(800) 555-0100', icon: '⚡' },
    { category: 'gas', provider: 'County Gas Co.', phone: '(800) 555-0101', icon: '🔥' },
    { category: 'water', provider: 'Springfield Water', phone: '(800) 555-0102', icon: '💧' },
    { category: 'trash', provider: 'Waste Services', phone: '(800) 555-0103', icon: '🗑️' },
    { category: 'internet', provider: 'Xfinity', phone: '(800) 555-0104', icon: '📶' },
];

const buyerSteps = [
    'Contact each utility provider above to set up new service in your name.',
    'Schedule service to begin on your closing date or the following business day.',
    'Have your closing documents handy — providers may ask for verification.',
    'If transferring internet, contact your provider 1-2 weeks in advance.',
];

export default function UtilitySheetPdfPreview({ branding }: UtilitySheetPdfPreviewProps) {
    const brandName = branding.name || 'Brand Name';
    const primaryColor = branding.primary_color || '#10b981';
    const contactPhone = branding.contact_phone || '';
    const contactEmail = branding.contact_email || '';
    const contactWebsite = branding.contact_website || '';

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
                        <span className="text-emerald-600">📍</span>
                        <span className="font-semibold text-neutral-900">123 Main St, Springfield</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-2 text-neutral-500 text-[9px]">
                        <span>📅</span>
                        <span>Generated on January 12, 2026</span>
                    </div>
                </div>

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
                            {sampleUtilities.map((utility, idx) => (
                                <tr
                                    key={utility.category}
                                    className={idx !== sampleUtilities.length - 1 ? 'border-b border-neutral-100' : ''}
                                >
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs">{utility.icon}</span>
                                            <span className="font-medium text-neutral-900 capitalize">
                                                {utility.category}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-neutral-700 font-medium">
                                        {utility.provider}
                                    </td>
                                    <td className="px-3 py-1.5 text-emerald-600 font-medium">
                                        {utility.phone}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Buyer Next Steps */}
                <div className="mx-3 mb-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                    <h3 className="font-semibold text-neutral-900 text-[11px] mb-2">Buyer Next Steps</h3>
                    <ol className="space-y-1.5">
                        {buyerSteps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-neutral-600 items-start">
                                <span
                                    className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[8px] font-semibold"
                                >
                                    {i + 1}
                                </span>
                                <span className="leading-snug text-[9px]">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Footer */}
                <div className="text-center py-2 border-t border-neutral-200 text-[9px] text-neutral-500">
                    Powered by utilitysheet.com
                    {contactEmail && <span> • {contactEmail}</span>}
                </div>
            </div>
        </div>
    );
}
