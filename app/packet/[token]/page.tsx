'use client';

import { useState, use, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Download, Copy, Check, Phone, ExternalLink, Calendar, MapPin, Loader2, Clock, Lock, AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { DEFAULT_BUYER_STEPS, UTILITY_CATEGORIES } from '@/lib/constants';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics/events';
import type { UtilityCategory } from '@/types';

type PacketBrand = {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
    disclaimer_text?: string | null;
    // Advanced customization
    buyer_next_steps?: string[] | null;
    next_steps_title?: string | null;
    show_powered_by?: boolean;
    show_generation_date?: boolean;
    welcome_message?: string | null;
} | null;

type PacketResponse = {
    mode?: 'simple' | 'advanced';
    request: {
        property_address: string;
        created_at: string;
    };
    brand: PacketBrand;
    utilities: Array<{
        category: UtilityCategory | string;
        provider_name: string;
        provider_phone?: string | null;
        provider_website?: string | null;
        meter_number?: string | null;
        trash_details?: {
            has_recycling?: 'yes' | 'no' | 'not_sure' | null;
            trash_pickup_day?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'varies' | 'not_sure' | null;
            trash_pickup_days?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'varies' | 'not_sure'> | null;
            recycling_pickup_day?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'varies' | 'not_sure' | null;
        } | null;
    }>;
    advanced_sections?: Array<{
        key: string;
        title: string;
        fields: Array<{ key: string; label: string; value: string }>;
    }>;
    meta?: {
        show_powered_by?: boolean;
    };
};

function formatPickupDay(day: string | null | undefined): string {
    if (!day) return 'Not sure';
    const normalized = day.trim().toLowerCase();
    const dayLabels: Record<string, string> = {
        mon: 'Monday',
        tue: 'Tuesday',
        wed: 'Wednesday',
        thu: 'Thursday',
        fri: 'Friday',
        sat: 'Saturday',
        sun: 'Sunday',
        varies: 'Varies',
        not_sure: 'Not sure',
    };
    return dayLabels[normalized] || 'Not sure';
}

function formatPickupDays(days: string[] | null | undefined): string {
    if (!days || days.length === 0) return 'Not sure';
    return days.map(formatPickupDay).join(', ');
}

function getTrashScheduleLines(trashDetails: PacketResponse['utilities'][number]['trash_details']): string[] {
    if (!trashDetails) return [];
    const lines: string[] = [];

    if (trashDetails.has_recycling !== undefined) {
        const hasRecycling = trashDetails.has_recycling === 'yes'
            ? 'Yes'
            : trashDetails.has_recycling === 'no'
                ? 'No'
                : 'Not sure';
        lines.push(`Recycling: ${hasRecycling}`);
    }
    if (Array.isArray(trashDetails.trash_pickup_days) && trashDetails.trash_pickup_days.length > 0) {
        lines.push(`Trash pickup: ${formatPickupDays(trashDetails.trash_pickup_days)}`);
    } else if (trashDetails.trash_pickup_day !== undefined) {
        lines.push(`Trash pickup: ${formatPickupDay(trashDetails.trash_pickup_day)}`);
    }
    if (trashDetails.recycling_pickup_day !== undefined && trashDetails.has_recycling !== 'no') {
        lines.push(`Recycling pickup: ${formatPickupDay(trashDetails.recycling_pickup_day)}`);
    }

    return lines;
}

type PacketState = 'not_submitted' | 'locked' | 'not_found';

function PacketStateScreen({
    icon,
    title,
    body,
    iconClassName,
}: {
    icon: ReactNode;
    title: string;
    body: string;
    iconClassName: string;
}) {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-1.5 sm:gap-2">
                    <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 dark:from-sky-500 dark:to-sky-600 shrink-0">
                        <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <span className="font-bold text-foreground text-sm sm:text-base">UtilitySheet</span>
                </div>
            </header>
            <div className="flex-1 flex items-center justify-center px-4 py-16">
                <div className="text-center max-w-md">
                    <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconClassName}`}>
                        {icon}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{title}</h1>
                    <p className="text-muted-foreground leading-relaxed">{body}</p>
                </div>
            </div>
        </div>
    );
}

export default function PacketPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [data, setData] = useState<PacketResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [packetState, setPacketState] = useState<PacketState | null>(null);
    const [lockedMessage, setLockedMessage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPacket() {
            try {
                const response = await fetch(`/api/packet/${resolvedParams.token}`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                } else {
                    const body = await response.json().catch(() => null);
                    if (body?.state === 'not_submitted') {
                        setPacketState('not_submitted');
                    } else if (body?.state === 'locked') {
                        setPacketState('locked');
                        setLockedMessage(typeof body?.message === 'string' ? body.message : null);
                    } else {
                        setPacketState('not_found');
                    }
                }
            } catch (error) {
                console.error('Error fetching packet data:', error);
                setPacketState('not_found');
            } finally {
                setLoading(false);
            }
        }
        fetchPacket();
    }, [resolvedParams.token]);

    const copyLink = () => {
        trackEvent('packet_action_clicked', {
            action: 'copy_link',
            location: 'packet_header',
        });
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadPdf = async () => {
        if (!data) return;
        setDownloading(true);
        trackEvent('packet_action_clicked', {
            action: 'download_pdf',
            location: 'packet_header',
        });

        try {
            await generatePacketPdf(resolvedParams.token);
            if (data.mode === 'advanced') {
                trackEvent('advanced_packet_generated', {
                    location: 'packet_header',
                });
                trackEvent('advanced_packet_downloaded', {
                    location: 'packet_header',
                });
            }
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-slate-600 dark:text-sky-400 animate-spin" />
            </div>
        );
    }

    if (packetState === 'not_submitted') {
        return (
            <PacketStateScreen
                icon={<Clock className="h-6 w-6 text-sky-500 dark:text-sky-400" />}
                iconClassName="bg-sky-500/10"
                title="This info sheet is not ready yet"
                body="The homeowner has not submitted their utility details. Check back soon."
            />
        );
    }

    if (packetState === 'locked') {
        return (
            <PacketStateScreen
                icon={<Lock className="h-6 w-6 text-amber-500" />}
                iconClassName="bg-amber-500/10"
                title="This info sheet is locked"
                body={lockedMessage || 'Ask the agent to upgrade their plan to view this info sheet.'}
            />
        );
    }

    if (!data) {
        return (
            <PacketStateScreen
                icon={<AlertCircle className="h-6 w-6 text-muted-foreground" />}
                iconClassName="bg-muted"
                title="Info sheet not found"
                body="We couldn't find an info sheet for this link. Double-check the link, or ask your agent to resend it."
            />
        );
    }

    const { request, brand, utilities } = data;
    const mode = data.mode || 'simple';
    const isAdvanced = mode === 'advanced';
    const advancedSections = data.advanced_sections || [];
    const primaryColor = brand?.primary_color || '#10b981';
    const forceShowPoweredBy = data.meta?.show_powered_by ?? true;
    const showPoweredBy = forceShowPoweredBy || (brand?.show_powered_by ?? false);
    const showGenerationDate = brand?.show_generation_date ?? true;
    const defaultTitle = isAdvanced ? 'Advanced Utility Packet' : 'Utility Info Sheet';
    const headerBrandName = showPoweredBy ? 'UtilitySheet' : (brand?.name || defaultTitle);
    const nextStepsTitle = brand?.next_steps_title || 'Buyer Next Steps';
    const buyerSteps = (brand?.buyer_next_steps && brand.buyer_next_steps.length > 0 ? brand.buyer_next_steps : DEFAULT_BUYER_STEPS)
        .map((step) => step.trim())
        .filter(Boolean);

    return (
        <div className="min-h-screen bg-background">
            {/* Header Actions */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {showPoweredBy ? (
                            <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 dark:from-sky-500 dark:to-sky-600 shrink-0">
                                <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </div>
                        ) : brand?.logo_url ? (
                            <img src={brand.logo_url} alt={brand?.name || 'Brand logo'} className="h-5 sm:h-6 w-auto shrink-0" />
                        ) : (
                            <div
                                className="h-5 w-5 sm:h-6 sm:w-6 rounded-md flex items-center justify-center text-white font-bold text-[8px] sm:text-[10px] shrink-0"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {brand?.name ? brand.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : 'US'}
                            </div>
                        )}
                        <span className="font-bold text-foreground text-sm sm:text-base truncate">{headerBrandName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            data-testid="packet-copy-link"
                            className="border-input text-foreground hover:bg-muted h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm active:scale-[0.98]"
                            onClick={copyLink}
                        >
                            {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />}
                            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
                        </Button>
                        <Button
                            size="sm"
                            data-testid="packet-download-pdf"
                            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 dark:from-sky-500 dark:to-sky-600 dark:hover:from-sky-600 dark:hover:to-sky-700 text-white h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm active:scale-[0.98]"
                            onClick={downloadPdf}
                            disabled={downloading}
                        >
                            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                            <span className="hidden sm:inline">{downloading ? 'Generating...' : 'Download PDF'}</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Packet Content */}
            <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                <div className="space-y-4 sm:space-y-6 p-4 sm:p-8 bg-card rounded-xl border border-border">
                    {/* Branding Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-border">
                        <div className="flex items-center gap-3 sm:gap-4">
                            {brand?.logo_url ? (
                                <img
                                    src={brand.logo_url}
                                    alt={brand.name}
                                    className="h-10 sm:h-12 w-auto"
                                />
                            ) : (
                                <div
                                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center text-white font-bold text-base sm:text-lg"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {brand?.name ? brand.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : 'US'}
                                </div>
                            )}
                            <div>
                                <h2 className="font-semibold text-foreground text-sm sm:text-base">{brand?.name || 'UtilitySheet'}</h2>
                                <p className="text-xs sm:text-sm text-muted-foreground">{brand?.contact_phone || ''}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-xs sm:text-sm text-muted-foreground">{brand?.contact_email || ''}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">{brand?.contact_website || ''}</p>
                        </div>
                    </div>

                    {/* Title Section */}
                    <div className="text-center py-4 sm:py-6">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3 sm:mb-4">
                            {defaultTitle}
                        </h1>
                        <div className="inline-flex items-center gap-2 bg-muted px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg">
                            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 dark:text-sky-400 shrink-0" />
                            <span className="text-foreground font-medium text-sm sm:text-base">{request.property_address}</span>
                        </div>
                        {showGenerationDate && (
                            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                Generated {format(new Date(request.created_at), 'MMMM d, yyyy')}
                            </div>
                        )}
                    </div>

                    {/* Utility Table */}
                    <Card className="border-border bg-card/50">
                        <CardHeader className="pb-2 px-4 sm:px-6">
                            <h3 className="text-base sm:text-lg font-semibold text-foreground">Utilities</h3>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <div className="space-y-3 sm:hidden">
                                {utilities.length === 0 ? (
                                    <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                                        No utility information provided yet.
                                    </div>
                                ) : (
                                    utilities.map((utility, index) => (
                                        <div key={index} className="rounded-lg border border-border p-4 space-y-3 bg-background/50">
                                            {(() => {
                                                const trashScheduleLines = utility.category === 'trash'
                                                    ? getTrashScheduleLines(utility.trash_details)
                                                    : [];
                                                const showMeter = utility.category === 'electric' && utility.meter_number?.trim();
                                                return (
                                                    <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">
                                                    {UTILITY_CATEGORIES.find(c => c.key === utility.category)?.icon || '🏢'}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground text-sm">
                                                        {UTILITY_CATEGORIES.find(c => c.key === utility.category)?.label ||
                                                            utility.category.charAt(0).toUpperCase() + utility.category.slice(1)}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground truncate">{utility.provider_name}</p>
                                                </div>
                                            </div>
                                            {(showMeter || trashScheduleLines.length > 0) && (
                                                <div className="space-y-1 text-xs text-muted-foreground">
                                                    {showMeter && (
                                                        <p>Meter #: {utility.meter_number?.trim()}</p>
                                                    )}
                                                    {trashScheduleLines.map((line) => (
                                                        <p key={`${utility.category}-${line}`}>{line}</p>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                {utility.provider_phone && (
                                                    <a
                                                        href={`tel:${utility.provider_phone}`}
                                                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                                                        onClick={() => trackEvent('packet_action_clicked', { action: 'phone_tap', location: 'packet_mobile_card' })}
                                                    >
                                                        <Phone className="h-4 w-4" />
                                                        Call
                                                    </a>
                                                )}
                                                {utility.provider_website && (
                                                    <a
                                                        href={utility.provider_website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                                                        onClick={() => trackEvent('packet_action_clicked', { action: 'website_tap', location: 'packet_mobile_card' })}
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Website
                                                    </a>
                                                )}
                                            </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="hidden sm:block rounded-lg border border-border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm">Utility</TableHead>
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm">Provider</TableHead>
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">Contact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {utilities.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    No utility information provided yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            utilities.map((utility, index) => (
                                                <TableRow key={index} className="border-border hover:bg-muted/50">
                                                    {(() => {
                                                        const trashScheduleLines = utility.category === 'trash'
                                                            ? getTrashScheduleLines(utility.trash_details)
                                                            : [];
                                                        const showMeter = utility.category === 'electric' && utility.meter_number?.trim();
                                                        return (
                                                            <>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">
                                                                {UTILITY_CATEGORIES.find(c => c.key === utility.category)?.icon || '🏢'}
                                                            </span>
                                                            <span className="font-medium text-foreground">
                                                                {UTILITY_CATEGORIES.find(c => c.key === utility.category)?.label ||
                                                                    utility.category.charAt(0).toUpperCase() + utility.category.slice(1)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {utility.provider_name}
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <div className="flex items-center gap-3">
                                                            {utility.provider_phone && (
                                                                <a
                                                                    href={`tel:${utility.provider_phone}`}
                                                                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-400 dark:text-sky-400 dark:hover:text-sky-300"
                                                                    onClick={() => trackEvent('packet_action_clicked', { action: 'phone_tap', location: 'packet_table' })}
                                                                >
                                                                    <Phone className="h-3 w-3" />
                                                                    {utility.provider_phone}
                                                                </a>
                                                            )}
                                                            {utility.provider_website && (
                                                                <a
                                                                    href={utility.provider_website}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                                                                    onClick={() => trackEvent('packet_action_clicked', { action: 'website_tap', location: 'packet_table' })}
                                                                >
                                                                    <ExternalLink className="h-3 w-3" />
                                                                    Website
                                                                </a>
                                                            )}
                                                        </div>
                                                        {(showMeter || trashScheduleLines.length > 0) && (
                                                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                                {showMeter && (
                                                                    <p>Meter #: {utility.meter_number?.trim()}</p>
                                                                )}
                                                                {trashScheduleLines.map((line) => (
                                                                    <p key={`${utility.category}-table-${line}`}>{line}</p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                            </>
                                                        );
                                                    })()}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {isAdvanced && advancedSections.length > 0 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader className="pb-2 px-4 sm:px-6">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground">Additional Home Details</h3>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 space-y-3">
                                {advancedSections.map((section) => (
                                    <div key={section.key} className="rounded-lg border border-border p-3 sm:p-4 space-y-2">
                                        <h4 className="font-medium text-foreground text-sm sm:text-base">{section.title}</h4>
                                        {section.fields.length === 0 ? (
                                            <p className="text-xs sm:text-sm text-muted-foreground italic">No details provided</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {section.fields.map((field) => (
                                                    <div key={`${section.key}-${field.key}`} className="text-xs sm:text-sm">
                                                        <span className="text-muted-foreground">{field.label}: </span>
                                                        <span className="text-foreground">{field.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Next Steps */}
                    <Card className="border-border bg-card/50">
                        <CardHeader className="pb-2 px-4 sm:px-6">
                            <h3 className="text-base sm:text-lg font-semibold text-foreground">{nextStepsTitle}</h3>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <ol className="space-y-2.5 sm:space-y-3 text-muted-foreground text-sm sm:text-base">
                                {buyerSteps.map((step, index) => (
                                    <li key={index} className="flex gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-500/20 text-slate-600 dark:bg-sky-500/20 dark:text-sky-400 flex items-center justify-center text-sm font-medium">
                                            {index + 1}
                                        </span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>

                    {/* Footer */}
                    <div className="text-center pt-6 border-t border-border">
                        {brand?.disclaimer_text ? (
                            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-2">
                                {brand.disclaimer_text}
                            </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                            {showPoweredBy ? (
                                <>
                                    <a
                                        href="https://utilitysheet.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-4 hover:text-foreground"
                                    >
                                        Powered by UtilitySheet
                                    </a>
                                    {brand?.contact_email ? (
                                        <>
                                            <span className="mx-2">&bull;</span>
                                            <span>{brand.contact_email}</span>
                                        </>
                                    ) : null}
                                </>
                            ) : brand?.contact_email ? (
                                <span>{brand.contact_email}</span>
                            ) : null}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
