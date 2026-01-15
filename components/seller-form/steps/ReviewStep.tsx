'use client';

import { motion } from 'framer-motion';
import { Check, Pencil, Loader2, ArrowRight, Zap, Droplets, Flame, Fuel, FlameKindling, Trash2, Wifi, Tv, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import { UtilityCategory } from '@/types';

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
    onSubmit: () => Promise<void>;
    submitting: boolean;
}

export function ReviewStep({
    state,
    visibleUtilities,
    onBack,
    onEditBasics,
    onEditUtility,
    onSubmit,
    submitting
}: ReviewStepProps) {

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

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 sm:space-y-8"
        >
            <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Review & Submit</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Please verify your information below.</p>
            </div>

            <div className="space-y-4 sm:space-y-6">
                {/* Home Basics Summary */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="font-semibold text-foreground text-sm sm:text-base">Home Basics</h4>
                        <button
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
                            const label = cat.charAt(0).toUpperCase() + cat.slice(1);
                            const iconConfig = categoryIcons[cat];
                            const Icon = iconConfig?.icon || Zap;
                            const colorClass = iconConfig?.color || 'text-slate-500';

                            return (
                                <div key={cat} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 last:pb-0">
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
                                                onClick={() => onEditUtility(index)}
                                                className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                title={`Edit ${label}`}
                                            >
                                                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="pt-2 sm:pt-4 flex gap-2 sm:gap-3">
                <button
                    onClick={onBack}
                    className="flex-1 py-3 sm:py-4 text-center rounded-xl font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm sm:text-base"
                    disabled={submitting}
                >
                    Back
                </button>
                <button
                    onClick={onSubmit}
                    disabled={submitting}
                    className="flex-[2] py-3 sm:py-4 text-center rounded-xl font-bold bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
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
