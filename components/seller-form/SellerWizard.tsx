'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SellerLayout } from './SellerLayout';
import { UtilityCategory, ProviderSuggestion, WaterSource, SewerType, HeatingType } from '@/types';
import { WelcomeStep } from './steps/WelcomeStep';
import { HomeBasicsStep } from './steps/HomeBasicsStep';
import { UtilityStep } from './steps/UtilityStep';

import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';

// Define the full form state structure locally for the wizard
export interface WizardState {
    water_source: WaterSource;
    sewer_type: SewerType;
    heating_type: HeatingType; // Kept for backward compat, but we'll focus on primary_heating_type
    fuels_present: string[];
    primary_heating_type: string | null;
    trash_handled_by: 'municipal' | 'private' | 'not_sure';
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

    // Initialize state
    const [state, setState] = useState<WizardState>({
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        trash_handled_by: 'not_sure',
        utilities: {} as Record<UtilityCategory, UtilityWizardState>
    });

    const [visibleUtilities, setVisibleUtilities] = useState<UtilityCategory[]>([]);

    // Calculate visible utilities based on state
    useEffect(() => {
        const nextUtilities: UtilityCategory[] = ['electric']; // Always include electric

        // Water - if public (city)
        if (state.water_source === 'city') {
            nextUtilities.push('water');
        }

        // Sewer - if public
        if (state.sewer_type === 'public') {
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
            if (mapped) {
                nextUtilities.push(mapped);
            }
        });

        // Preserve utilities from initial request that aren't dynamically determined
        // This includes: trash, internet, cable, and any other non-conditional utilities
        const preservedCategories: UtilityCategory[] = ['trash', 'internet', 'cable'];
        preservedCategories.forEach(cat => {
            if (initialRequestData.utility_categories.includes(cat)) {
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
                }
            });

            return hasChanges ? { ...prev, utilities: nextUtilitiesState } : prev;
        });

    }, [state.water_source, state.sewer_type, state.fuels_present, initialRequestData.utility_categories]);

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
                setCurrentStep(Step.SUCCESS);
            } else {
                console.error('Submission failed');
                setSubmitting(false);
            }
        } catch (err) {
            console.error('Failed to submit form:', err);
            setSubmitting(false);
        }
    };

    return (
        <SellerLayout
            progress={progress}
            address={initialRequestData.property_address}
            completedCount={Object.values(state.utilities).filter(u => u?.entry_mode !== null).length}
            totalCount={visibleUtilities.length}
            brandProfile={brandProfile}
        >
            <AnimatePresence mode="wait">
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
                        suggestions={initialSuggestions[visibleUtilities[utilityIndex]] || []}
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
