'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { SellerLayout } from './SellerLayout';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    AdvancedPacketData,
    HeatingType,
    PacketMode,
    ProviderSuggestion,
    SewerType,
    UtilityCategory,
    WaterSource,
} from '@/types';
import { WelcomeStep } from './steps/WelcomeStep';
import { HomeBasicsStep } from './steps/HomeBasicsStep';
import { UtilityStep } from './steps/UtilityStep';
import { AdvancedDetailsStep } from './steps/AdvancedDetailsStep';
import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';
import { trackEvent } from '@/lib/analytics/events';
import {
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_LABELS,
    getEffectiveAdvancedModules,
    normalizeAdvancedModuleExclusions,
} from '@/lib/packet/modules';
import { UTILITY_CATEGORIES } from '@/lib/constants';

export interface WizardState {
    water_source: WaterSource;
    sewer_type: SewerType;
    heating_type: HeatingType;
    fuels_present: string[];
    primary_heating_type: string | null;
    trash_handled_by: 'municipal' | 'private' | 'not_sure';
    optional_utilities: UtilityCategory[];
    packet_mode: PacketMode;
    advanced_modules: AdvancedModuleKey[];
    advanced_module_exclusions: AdvancedModuleExclusions;
    advanced: AdvancedPacketData;
    utilities: Record<UtilityCategory, UtilityWizardState>;
}

export interface UtilityWizardState {
    entry_mode: 'suggested_confirmed' | 'search_selected' | 'free_text' | 'unknown' | null;
    display_name: string | null;
    raw_text: string | null;
    meter_number?: string | null;
    canonical_id?: string | null;
    confidence_score?: number | null;
    hidden: boolean;
    contact_phone?: string | null;
    contact_url?: string | null;
    extra?: Record<string, unknown>;
}

interface BrandProfile {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

interface SellerWizardProps {
    initialRequestData: {
        property_address: string;
        utility_categories: UtilityCategory[];
        collect_electric_meter_number?: boolean;
        packet_mode?: PacketMode;
        advanced_modules?: AdvancedModuleKey[];
        advanced_module_exclusions?: AdvancedModuleExclusions;
        advanced_packet_data?: AdvancedPacketData;
    };
    initialSuggestions: Record<UtilityCategory, ProviderSuggestion[]>;
    token: string;
    brandProfile?: BrandProfile | null;
    isDemo?: boolean;
}

type AdvancedNavigationMode = 'linear' | 'review_edit';

export function SellerWizard({ initialRequestData, initialSuggestions, token, brandProfile, isDemo = false }: SellerWizardProps) {
    enum Step {
        WELCOME = 0,
        HOME_BASICS = 1,
        UTILITIES = 2,
        ADVANCED_DETAILS = 3,
        REVIEW = 4,
        SUCCESS = 5,
    }

    const [currentStep, setCurrentStep] = useState<Step>(Step.WELCOME);
    const [utilityIndex, setUtilityIndex] = useState(0);
    const [advancedModuleIndex, setAdvancedModuleIndex] = useState(0);
    const [advancedNavigationMode, setAdvancedNavigationMode] = useState<AdvancedNavigationMode>('linear');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<{ kind: 'network' | 'server' | 'rate_limit' | 'unknown'; message: string } | null>(null);
    const [autosaveFlash, setAutosaveFlash] = useState(false);
    const autosaveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [suggestionsByCategory, setSuggestionsByCategory] = useState<Record<UtilityCategory, ProviderSuggestion[]>>(initialSuggestions);
    const [loadingSuggestions, setLoadingSuggestions] = useState<Partial<Record<UtilityCategory, boolean>>>({});
    const shouldReduceMotion = useReducedMotion();
    const collectElectricMeterNumber = initialRequestData.collect_electric_meter_number !== false;
    const requestPacketMode: PacketMode = initialRequestData.packet_mode || 'simple';
    const requestAdvancedModules = initialRequestData.advanced_modules || [];
    const requestAdvancedModuleExclusions = normalizeAdvancedModuleExclusions(
        initialRequestData.advanced_module_exclusions || {},
        requestAdvancedModules
    );
    const configuredAdvancedModules = useMemo(
        () => (requestPacketMode === 'advanced'
            ? getEffectiveAdvancedModules(
                ADVANCED_MODULE_KEYS.filter((moduleKey) => requestAdvancedModules.includes(moduleKey)),
                requestAdvancedModuleExclusions
            )
            : []),
        [requestPacketMode, requestAdvancedModuleExclusions, requestAdvancedModules]
    );

    const [state, setState] = useState<WizardState>(() => ({
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        trash_handled_by: 'not_sure',
        optional_utilities: [],
        packet_mode: requestPacketMode,
        advanced_modules: configuredAdvancedModules,
        advanced_module_exclusions: requestAdvancedModuleExclusions,
        advanced: initialRequestData.advanced_packet_data || {},
        utilities: {} as Record<UtilityCategory, UtilityWizardState>,
    }));

    const [visibleUtilities, setVisibleUtilities] = useState<UtilityCategory[]>([]);
    const enabledAdvancedModules = state.packet_mode === 'advanced' ? state.advanced_modules : [];
    const orderedAdvancedModules = useMemo(
        () => getEffectiveAdvancedModules(enabledAdvancedModules, state.advanced_module_exclusions),
        [enabledAdvancedModules, state.advanced_module_exclusions]
    );
    const hasAdvancedStep = orderedAdvancedModules.length > 0;
    const currentAdvancedModule = orderedAdvancedModules[advancedModuleIndex];
    const draftStorageKey = `us_seller_draft:${token}`;
    const utilityLabels = useMemo(
        () => Object.fromEntries(UTILITY_CATEGORIES.map((category) => [category.key, category.label])) as Record<UtilityCategory, string>,
        []
    );

    useEffect(() => {
        if (isDemo) return;
        try {
            const raw = localStorage.getItem(draftStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
                v?: number;
                state?: WizardState;
                currentStep?: number;
                utilityIndex?: number;
                advancedModuleIndex?: number;
                advancedNavigationMode?: AdvancedNavigationMode;
            };
            if ((parsed?.v !== 1 && parsed?.v !== 2) || !parsed.state) return;

            setState(parsed.state);
            if (typeof parsed.currentStep === 'number') {
                setCurrentStep(Math.max(0, Math.min(Step.SUCCESS, parsed.currentStep)) as Step);
            }
            if (typeof parsed.utilityIndex === 'number') {
                setUtilityIndex(Math.max(0, parsed.utilityIndex));
            }
            if (parsed.v === 2 && typeof parsed.advancedModuleIndex === 'number') {
                setAdvancedModuleIndex(Math.max(0, parsed.advancedModuleIndex));
            }
            if (parsed.v === 2 && parsed.advancedNavigationMode) {
                setAdvancedNavigationMode(parsed.advancedNavigationMode);
            }
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isDemo]);

    useEffect(() => {
        if (isDemo) return;
        const timeout = setTimeout(() => {
            try {
                localStorage.setItem(
                    draftStorageKey,
                    JSON.stringify({
                        v: 2,
                        state,
                        currentStep,
                        utilityIndex,
                        advancedModuleIndex,
                        advancedNavigationMode,
                    })
                );
                if (currentStep > Step.WELCOME && currentStep < Step.SUCCESS) {
                    setAutosaveFlash(true);
                    if (autosaveFlashTimer.current) clearTimeout(autosaveFlashTimer.current);
                    autosaveFlashTimer.current = setTimeout(() => setAutosaveFlash(false), 1400);
                }
            } catch {
                // ignore
            }
        }, 250);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftStorageKey, state, currentStep, utilityIndex, advancedModuleIndex, advancedNavigationMode, isDemo]);

    useEffect(() => () => {
        if (autosaveFlashTimer.current) clearTimeout(autosaveFlashTimer.current);
    }, []);

    useEffect(() => {
        if (configuredAdvancedModules.length === 0) return;
        if (state.packet_mode !== 'advanced') return;

        const configuredSet = new Set(configuredAdvancedModules);
        const nextSet = new Set(
            state.advanced_modules.filter((moduleKey) => configuredSet.has(moduleKey))
        );

        const normalized = ADVANCED_MODULE_KEYS.filter((moduleKey) => nextSet.has(moduleKey));
        const sameLength = normalized.length === state.advanced_modules.length;
        const isSame = sameLength && normalized.every((moduleKey, index) => moduleKey === state.advanced_modules[index]);
        if (isSame) return;

        setState((prev) => ({
            ...prev,
            advanced_modules: normalized,
        }));
    }, [configuredAdvancedModules, state.packet_mode, state.advanced_modules]);

    useEffect(() => {
        if (isDemo) return;
        if (currentStep !== Step.HOME_BASICS && currentStep !== Step.UTILITIES) return;

        const currentCategory = currentStep === Step.UTILITIES ? visibleUtilities[utilityIndex] : visibleUtilities[0];
        const nextCategory = currentStep === Step.UTILITIES ? visibleUtilities[utilityIndex + 1] : visibleUtilities[1];
        const candidateCategories = [currentCategory, nextCategory].filter(Boolean) as UtilityCategory[];

        const categoriesToFetch = candidateCategories.filter((cat) => {
            const hasSuggestions = Object.prototype.hasOwnProperty.call(suggestionsByCategory, cat);
            return !hasSuggestions && !loadingSuggestions[cat];
        });

        if (categoriesToFetch.length === 0) return;

        setLoadingSuggestions((prev) => ({
            ...prev,
            ...Object.fromEntries(categoriesToFetch.map((cat) => [cat, true])),
        }));

        (async () => {
            try {
                const res = await fetch(`/api/seller/${token}/suggestions?categories=${encodeURIComponent(categoriesToFetch.join(','))}`);
                const data = await res.json().catch(() => ({}));

                const fetched = (res.ok ? data.suggestions : {}) as Partial<Record<UtilityCategory, ProviderSuggestion[]>>;
                setSuggestionsByCategory((prev) => {
                    const next = { ...prev };
                    categoriesToFetch.forEach((cat) => {
                        next[cat] = fetched?.[cat] || [];
                    });
                    return next as Record<UtilityCategory, ProviderSuggestion[]>;
                });
            } catch (error) {
                console.error('Failed to load suggestions:', error);
                setSuggestionsByCategory((prev) => {
                    const next = { ...prev };
                    categoriesToFetch.forEach((cat) => {
                        next[cat] = [];
                    });
                    return next as Record<UtilityCategory, ProviderSuggestion[]>;
                });
            } finally {
                setLoadingSuggestions((prev) => {
                    const next = { ...prev };
                    categoriesToFetch.forEach((cat) => {
                        next[cat] = false;
                    });
                    return next;
                });
            }
        })();
    }, [currentStep, utilityIndex, visibleUtilities, token, isDemo, suggestionsByCategory, loadingSuggestions]);

    useEffect(() => {
        const requestedCategories = new Set<UtilityCategory>(initialRequestData.utility_categories);
        const nextUtilities: UtilityCategory[] = ['electric'];

        if (requestedCategories.has('water') && state.water_source === 'city') {
            nextUtilities.push('water');
        }
        if (requestedCategories.has('sewer') && state.sewer_type === 'public') {
            nextUtilities.push('sewer');
        }

        const fuelMap: Record<string, UtilityCategory> = {
            natural_gas: 'gas',
            propane: 'propane',
            oil: 'oil',
        };

        state.fuels_present.forEach((fuel) => {
            const mapped = fuelMap[fuel];
            if (mapped && requestedCategories.has(mapped)) {
                nextUtilities.push(mapped);
            }
        });

        const preservedCategories: UtilityCategory[] = ['trash', 'internet', 'cable'];
        preservedCategories.forEach((cat) => {
            if (requestedCategories.has(cat) && state.optional_utilities.includes(cat)) {
                nextUtilities.push(cat);
            }
        });

        const uniqueUtils = Array.from(new Set(nextUtilities));
        setVisibleUtilities(uniqueUtils);

        setState((prev) => {
            const nextUtilitiesState = { ...prev.utilities };
            const visibleSet = new Set(uniqueUtils);
            let hasChanges = false;

            uniqueUtils.forEach((cat) => {
                if (!nextUtilitiesState[cat]) {
                    nextUtilitiesState[cat] = {
                        entry_mode: null,
                        display_name: null,
                        raw_text: null,
                        meter_number: null,
                        hidden: false,
                    };
                    hasChanges = true;
                } else if (nextUtilitiesState[cat].hidden) {
                    nextUtilitiesState[cat] = { ...nextUtilitiesState[cat], hidden: false };
                    hasChanges = true;
                }
            });

            Object.entries(nextUtilitiesState).forEach(([cat, utilState]) => {
                const category = cat as UtilityCategory;
                if (!visibleSet.has(category) && utilState && utilState.hidden === false) {
                    nextUtilitiesState[category] = { ...utilState, hidden: true };
                    hasChanges = true;
                }
            });

            return hasChanges ? { ...prev, utilities: nextUtilitiesState } : prev;
        });
    }, [state.water_source, state.sewer_type, state.fuels_present, state.optional_utilities, initialRequestData.utility_categories]);

    useEffect(() => {
        if (currentStep !== Step.UTILITIES) return;
        if (visibleUtilities.length === 0) return;
        if (utilityIndex <= visibleUtilities.length - 1) return;
        setUtilityIndex(visibleUtilities.length - 1);
    }, [currentStep, utilityIndex, visibleUtilities]);

    useEffect(() => {
        if (orderedAdvancedModules.length === 0) {
            setAdvancedModuleIndex(0);
            if (currentStep === Step.ADVANCED_DETAILS) {
                setCurrentStep(Step.REVIEW);
                setAdvancedNavigationMode('linear');
            }
            return;
        }

        setAdvancedModuleIndex((prev) => Math.min(prev, orderedAdvancedModules.length - 1));
    }, [orderedAdvancedModules, currentStep]);

    useEffect(() => {
        let stepLabel = 'welcome';
        if (currentStep === Step.HOME_BASICS) {
            stepLabel = 'home_basics';
        } else if (currentStep === Step.UTILITIES) {
            const currentCategory = visibleUtilities[utilityIndex];
            stepLabel = currentCategory ? `utility_${currentCategory}` : 'utilities';
        } else if (currentStep === Step.ADVANCED_DETAILS) {
            stepLabel = currentAdvancedModule ? `advanced_${currentAdvancedModule}` : 'advanced_details';
        } else if (currentStep === Step.REVIEW) {
            stepLabel = 'review';
        } else if (currentStep === Step.SUCCESS) {
            stepLabel = 'success';
        }

        trackEvent('seller_step_viewed', {
            step: stepLabel,
            location: isDemo ? 'demo_seller_flow' : 'seller_flow',
            packet_mode: state.packet_mode,
        });
    }, [currentStep, isDemo, utilityIndex, visibleUtilities, state.packet_mode, currentAdvancedModule]);

    const totalUtilities = visibleUtilities.length;
    const totalAdvancedSteps = orderedAdvancedModules.length;
    // Step counter: 1 (basics) + N utilities + M advanced + 1 (review)
    const totalSteps = 1 + totalUtilities + totalAdvancedSteps + 1;
    let currentStepNumber = 0;
    if (currentStep === Step.HOME_BASICS) currentStepNumber = 1;
    else if (currentStep === Step.UTILITIES) currentStepNumber = 1 + utilityIndex + 1;
    else if (currentStep === Step.ADVANCED_DETAILS) currentStepNumber = 1 + totalUtilities + advancedModuleIndex + 1;
    else if (currentStep === Step.REVIEW) currentStepNumber = totalSteps;
    else if (currentStep === Step.SUCCESS) currentStepNumber = totalSteps;

    // Front-load the progress slightly so the first few steps feel like meaningful momentum.
    // Welcome -> 8%, Basics -> 18%, then utilities + advanced split the middle, review = ~94%, success = 100%.
    let progress = 0;
    if (currentStep === Step.WELCOME) progress = 4;
    else if (currentStep === Step.HOME_BASICS) progress = 18;
    else if (currentStep === Step.UTILITIES) {
        const midSpan = 64; // 18 -> 82
        const midSlots = totalUtilities + totalAdvancedSteps;
        progress = 18 + ((utilityIndex + 1) / Math.max(midSlots, 1)) * midSpan;
    } else if (currentStep === Step.ADVANCED_DETAILS) {
        const midSpan = 64;
        const midSlots = totalUtilities + totalAdvancedSteps;
        progress = 18 + ((totalUtilities + advancedModuleIndex + 1) / Math.max(midSlots, 1)) * midSpan;
    } else if (currentStep === Step.REVIEW) progress = 94;
    else if (currentStep === Step.SUCCESS) progress = 100;
    progress = Math.min(Math.max(progress, 0), 100);

    const handleNext = () => {
        if (currentStep === Step.WELCOME) {
            setCurrentStep(Step.HOME_BASICS);
        } else if (currentStep === Step.HOME_BASICS) {
            setCurrentStep(Step.UTILITIES);
            setUtilityIndex(0);
        } else if (currentStep === Step.UTILITIES) {
            if (utilityIndex < visibleUtilities.length - 1) {
                setUtilityIndex((prev) => prev + 1);
            } else if (hasAdvancedStep) {
                setAdvancedModuleIndex(0);
                setAdvancedNavigationMode('linear');
                setCurrentStep(Step.ADVANCED_DETAILS);
            } else {
                setCurrentStep(Step.REVIEW);
            }
        } else if (currentStep === Step.ADVANCED_DETAILS) {
            if (advancedNavigationMode === 'review_edit') {
                setCurrentStep(Step.REVIEW);
                setAdvancedNavigationMode('linear');
                return;
            }

            if (advancedModuleIndex < orderedAdvancedModules.length - 1) {
                setAdvancedModuleIndex((prev) => prev + 1);
            } else {
                setCurrentStep(Step.REVIEW);
            }
        }
    };

    const handleBack = () => {
        if (currentStep === Step.HOME_BASICS) {
            setCurrentStep(Step.WELCOME);
        } else if (currentStep === Step.UTILITIES) {
            if (utilityIndex > 0) {
                setUtilityIndex((prev) => prev - 1);
            } else {
                setCurrentStep(Step.HOME_BASICS);
            }
        } else if (currentStep === Step.ADVANCED_DETAILS) {
            if (advancedNavigationMode === 'review_edit') {
                setCurrentStep(Step.REVIEW);
                setAdvancedNavigationMode('linear');
                return;
            }

            if (advancedModuleIndex > 0) {
                setAdvancedModuleIndex((prev) => prev - 1);
            } else {
                setCurrentStep(Step.UTILITIES);
                setUtilityIndex(Math.max(0, visibleUtilities.length - 1));
            }
        } else if (currentStep === Step.REVIEW) {
            if (hasAdvancedStep) {
                setAdvancedNavigationMode('linear');
                setAdvancedModuleIndex(Math.max(0, orderedAdvancedModules.length - 1));
                setCurrentStep(Step.ADVANCED_DETAILS);
            } else {
                setCurrentStep(Step.UTILITIES);
                setUtilityIndex(Math.max(0, visibleUtilities.length - 1));
            }
        }
    };

    const handleEditBasics = () => {
        setAdvancedNavigationMode('linear');
        setCurrentStep(Step.HOME_BASICS);
    };

    const handleEditAdvancedModule = (moduleKey: AdvancedModuleKey) => {
        const targetIndex = orderedAdvancedModules.findIndex((m) => m === moduleKey);
        if (targetIndex < 0) return;

        setAdvancedModuleIndex(targetIndex);
        setAdvancedNavigationMode('review_edit');
        setCurrentStep(Step.ADVANCED_DETAILS);
    };

    const updateUtilityState = (cat: UtilityCategory, updates: Partial<UtilityWizardState>) => {
        setState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [cat]: { ...prev.utilities[cat], ...updates },
            },
        }));
    };

    const updateAdvanced = (updates: Partial<AdvancedPacketData>) => {
        setState((prev) => ({
            ...prev,
            advanced: {
                ...prev.advanced,
                ...updates,
            },
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError(null);

        if (isDemo) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            trackEvent('seller_submitted', {
                source: 'seller_flow',
                utility_count: visibleUtilities.length,
                location: 'demo_seller_flow',
                packet_mode: state.packet_mode,
            });
            setCurrentStep(Step.SUCCESS);
            return;
        }

        try {
            const response = await fetch(`/api/seller/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state),
            });

            if (response.ok) {
                try {
                    localStorage.removeItem(draftStorageKey);
                } catch {
                    // ignore
                }
                trackEvent('seller_submitted', {
                    source: 'seller_flow',
                    utility_count: visibleUtilities.length,
                    location: 'seller_flow',
                    packet_mode: state.packet_mode,
                });
                setCurrentStep(Step.SUCCESS);
            } else {
                const errorBody = await response.json().catch(() => null);
                console.error('Submission failed', {
                    status: response.status,
                    error: errorBody,
                });
                const kind: 'server' | 'rate_limit' =
                    response.status === 429 ? 'rate_limit' : 'server';
                const message = response.status === 429
                    ? 'Too many submissions in a short window. Please wait a moment, then tap retry.'
                    : 'We couldn’t save your info just now. Your answers are still here. Tap retry to try again.';
                setSubmitError({ kind, message });
                setSubmitting(false);
            }
        } catch (err) {
            console.error('Failed to submit form:', err);
            const isNetwork = typeof navigator !== 'undefined' && navigator.onLine === false;
            setSubmitError({
                kind: isNetwork ? 'network' : 'unknown',
                message: isNetwork
                    ? 'You appear to be offline. Reconnect and tap retry. Your progress is saved.'
                    : 'Something interrupted the submission. Your answers are saved. Tap retry to try again.',
            });
            setSubmitting(false);
        }
    };

    const handleRetrySubmit = () => {
        trackEvent('seller_submission_retry_clicked', {
            error_kind: submitError?.kind || 'unknown',
            location: 'seller_flow',
        });
        handleSubmit();
    };

    return (
        <SellerLayout
            progress={progress}
            address={initialRequestData.property_address}
            stepName={(() => {
                switch (currentStep) {
                    case Step.WELCOME: return 'Welcome';
                    case Step.HOME_BASICS: return 'Home Basics';
                    case Step.UTILITIES: {
                        const cat = visibleUtilities[utilityIndex];
                        return cat ? `${utilityLabels[cat]} Provider` : 'Utilities';
                    }
                    case Step.ADVANCED_DETAILS: {
                        if (!currentAdvancedModule) return 'Additional Home Details';
                        return `${ADVANCED_MODULE_LABELS[currentAdvancedModule]} (${advancedModuleIndex + 1} of ${orderedAdvancedModules.length})`;
                    }
                    case Step.REVIEW: return 'Review';
                    case Step.SUCCESS: return 'Done';
                    default: return 'Progress';
                }
            })()}
            completedCount={visibleUtilities.filter((cat) => state.utilities[cat]?.entry_mode !== null).length}
            totalCount={visibleUtilities.length}
            brandProfile={brandProfile}
            stepNumber={currentStepNumber}
            stepTotal={totalSteps}
            autosaveFlash={autosaveFlash}
            sellerToken={isDemo ? undefined : token}
            showSaveLink={!isDemo && currentStep > Step.WELCOME && currentStep < Step.SUCCESS}
        >
            <AnimatePresence mode={shouldReduceMotion ? 'sync' : 'wait'} initial={!shouldReduceMotion}>
                {currentStep === Step.WELCOME && (() => {
                    const utilityCount = Math.max(1, visibleUtilities.length || initialRequestData.utility_categories.length);
                    const advancedCount = orderedAdvancedModules.length;
                    const totalSteps = 1 /* basics */ + utilityCount + advancedCount + 1 /* review */;
                    const estimatedMinutes = Math.max(2, Math.round(utilityCount * 0.5 + advancedCount * 1.0 + 1));
                    return (
                        <WelcomeStep
                            key="welcome"
                            address={initialRequestData.property_address}
                            onNext={handleNext}
                            estimatedMinutes={estimatedMinutes}
                            stepCount={totalSteps}
                        />
                    );
                })()}

                {currentStep === Step.HOME_BASICS && (
                    <HomeBasicsStep
                        key="basics"
                        state={state}
                        updateState={(updates) => setState((prev) => ({ ...prev, ...updates }))}
                        requestedUtilityCategories={initialRequestData.utility_categories}
                        configuredAdvancedModules={configuredAdvancedModules}
                        onNext={handleNext}
                    />
                )}

                {currentStep === Step.UTILITIES && visibleUtilities[utilityIndex] && (
                        <UtilityStep
                            key={`util-${visibleUtilities[utilityIndex]}`}
                            category={visibleUtilities[utilityIndex]}
                            categoryLabel={utilityLabels[visibleUtilities[utilityIndex]]}
                            state={state}
                            updateState={updateUtilityState}
                        suggestions={suggestionsByCategory[visibleUtilities[utilityIndex]] || []}
                        loadingSuggestions={!!loadingSuggestions[visibleUtilities[utilityIndex]] && !Object.prototype.hasOwnProperty.call(suggestionsByCategory, visibleUtilities[utilityIndex])}
                        token={token}
                        collectElectricMeterNumber={collectElectricMeterNumber}
                        onNext={handleNext}
                        onBack={handleBack}
                    />
                )}

                {currentStep === Step.ADVANCED_DETAILS && currentAdvancedModule && (
                    <AdvancedDetailsStep
                        key={`advanced-details-${currentAdvancedModule}-${advancedNavigationMode}`}
                        moduleKey={currentAdvancedModule}
                        moduleIndex={advancedModuleIndex}
                        moduleCount={orderedAdvancedModules.length}
                        isReviewEdit={advancedNavigationMode === 'review_edit'}
                        moduleExclusions={state.advanced_module_exclusions}
                        advanced={state.advanced}
                        updateAdvanced={updateAdvanced}
                        onBack={handleBack}
                        onNext={handleNext}
                    />
                )}

                {currentStep === Step.REVIEW && !submitting && (
                    <ReviewStep
                        key="review"
                        state={state}
                        visibleUtilities={visibleUtilities}
                        onBack={handleBack}
                        onEditBasics={handleEditBasics}
                        onEditUtility={(index) => {
                            setAdvancedNavigationMode('linear');
                            setCurrentStep(Step.UTILITIES);
                            setUtilityIndex(index);
                        }}
                        onEditAdvancedModule={handleEditAdvancedModule}
                        updateUtility={updateUtilityState}
                        collectElectricMeterNumber={collectElectricMeterNumber}
                        onSubmit={handleSubmit}
                        submitting={submitting}
                        packetMode={state.packet_mode}
                        advancedModules={orderedAdvancedModules}
                        advancedData={state.advanced}
                        submitError={submitError}
                        onRetry={handleRetrySubmit}
                    />
                )}

                {currentStep === Step.REVIEW && submitting && (
                    <motion.div
                        key="submitting-interstitial"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center flex-1 text-center space-y-6 py-12 px-2"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-[var(--brand-accent-softer)] blur-3xl rounded-full" />
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[color:var(--brand-accent)] flex items-center justify-center shadow-xl relative z-10">
                                <Loader2 className="h-9 w-9 sm:h-11 sm:w-11 text-white animate-spin" />
                            </div>
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Sending your info to your agent…</h2>
                            <p className="text-sm text-muted-foreground">This usually takes a few seconds. Please don’t close the tab.</p>
                        </div>
                    </motion.div>
                )}

                {currentStep === Step.SUCCESS && (
                    <SuccessStep
                        key="success"
                        isDemo={isDemo}
                        demoData={isDemo ? {
                            address: initialRequestData.property_address,
                            state,
                        } : undefined}
                        brandProfile={brandProfile || undefined}
                        sellerToken={isDemo ? undefined : token}
                        propertyAddress={initialRequestData.property_address}
                    />
                )}
            </AnimatePresence>
        </SellerLayout>
    );
}
