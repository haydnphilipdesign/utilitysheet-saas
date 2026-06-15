'use client';

import { motion } from 'framer-motion';
import { Check, Pencil, Loader2, ArrowRight, Zap, Droplets, Flame, Fuel, FlameKindling, Trash2, Wifi, Tv, Waves, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import { AdvancedModuleKey, AdvancedPacketData, TrashUtilityExtra, UtilityCategory } from '@/types';
import { ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import { UTILITY_CATEGORIES } from '@/lib/constants';

// Category-specific icons (same as UtilityStep)
const categoryIcons: Record<UtilityCategory, { icon: LucideIcon; color: string }> = {
    electric: { icon: Zap, color: 'text-yellow-500' },
    water: { icon: Droplets, color: 'text-blue-500' },
    sewer: { icon: Waves, color: 'text-cyan-600' },
    gas: { icon: Flame, color: 'text-orange-500' },
    propane: { icon: Fuel, color: 'text-amber-600' },
    oil: { icon: FlameKindling, color: 'text-red-600' },
    trash: { icon: Trash2, color: 'text-green-600' },
    internet: { icon: Wifi, color: 'text-purple-500' },
    cable: { icon: Tv, color: 'text-indigo-500' },
};

interface ReviewStepProps {
    state: WizardState;
    visibleUtilities: UtilityCategory[];
    onBack: () => void;
    onEditBasics: () => void;
    onEditUtility?: (index: number) => void;
    updateUtility?: (category: UtilityCategory, updates: { meter_number?: string | null }) => void;
    collectElectricMeterNumber?: boolean;
    onSubmit: () => Promise<void>;
    submitting: boolean;
    packetMode?: 'simple' | 'advanced';
    advancedModules?: AdvancedModuleKey[];
    advancedData?: AdvancedPacketData;
    onEditAdvancedModule?: (moduleKey: AdvancedModuleKey) => void;
    submitError?: { kind: 'network' | 'server' | 'rate_limit' | 'unknown'; message: string } | null;
    onRetry?: () => void;
}

export function ReviewStep({
    state,
    visibleUtilities,
    onBack,
    onEditBasics,
    onEditUtility,
    updateUtility,
    collectElectricMeterNumber = false,
    onSubmit,
    submitting,
    packetMode = 'simple',
    advancedModules = [],
    advancedData = {},
    onEditAdvancedModule,
    submitError,
    onRetry,
}: ReviewStepProps) {
    const utilityLabels = Object.fromEntries(
        UTILITY_CATEGORIES.map((category) => [category.key, category.label])
    ) as Record<UtilityCategory, string>;

    const waterSourceLabel: Record<WizardState['water_source'], string> = {
        city: 'Public water',
        well: 'Private well',
        hoa: 'HOA / Condo',
        not_sure: 'Not sure',
    };

    const sewerTypeLabel: Record<WizardState['sewer_type'], string> = {
        public: 'Public sewer',
        septic: 'Septic system',
        hoa: 'HOA / Condo',
        not_sure: 'Not sure',
    };

    const formatPickupDay = (value: string | null | undefined): string => {
        if (!value) return 'Not sure';
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
        return dayLabels[value] || 'Not sure';
    };

    const formatPickupDays = (values: string[] | null | undefined): string => {
        if (!values || values.length === 0) return '';
        return values.map(formatPickupDay).join(', ');
    };

    const getTrashScheduleLines = (extra: TrashUtilityExtra | null): string[] => {
        if (!extra) return [];
        const lines: string[] = [];
        if (extra.has_recycling !== undefined && extra.has_recycling !== null) {
            const hasRecycling = extra.has_recycling === 'yes'
                ? 'Yes'
                : extra.has_recycling === 'no'
                    ? 'No'
                    : 'Not sure';
            lines.push(`Recycling: ${hasRecycling}`);
        }
        if (Array.isArray(extra.trash_pickup_days) && extra.trash_pickup_days.length > 0) {
            lines.push(`Trash pickup: ${formatPickupDays(extra.trash_pickup_days)}`);
        } else if (extra.trash_pickup_day !== undefined) {
            lines.push(`Trash pickup: ${formatPickupDay(extra.trash_pickup_day)}`);
        }
        if (extra.recycling_pickup_day !== undefined && extra.has_recycling !== 'no') {
            lines.push(`Recycling pickup: ${formatPickupDay(extra.recycling_pickup_day)}`);
        }
        return lines;
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 sm:space-y-8"
        >
            <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Review and Submit</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Please review your information below.</p>
            </div>

            <div className="space-y-4 sm:space-y-6">
                {/* Home Basics Summary */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="font-semibold text-foreground text-sm sm:text-base">Home Basics</h4>
                        <button
                            type="button"
                            onClick={onEditBasics}
                            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <Pencil className="h-3 w-3" />
                            Edit
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground mb-0.5 sm:mb-1 text-xs sm:text-sm">Water</p>
                            <p className="text-foreground text-sm sm:text-base">{waterSourceLabel[state.water_source]}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground mb-0.5 sm:mb-1 text-xs sm:text-sm">Sewer</p>
                            <p className="text-foreground text-sm sm:text-base">{sewerTypeLabel[state.sewer_type]}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-muted-foreground mb-1 text-xs sm:text-sm">Fuels Present</p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
                                {state.fuels_present.length > 0 ? (
                                    state.fuels_present.map(f => (
                                        <span key={f} className="px-2 py-0.5 sm:py-1 rounded bg-muted text-foreground text-xs capitalize">
                                            {f.replace('_', ' ')}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground italic text-xs sm:text-sm">None selected</span>
                                )}
                            </div>
                            {state.primary_heating_type && (
                                <div>
                                    <p className="text-muted-foreground mb-0.5 text-xs">Primary Heat</p>
                                    <span className="text-foreground text-sm capitalize font-medium">
                                        {state.primary_heating_type.replace('_', ' ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Utilities Summary */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="font-semibold text-foreground text-sm sm:text-base">Utility Providers</h4>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                        {visibleUtilities.map((cat, index) => {
                            const utilState = state.utilities[cat];
                            const label = utilityLabels[cat];
                            const iconConfig = categoryIcons[cat];
                            const Icon = iconConfig?.icon || Zap;
                            const colorClass = iconConfig?.color || 'text-slate-500';
                            const showMeterInput = collectElectricMeterNumber && cat === 'electric';
                            const trashExtra = cat === 'trash' && utilState?.extra && typeof utilState.extra === 'object'
                                ? (utilState.extra as TrashUtilityExtra)
                                : null;
                            const trashScheduleLines = cat === 'trash' ? getTrashScheduleLines(trashExtra) : [];

                            return (
                                <div key={cat} className="py-2 border-b border-border/50 last:border-0 last:pb-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colorClass}`} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
                                                <p className="text-sm sm:text-base text-foreground font-medium truncate">
                                                    {utilState?.display_name || <span className="italic text-muted-foreground">Not sure</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {utilState?.entry_mode !== null && (
                                                <div className="p-1 rounded-full bg-emerald-500/10">
                                                    <Check className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
                                                </div>
                                            )}
                                            {onEditUtility && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditUtility(index)}
                                                    className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    title={`Edit ${label}`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {showMeterInput && (
                                        <div className="mt-3 pl-10 sm:pl-12 space-y-1">
                                            <label className="text-xs sm:text-sm font-medium text-muted-foreground" htmlFor="review-electric-meter-number">
                                                Meter Number (optional)
                                            </label>
                                            <input
                                                id="review-electric-meter-number"
                                                type="text"
                                                value={utilState?.meter_number || ''}
                                                maxLength={64}
                                                onChange={(e) => updateUtility?.(cat, { meter_number: e.target.value })}
                                                placeholder="Enter electric meter number"
                                                className="w-full bg-muted/40 border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
                                                data-testid="review-electric-meter-number"
                                            />
                                        </div>
                                    )}
                                    {trashScheduleLines.length > 0 && (
                                        <div className="mt-3 pl-10 sm:pl-12 space-y-1 text-xs text-muted-foreground">
                                            {trashScheduleLines.map((line) => (
                                                <p key={`${cat}-${line}`}>{line}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {packetMode === 'advanced' && advancedModules.length > 0 && (
                    <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                            <h4 className="font-semibold text-foreground text-sm sm:text-base">Additional Home Details</h4>
                        </div>
                        <div className="space-y-3">
                            {advancedModules.map((moduleKey) => {
                                const moduleData = advancedData[moduleKey];
                                const rowItems = moduleData
                                    ? Object.entries(moduleData)
                                        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
                                        .map(([key, value]) => ({
                                            key,
                                            value: Array.isArray(value) ? value.join(', ') : String(value),
                                        }))
                                    : [];

                                return (
                                    <div key={moduleKey} className="rounded-lg border border-border/60 p-3">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <p className="text-sm font-medium text-foreground">{ADVANCED_MODULE_LABELS[moduleKey]}</p>
                                            {onEditAdvancedModule && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditAdvancedModule(moduleKey)}
                                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-400 hover:bg-muted hover:text-emerald-300 transition-colors"
                                                    title={`Edit ${ADVANCED_MODULE_LABELS[moduleKey]}`}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                        {rowItems.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">No details provided</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {rowItems.map((row) => (
                                                    <div key={row.key} className="text-xs sm:text-sm">
                                                        <span className="text-muted-foreground">{row.key.replaceAll('_', ' ')}: </span>
                                                        <span className="text-foreground">{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {submitError && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3"
                    data-testid="review-submit-error"
                >
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                        <p className="text-sm text-foreground font-medium">We couldn’t send your info.</p>
                        <p className="text-sm text-muted-foreground">{submitError.message}</p>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 mt-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 px-3 py-1.5 text-sm font-medium transition-colors"
                                data-testid="review-submit-retry"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="pt-2 sm:pt-4 flex gap-2 sm:gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-3 sm:py-4 text-center rounded-xl font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm sm:text-base"
                    disabled={submitting}
                >
                    Back
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="flex-[2] py-3 sm:py-4 text-center rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg shadow-emerald-900/20"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                            <span className="hidden sm:inline">Submitting...</span>
                            <span className="sm:hidden">Sending...</span>
                        </>
                    ) : (
                        <>
                            <span className="hidden sm:inline">Submit Information</span>
                            <span className="sm:hidden">Submit</span>
                            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}
