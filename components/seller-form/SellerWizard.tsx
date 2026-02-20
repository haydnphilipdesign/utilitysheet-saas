'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { SellerLayout } from './SellerLayout';
import { UtilityCategory, ProviderSuggestion, WaterSource, SewerType, HeatingType } from '@/types';
import { WelcomeStep } from './steps/WelcomeStep';
import { HomeBasicsStep } from './steps/HomeBasicsStep';
import { UtilityStep } from './steps/UtilityStep';

import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';
import { trackEvent } from '@/lib/analytics/events';
import { toast } from 'sonner';

// Define the full form state structure locally for the wizard
export interface WizardState {
    water_source: WaterSource;
    sewer_type: SewerType;
    heating_type: HeatingType; // Kept for backward compat, but we'll focus on primary_heating_type
    fuels_present: string[];
    primary_heating_type: string | null;
    trash_handled_by: 'municipal' | 'private' | 'not_sure';
    optional_utilities: UtilityCategory[];
    utilities: Record<UtilityCategory, UtilityWizardState>;
}

export interface UtilityWizardState {
    entry_mode: 'suggested_confirmed' | 'search_selected' | 'free_text' | 'unknown' | null;
    display_name: string | null;
    raw_text: string | null;
    hidden: boolean;
    contact_phone?: string | null;
    contact_url?: string | null;
    extra?: Record<string, any>;
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
    };
    initialSuggestions: Record<UtilityCategory, ProviderSuggestion[]>;
    token: string;
    brandProfile?: BrandProfile | null;
    isDemo?: boolean;
}

export function SellerWizard({ initialRequestData, initialSuggestions, token, brandProfile, isDemo = false }: SellerWizardProps) {
    // Steps definition
    enum Step {
        WELCOME = 0,
        HOME_BASICS = 1,
        UTILITIES = 2,
        REVIEW = 3,
        SUCCESS = 4
    }

    const [currentStep, setCurrentStep] = useState<Step>(Step.WELCOME);
    const [utilityIndex, setUtilityIndex] = useState(0); // For iterating through utility providers
    const [submitting, setSubmitting] = useState(false);
    const [suggestionsByCategory, setSuggestionsByCategory] = useState<Record<UtilityCategory, ProviderSuggestion[]>>(initialSuggestions);
    const [loadingSuggestions, setLoadingSuggestions] = useState<Partial<Record<UtilityCategory, boolean>>>({});
    const shouldReduceMotion = useReducedMotion();

    // Initialize state
    const [state, setState] = useState<WizardState>(() => {
        return {
            water_source: 'not_sure',
            sewer_type: 'not_sure',
            heating_type: 'not_sure',
            fuels_present: [],
            primary_heating_type: null,
            trash_handled_by: 'not_sure',
            optional_utilities: [],
            utilities: {} as Record<UtilityCategory, UtilityWizardState>
        };
    });

    const [visibleUtilities, setVisibleUtilities] = useState<UtilityCategory[]>([]);

    // Persist draft progress locally so refresh/back doesn't lose work.
    // (This is client-side only; no PII is sent anywhere.)
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
            };
            if (parsed?.v !== 1 || !parsed.state) return;

            setState(parsed.state);
            if (typeof parsed.currentStep === 'number') {
                setCurrentStep(Math.max(0, Math.min(Step.SUCCESS, parsed.currentStep)) as Step);
            }
            if (typeof parsed.utilityIndex === 'number') {
                setUtilityIndex(Math.max(0, parsed.utilityIndex));
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
                        v: 1,
                        state,
                        currentStep,
                        utilityIndex,
                    })
                );
            } catch {
                // ignore
            }
        }, 250);

        return () => clearTimeout(timeout);
    }, [draftStorageKey, state, currentStep, utilityIndex, isDemo]);

    // Lazy-load suggestions as needed (prefetch current + next)
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

    // Calculate visible utilities based on state
    useEffect(() => {
        const requestedCategories = new Set<UtilityCategory>(initialRequestData.utility_categories);

        const nextUtilities: UtilityCategory[] = ['electric']; // Always include electric

        // Water - if public (city)
        if (requestedCategories.has('water') && state.water_source === 'city') {
            nextUtilities.push('water');
        }

        // Sewer - if public
        if (requestedCategories.has('sewer') && state.sewer_type === 'public') {
            nextUtilities.push('sewer');
        }

        // Fuels
        const fuelMap: Record<string, UtilityCategory> = {
            'natural_gas': 'gas',
            'propane': 'propane',
            'oil': 'oil'
        };

        state.fuels_present.forEach(fuel => {
            const mapped = fuelMap[fuel];
            if (mapped && requestedCategories.has(mapped)) {
                nextUtilities.push(mapped);
            }
        });

        // Preserve utilities from initial request that aren't dynamically determined
        // This includes: trash, internet, cable, and any other non-conditional utilities
        const preservedCategories: UtilityCategory[] = ['trash', 'internet', 'cable'];
        preservedCategories.forEach(cat => {
            if (requestedCategories.has(cat) && state.optional_utilities.includes(cat)) {
                nextUtilities.push(cat);
            }
        });

        // Remove duplicates and set
        const uniqueUtils = Array.from(new Set(nextUtilities));

        // Update visible utilities
        setVisibleUtilities(uniqueUtils);

        // Ensure state exists for all visible utilities
        setState(prev => {
            const nextUtilitiesState = { ...prev.utilities };
            const visibleSet = new Set(uniqueUtils);
            let hasChanges = false;

            uniqueUtils.forEach(cat => {
                if (!nextUtilitiesState[cat]) {
                    nextUtilitiesState[cat] = {
                        entry_mode: null,
                        display_name: null,
                        raw_text: null,
                        hidden: false
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
        let stepLabel = 'welcome';
        if (currentStep === Step.HOME_BASICS) {
            stepLabel = 'home_basics';
        } else if (currentStep === Step.UTILITIES) {
            const currentCategory = visibleUtilities[utilityIndex];
            stepLabel = currentCategory ? `utility_${currentCategory}` : 'utilities';
        } else if (currentStep === Step.REVIEW) {
            stepLabel = 'review';
        } else if (currentStep === Step.SUCCESS) {
            stepLabel = 'success';
        }

        trackEvent('seller_step_viewed', {
            step: stepLabel,
            location: isDemo ? 'demo_seller_flow' : 'seller_flow',
        });
    }, [currentStep, isDemo, utilityIndex, visibleUtilities]);

    const totalUtilities = visibleUtilities.length;
    // Simplify progress: Welcome(0.5) + Basics(1) + Each Util(1) + Review(1)
    const totalStepsWeight = 1.5 + totalUtilities + 1;
    let currentProgressWeight = 0;

    if (currentStep > Step.WELCOME) currentProgressWeight += 0.5;
    if (currentStep > Step.HOME_BASICS) currentProgressWeight += 1;
    if (currentStep === Step.UTILITIES) currentProgressWeight += utilityIndex;
    if (currentStep > Step.UTILITIES) currentProgressWeight += totalUtilities;
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
                setUtilityIndex(prev => prev + 1);
            } else {
                setCurrentStep(Step.REVIEW);
            }
        } else if (currentStep === Step.REVIEW) {
            // Wait for submit
        }
    };

    const handleBack = () => {
        if (currentStep === Step.HOME_BASICS) {
            setCurrentStep(Step.WELCOME);
        } else if (currentStep === Step.UTILITIES) {
            if (utilityIndex > 0) {
                setUtilityIndex(prev => prev - 1);
            } else {
                setCurrentStep(Step.HOME_BASICS);
            }
        } else if (currentStep === Step.REVIEW) {
            setCurrentStep(Step.UTILITIES);
            setUtilityIndex(visibleUtilities.length - 1);
        }
    };

    const handleEditBasics = () => {
        setCurrentStep(Step.HOME_BASICS);
    };

    const updateUtilityState = (cat: UtilityCategory, updates: any) => {
        setState(prev => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [cat]: { ...prev.utilities[cat], ...updates }
            }
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);

        // In demo mode, skip the API call and go straight to success
        if (isDemo) {
            // Small delay to simulate submission
            await new Promise(resolve => setTimeout(resolve, 500));
            trackEvent('seller_submitted', {
                source: 'seller_flow',
                utility_count: visibleUtilities.length,
                location: 'demo_seller_flow',
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
                    case Step.UTILITIES:
                        const cat = visibleUtilities[utilityIndex];
                        return cat ? `${cat.charAt(0).toUpperCase() + cat.slice(1)} Provider` : 'Utilities';
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
                        updateState={(updates) => setState(prev => ({ ...prev, ...updates }))}
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
                        onNext={handleNext}
                        onBack={handleBack}
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
                            setCurrentStep(Step.UTILITIES);
                            setUtilityIndex(index);
                        }}
                        onSubmit={handleSubmit}
                        submitting={submitting}
                    />
                )}

                {currentStep === Step.SUCCESS && (
                    <SuccessStep
                        key="success"
                        isDemo={isDemo}
                        demoData={isDemo ? {
                            address: initialRequestData.property_address,
                            state: state
                        } : undefined}
                    />
                )}

                {/* Fallback */}
                {currentStep > Step.SUCCESS && (
                    <div className="text-foreground text-center pt-20">
                        <p>Something went wrong.</p>
                        <button
                            onClick={() => setCurrentStep(Step.WELCOME)}
                            className="mt-4 px-4 py-2 bg-secondary rounded-lg text-sm"
                        >
                            Back to Start
                        </button>
                    </div>
                )}
            </AnimatePresence>
        </SellerLayout>
    );
}
