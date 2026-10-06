'use client';

import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Building2, Droplets, Flame, Waves, Wifi, Tv, Trash2, Check, Flower2, ShieldCheck, Wrench, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import type { AdvancedModuleKey, SewerType, UtilityCategory, WaterSource } from '@/types';
import { ADVANCED_MODULE_KEYS } from '@/lib/packet/modules';
import {
    FUEL_SOURCE_OPTIONS,
    SEWER_TYPE_OPTIONS,
    WATER_SOURCE_OPTIONS,
    getFuelSourceLabel,
} from '@/lib/packet/seller-questions';
import {
    HAS_HOA_OPTIONS,
    HOA_DUES_FREQUENCY_OPTIONS,
    HOA_GATE_PROMPT,
    HOA_TEXT_FIELDS,
} from '@/lib/packet/hoa';
import { wizardFocusRing, wizardPrimaryButton, wizardTextInput } from '../wizard-ui';

interface HomeBasicsStepProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    requestedUtilityCategories: UtilityCategory[];
    configuredAdvancedModules: AdvancedModuleKey[];
    /** Off when the requesting account turned the HOA questions off in Settings. */
    collectHoaQuestions?: boolean;
    onNext: () => void;
}

export function HomeBasicsStep({ state, updateState, requestedUtilityCategories, configuredAdvancedModules, collectHoaQuestions = true, onNext }: HomeBasicsStepProps) {
    const hideHoaBilling = collectHoaQuestions && state.has_hoa === 'no';
    const pendingChoices = hideHoaBilling ? (state.hoaUtilityReselection || []) : [];
    const waterOptions = WATER_SOURCE_OPTIONS.filter((option) => !hideHoaBilling || option.id !== 'hoa');
    const sewerOptions = SEWER_TYPE_OPTIONS.filter((option) => !hideHoaBilling || option.id !== 'hoa');
    const selectUtility = (field: 'water_source' | 'sewer_type', value: WaterSource | SewerType) => {
        updateState({
            [field]: value,
            hoaUtilityReselection: pendingChoices.filter((pending) => pending !== field),
        });
    };
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

            {/* HOA / Condo Association */}
            {collectHoaQuestions && (
                <div className="space-y-3 sm:space-y-4">
                    <div>
                        <p id="basics-hoa-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            {HOA_GATE_PROMPT}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">Homeowners, condo, and townhome associations all count.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-labelledby="basics-hoa-label">
                        {HAS_HOA_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => updateState({ has_hoa: opt.id })}
                                aria-pressed={state.has_hoa === opt.id}
                                data-testid={`has-hoa-${opt.id}`}
                                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-center transition-all active:scale-95 ${wizardFocusRing} ${state.has_hoa === opt.id
                                    ? 'bg-[var(--brand-accent-soft)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)] shadow-lg'
                                    : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                    }`}
                            >
                                <span className="block font-medium text-sm sm:text-base">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {pendingChoices.length > 0 && (
                <p role="status" className="text-sm text-[color:var(--brand-accent)]">
                    Since this home is not part of an association, please update your {pendingChoices.map((field) => field === 'water_source' ? 'water' : 'sewer').join(' and ')} selection{pendingChoices.length > 1 ? 's' : ''}.
                </p>
            )}

            {/* Water Source */}
            <div className="space-y-3 sm:space-y-4">
                <p id="basics-water-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                    <Droplets className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Water Source
                </p>
                <div className={`grid gap-2 sm:gap-3 ${hideHoaBilling ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`} role="group" aria-labelledby="basics-water-label">
                    {waterOptions.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => selectUtility('water_source', opt.id)}
                            aria-pressed={!pendingChoices.includes('water_source') && state.water_source === opt.id}
                            className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all active:scale-95 ${wizardFocusRing} ${!pendingChoices.includes('water_source') && state.water_source === opt.id
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
                <p id="basics-sewer-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                    <Waves className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Sewer Type
                </p>
                <div className={`grid gap-2 sm:gap-3 ${hideHoaBilling ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`} role="group" aria-labelledby="basics-sewer-label">
                    {sewerOptions.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => selectUtility('sewer_type', opt.id)}
                            aria-pressed={!pendingChoices.includes('sewer_type') && state.sewer_type === opt.id}
                            className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all active:scale-95 ${wizardFocusRing} ${!pendingChoices.includes('sewer_type') && state.sewer_type === opt.id
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
                    <p id="basics-fuels-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                        <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Fuel Sources
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">Select all that apply to your home.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3" role="group" aria-labelledby="basics-fuels-label">
                    {FUEL_SOURCE_OPTIONS.map((fuel) => {
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
                        <p id="basics-primary-heat-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
                            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Which is the primary heat source?
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">Shown as the home&apos;s heating type on the finished sheet.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3" role="group" aria-labelledby="basics-primary-heat-label">
                        {state.fuels_present.map((fuelId) => {
                            const label = getFuelSourceLabel(fuelId);

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

                {/* Association details - only after a Yes */}
                {collectHoaQuestions && state.has_hoa === 'yes' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="rounded-xl border border-border bg-card/50 p-3 sm:p-4 space-y-3"
                        data-testid="hoa-details"
                    >
                        <h4 className="font-medium text-sm sm:text-base">HOA / Condo Association Details</h4>
                        <p className="text-xs text-muted-foreground">Fill in what you know. You can skip anything you don&apos;t have handy.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {HOA_TEXT_FIELDS.map((field) => (
                                <Fragment key={field.key}>
                                    <div className={`space-y-1 ${field.key === 'hoa_portal_or_payment' ? 'sm:col-span-2' : ''}`}>
                                        <label htmlFor={`hoa-${field.key}`} className="block text-xs sm:text-sm font-medium text-muted-foreground">
                                            {field.label}
                                        </label>
                                        <input
                                            id={`hoa-${field.key}`}
                                            type={field.inputType}
                                            inputMode={field.inputType}
                                            autoComplete="off"
                                            value={state[field.key] || ''}
                                            maxLength={field.maxLength}
                                            onChange={(e) => updateState({ [field.key]: e.target.value })}
                                            placeholder={field.example}
                                            aria-describedby={field.helper ? `hoa-${field.key}-helper` : undefined}
                                            className={`py-2.5 px-3 text-base sm:text-sm rounded-lg ${wizardTextInput}`}
                                        />
                                        {field.helper && (
                                            <p id={`hoa-${field.key}-helper`} className="text-xs text-muted-foreground">{field.helper}</p>
                                        )}
                                    </div>
                                    {field.key === 'hoa_dues_amount' && (
                                        <div className="space-y-1">
                                            <p id="hoa-dues-frequency-label" className="block text-xs sm:text-sm font-medium text-muted-foreground">
                                                How Often
                                            </p>
                                            <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="hoa-dues-frequency-label">
                                                {HOA_DUES_FREQUENCY_OPTIONS.map((opt) => {
                                                    const isSelected = state.hoa_dues_frequency === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => updateState({ hoa_dues_frequency: isSelected ? null : opt.id })}
                                                            aria-pressed={isSelected}
                                                            data-testid={`hoa-dues-frequency-${opt.id}`}
                                                            className={`py-2.5 px-2 rounded-lg border text-center text-sm font-medium transition-all active:scale-95 ${wizardFocusRing} ${isSelected
                                                                ? 'bg-[var(--brand-accent-soft)] border-[color:var(--brand-accent-border)] text-[color:var(--brand-accent)]'
                                                                : 'bg-muted/40 border-border text-muted-foreground hover:border-ring hover:bg-muted'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </Fragment>
                            ))}
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
                    <p id="basics-optional-utilities-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
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
                    </p>
                    <p className="text-xs text-muted-foreground -mt-1 sm:-mt-2">
                        Choose any that apply. We&apos;ll only ask about utilities you have.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3" role="group" aria-labelledby="basics-optional-utilities-label">
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
                    <p id="basics-handoff-label" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[color:var(--brand-accent)]">
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
                    </p>
                    <p className="text-xs text-muted-foreground -mt-1 sm:-mt-2">
                        These help the next owner take over smoothly. Each section you pick adds one short page. You can skip any field later.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3" role="group" aria-labelledby="basics-handoff-label">
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
                    disabled={pendingChoices.length > 0}
                    aria-describedby={pendingChoices.length > 0 ? 'basics-continue-blocked' : undefined}
                    className={`w-full py-3 sm:py-4 text-center font-semibold text-sm sm:text-base ${wizardPrimaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    Continue
                </button>
                {pendingChoices.length > 0 && (
                    <p id="basics-continue-blocked" className="mt-2 text-center text-xs text-muted-foreground">
                        Choose a {pendingChoices.map((field) => field === 'water_source' ? 'water' : 'sewer').join(' and ')} option above to continue.
                    </p>
                )}
            </div>
        </motion.div>
    );
}
