'use client';

import { motion } from 'framer-motion';
import { Droplets, Flame, Waves, Wifi, Tv, Trash2, Check, Flower2, ShieldCheck, Wrench, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import type { AdvancedModuleKey, SewerType, UtilityCategory, WaterSource } from '@/types';
import { ADVANCED_MODULE_KEYS } from '@/lib/packet/modules';
import { wizardFocusRing, wizardPrimaryButton } from '../wizard-ui';

interface HomeBasicsStepProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    requestedUtilityCategories: UtilityCategory[];
    configuredAdvancedModules: AdvancedModuleKey[];
    onNext: () => void;
}

export function HomeBasicsStep({ state, updateState, requestedUtilityCategories, configuredAdvancedModules, onNext }: HomeBasicsStepProps) {
    const optionalUtilities = [
        { id: 'trash' as const, label: 'Trash & Recycling', icon: Trash2 },
        { id: 'internet' as const, label: 'Internet', icon: Wifi },
        { id: 'cable' as const, label: 'Cable/TV', icon: Tv },
    ] satisfies { id: UtilityCategory; label: string; icon: LucideIcon }[];

    const availableOptionalUtilities = optionalUtilities.filter((u) =>
        requestedUtilityCategories.includes(u.id)
    );
    const configuredAdvancedModuleSet = new Set(configuredAdvancedModules);
    const enabledAdvancedModuleSet = new Set(state.advanced_modules);
    const showAdvancedModuleSelector = state.packet_mode === 'advanced' && configuredAdvancedModules.length > 0;

    const advancedGroups = [
        {
            id: 'outdoor_irrigation',
            label: 'Outdoor Care & Irrigation',
            helper: 'Lawn/snow contacts, irrigation schedule, and seasonal notes.',
            icon: Flower2,
            moduleKeys: ['lawn_exterior', 'irrigation_seasonal_controls'] as AdvancedModuleKey[],
        },
        {
            id: 'smart_home_security',
            label: 'Security & Smart Devices',
            helper: 'Alarm, thermostat, and doorbell details.',
            icon: ShieldCheck,
            moduleKeys: ['smart_home_security'] as AdvancedModuleKey[],
        },
        {
            id: 'service_providers',
            label: 'Home Service Contacts',
            helper: 'HVAC, pest control, and plumber contacts.',
            icon: Wrench,
            moduleKeys: ['service_providers'] as AdvancedModuleKey[],
        },
        {
            id: 'mailbox_access',
            label: 'Mailbox & Home Access',
            helper: 'Mailbox location, parking notes, breaker panel, and water shutoff.',
            icon: KeyRound,
            moduleKeys: ['mailbox_access'] as AdvancedModuleKey[],
        },
    ] as const;

    const toggleAdvancedModuleGroup = (moduleKeys: AdvancedModuleKey[]) => {
        const availableKeys = moduleKeys.filter((moduleKey) => configuredAdvancedModuleSet.has(moduleKey));
        if (availableKeys.length === 0) return;

        const allEnabled = availableKeys.every((moduleKey) => enabledAdvancedModuleSet.has(moduleKey));
        const nextSet = new Set(
            state.advanced_modules.filter((moduleKey) => configuredAdvancedModuleSet.has(moduleKey))
        );

        if (allEnabled) {
            availableKeys.forEach((moduleKey) => nextSet.delete(moduleKey));
        } else {
            availableKeys.forEach((moduleKey) => nextSet.add(moduleKey));
        }

        const nextModules = ADVANCED_MODULE_KEYS.filter((moduleKey) => nextSet.has(moduleKey));
        updateState({ advanced_modules: nextModules });
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 sm:space-y-8"
        >
            <div className="text-center space-y-1 sm:space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Home Basics</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Let&apos;s start with the essentials.</p>
            </div>

            {/* Water Source */}
            <div className="space-y-3 sm:space-y-4">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                    <Droplets className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Water Source
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                        { id: 'city', label: 'Public Water', hint: "We'll ask the provider name next" },
                        { id: 'well', label: 'Private Well' },
                        { id: 'hoa', label: 'HOA / Condo' },
                        { id: 'not_sure', label: 'Not Sure' },
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateState({ water_source: opt.id as WaterSource })}
                            aria-pressed={state.water_source === opt.id}
                            className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all active:scale-95 ${wizardFocusRing} ${state.water_source === opt.id
                                ? 'bg-[var(--brand-accent-soft)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                }`}
                        >
                            <span className="block font-medium text-sm sm:text-base">{opt.label}</span>
                            {opt.hint && (
                                <span className="block text-[10px] sm:text-xs opacity-70 mt-0.5">{opt.hint}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sewer Type */}
            <div className="space-y-3 sm:space-y-4">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                    <Waves className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Sewer Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                        { id: 'public', label: 'Public Sewer', hint: "We'll ask the authority next" },
                        { id: 'septic', label: 'Septic System' },
                        { id: 'hoa', label: 'HOA / Condo' },
                        { id: 'not_sure', label: 'Not Sure' },
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateState({ sewer_type: opt.id as SewerType })}
                            aria-pressed={state.sewer_type === opt.id}
                            className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all active:scale-95 ${wizardFocusRing} ${state.sewer_type === opt.id
                                ? 'bg-[var(--brand-accent-soft)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                }`}
                        >
                            <span className="block font-medium text-sm sm:text-base">{opt.label}</span>
                            {opt.hint && (
                                <span className="block text-[10px] sm:text-xs opacity-70 mt-0.5">{opt.hint}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Heating Fuels */}
            <div className="space-y-3 sm:space-y-4">
                <div>
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                        <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Fuel Sources
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">Select all that apply to your home.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                        { id: 'natural_gas', label: 'Natural Gas' },
                        { id: 'propane', label: 'Propane' },
                        { id: 'oil', label: 'Heating Oil' },
                        { id: 'electric', label: 'Electric' }
                    ].map((fuel) => {
                        const isSelected = state.fuels_present.includes(fuel.id);
                        return (
                            <button
                                key={fuel.id}
                                type="button"
                                onClick={() => {
                                    let next = [...state.fuels_present];
                                    if (isSelected) {
                                        next = next.filter(f => f !== fuel.id);
                                    } else {
                                        next.push(fuel.id);
                                    }

                                    // Auto-update primary if single fuel
                                    let nextPrimary = state.primary_heating_type;
                                    if (next.length === 1) {
                                        nextPrimary = next[0];
                                    } else if (next.length === 0) {
                                        nextPrimary = null;
                                    } else if (!next.includes(nextPrimary || '')) {
                                        // If current primary is removed, reset
                                        nextPrimary = null;
                                    }

                                    updateState({
                                        fuels_present: next,
                                        primary_heating_type: nextPrimary
                                    });
                                }}
                                aria-pressed={isSelected}
                                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all active:scale-95 ${wizardFocusRing} ${isSelected
                                    ? 'bg-[var(--brand-accent-soft)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                    : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                    }`}
                            >
                                <span className="block font-medium text-sm sm:text-base">{fuel.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Primary Heat Source - Conditional */}
            {state.fuels_present.length > 1 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 sm:space-y-4"
                >
                    <div>
                        <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Which is the primary heat source?
                        </label>
                        <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">This determines which heating provider we ask about next.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        {state.fuels_present.map((fuelId) => {
                            const label = fuelId === 'natural_gas' ? 'Natural Gas' :
                                fuelId === 'propane' ? 'Propane' :
                                    fuelId === 'oil' ? 'Heating Oil' :
                                        'Electric';

                            return (
                                <button
                                    key={fuelId}
                                    type="button"
                                    onClick={() => updateState({ primary_heating_type: fuelId })}
                                    aria-pressed={state.primary_heating_type === fuelId}
                                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all active:scale-95 ${wizardFocusRing} ${state.primary_heating_type === fuelId
                                        ? 'bg-[var(--brand-accent-soft)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                        : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                        }`}
                                >
                                    <span className="block font-medium text-sm sm:text-base">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {(availableOptionalUtilities.length > 0 || showAdvancedModuleSelector) && (
                <div className="pt-2 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Optional</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
            )}

            {/* Optional Utilities */}
            {availableOptionalUtilities.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                        <span className="inline-flex -space-x-1">
                            {availableOptionalUtilities.slice(0, 3).map((u) => {
                                const Icon = u.icon;
                                return (
                                    <span key={u.id} className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted/60 border border-border">
                                        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[color:var(--brand-accent)]" />
                                    </span>
                                );
                            })}
                        </span>
                        Do you have these utilities?
                    </label>
                    <p className="text-xs text-muted-foreground -mt-1 sm:-mt-2">
                        Choose any that apply. We&apos;ll only ask about utilities you have.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        {availableOptionalUtilities.map((util) => {
                            const isSelected = state.optional_utilities.includes(util.id);
                            const Icon = util.icon;
                            return (
                                <button
                                    key={util.id}
                                    type="button"
                                    onClick={() => {
                                        const next = isSelected
                                            ? state.optional_utilities.filter((u) => u !== util.id)
                                            : [...state.optional_utilities, util.id];
                                        updateState({ optional_utilities: next });
                                    }}
                                    aria-pressed={isSelected}
                                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all relative active:scale-95 ${wizardFocusRing} ${isSelected
                                        ? 'bg-[var(--brand-accent-softer)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                        : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        <span className="block font-medium text-sm sm:text-base">{util.label}</span>
                                    </div>
                                    {/* Checkmark indicator */}
                                    <div className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-[color:var(--brand-accent)] text-white'
                                        : 'bg-muted/60 border border-border text-muted-foreground/50'
                                        }`}>
                                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {showAdvancedModuleSelector && (
                <div className="space-y-3 sm:space-y-4">
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                        <span className="inline-flex -space-x-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted/60 border border-border">
                                <Flower2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[color:var(--brand-accent)]" />
                            </span>
                            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted/60 border border-border">
                                <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[color:var(--brand-accent)]" />
                            </span>
                            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted/60 border border-border">
                                <Wrench className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[color:var(--brand-accent)]" />
                            </span>
                        </span>
                        Optional handoff details
                    </label>
                    <p className="text-xs text-muted-foreground -mt-1 sm:-mt-2">
                        These help the next owner take over smoothly. Each section you pick adds one short page. You can skip any field later.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {advancedGroups.map((group) => {
                            const availableKeys = group.moduleKeys.filter((moduleKey) => configuredAdvancedModuleSet.has(moduleKey));
                            if (availableKeys.length === 0) return null;

                            const Icon = group.icon;
                            const isSelected = availableKeys.every((moduleKey) => enabledAdvancedModuleSet.has(moduleKey));

                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => toggleAdvancedModuleGroup(group.moduleKeys)}
                                    aria-pressed={isSelected}
                                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all relative active:scale-95 ${wizardFocusRing} ${isSelected
                                        ? 'bg-[var(--brand-accent-softer)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                        : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                        }`}
                                    data-testid={`advanced-group-${group.id}`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm sm:text-base">{group.label}</p>
                                            <p className="text-xs opacity-90 mt-0.5">{group.helper}</p>
                                        </div>
                                    </div>
                                    <div className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-[color:var(--brand-accent)] text-white'
                                        : 'bg-muted/60 border border-border text-muted-foreground/50'
                                        }`}>
                                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="pt-4 sm:pt-6">
                <button
                    type="button"
                    onClick={onNext}
                    className={`w-full py-3 sm:py-4 text-center font-semibold text-sm sm:text-base ${wizardPrimaryButton}`}
                >
                    Continue
                </button>
            </div>
        </motion.div>
    );
}
