'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { SellerLayout } from './SellerLayout';
import type {
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
import { ADVANCED_MODULE_KEYS, ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import { toast } from 'sonner';

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
    advanced: AdvancedPacketData;
    utilities: Record<UtilityCategory, UtilityWizardState>;
}

export interface UtilityWizardState {
    entry_mode: 'suggested_confirmed' | 'search_selected' | 'free_text' | 'unknown' | null;
    display_name: string | null;
    raw_text: string | null;
    meter_number?: string | null;
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
    const [suggestionsByCategory, setSuggestionsByCategory] = useState<Record<UtilityCategory, ProviderSuggestion[]>>(initialSuggestions);
    const [loadingSuggestions, setLoadingSuggestions] = useState<Partial<Record<UtilityCategory, boolean>>>({});
    const shouldReduceMotion = useReducedMotion();
    const collectElectricMeterNumber = initialRequestData.collect_electric_meter_number !== false;
    const requestPacketMode: PacketMode = initialRequestData.packet_mode || 'simple';
    const requestAdvancedModules = initialRequestData.advanced_modules || [];

    const [state, setState] = useState<WizardState>(() => ({
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        trash_handled_by: 'not_sure',
        optional_utilities: [],
        packet_mode: requestPacketMode,
        advanced_modules: requestAdvancedModules,
        advanced: initialRequestData.advanced_packet_data || {},
        utilities: {} as Record<UtilityCategory, UtilityWizardState>,
    }));

    const [visibleUtilities, setVisibleUtilities] = useState<UtilityCategory[]>([]);
    const enabledAdvancedModules = state.packet_mode === 'advanced' ? state.advanced_modules : [];
    const orderedAdvancedModules = ADVANCED_MODULE_KEYS.filter((moduleKey) => enabledAdvancedModules.includes(moduleKey));
    const hasAdvancedStep = orderedAdvancedModules.length > 0;
    const currentAdvancedModule = orderedAdvancedModules[advancedModuleIndex];
    const draftStorageKey = `us_seller_draft:${token}`;

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
            } catch {
                // ignore
            }
        }, 250);

        return () => clearTimeout(timeout);
    }, [draftStorageKey, state, currentStep, utilityIndex, advancedModuleIndex, advancedNavigationMode, isDemo]);

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
    const totalStepsWeight = 1.5 + totalUtilities + totalAdvancedSteps + 1;
    let currentProgressWeight = 0;
    if (currentStep > Step.WELCOME) currentProgressWeight += 0.5;
    if (currentStep > Step.HOME_BASICS) currentProgressWeight += 1;
    if (currentStep === Step.UTILITIES) currentProgressWeight += utilityIndex;
    if (currentStep > Step.UTILITIES) currentProgressWeight += totalUtilities;
    if (currentStep === Step.ADVANCED_DETAILS) currentProgressWeight += advancedModuleIndex;
    if (currentStep > Step.ADVANCED_DETAILS) currentProgressWeight += totalAdvancedSteps;
    if (currentStep > Step.REVIEW) currentProgressWeight += 1;

    const progress = Math.min((currentProgressWeight / totalStepsWeight) * 100, 100);

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
                toast.error('Something went wrong. Please check your connection and try again.');
                setSubmitting(false);
            }
        } catch (err) {
            console.error('Failed to submit form:', err);
            toast.error('Could not submit. Please check your connection and try again.');
            setSubmitting(false);
        }
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
                        return cat ? `${cat.charAt(0).toUpperCase() + cat.slice(1)} Provider` : 'Utilities';
                    }
                    case Step.ADVANCED_DETAILS: {
                        if (!currentAdvancedModule) return 'Transition Details';
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
        >
            <AnimatePresence mode={shouldReduceMotion ? 'sync' : 'wait'} initial={!shouldReduceMotion}>
                {currentStep === Step.WELCOME && (
                    <WelcomeStep
                        key="welcome"
                        address={initialRequestData.property_address}
                        onNext={handleNext}
                    />
                )}

                {currentStep === Step.HOME_BASICS && (
                    <HomeBasicsStep
                        key="basics"
                        state={state}
                        updateState={(updates) => setState((prev) => ({ ...prev, ...updates }))}
                        requestedUtilityCategories={initialRequestData.utility_categories}
                        onNext={handleNext}
                    />
                )}

                {currentStep === Step.UTILITIES && visibleUtilities[utilityIndex] && (
                    <UtilityStep
                        key={`util-${visibleUtilities[utilityIndex]}`}
                        category={visibleUtilities[utilityIndex]}
                        categoryLabel={visibleUtilities[utilityIndex].charAt(0).toUpperCase() + visibleUtilities[utilityIndex].slice(1)}
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
                        advanced={state.advanced}
                        updateAdvanced={updateAdvanced}
                        onBack={handleBack}
                        onNext={handleNext}
                    />
                )}

                {currentStep === Step.REVIEW && (
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
                    />
                )}

                {currentStep === Step.SUCCESS && (
                    <SuccessStep
                        key="success"
                        isDemo={isDemo}
                        demoData={isDemo ? {
                            address: initialRequestData.property_address,
                            state,
                        } : undefined}
                    />
                )}
            </AnimatePresence>
        </SellerLayout>
    );
}
