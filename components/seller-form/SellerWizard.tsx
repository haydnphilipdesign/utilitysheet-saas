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
    HoaAnswers,
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
import { SellerStatusNotice } from './steps/SellerStatusNotice';
import { sellerPrefillToWizardState, type SellerPrefill } from '@/lib/seller-form/prefill';
import { trackEvent } from '@/lib/analytics/events';
import {
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_LABELS,
    getEffectiveAdvancedModules,
    normalizeAdvancedModuleExclusions,
} from '@/lib/packet/modules';
import { UTILITY_CATEGORIES } from '@/lib/constants';
import { createEmptyHoaAnswers } from '@/lib/packet/hoa';

export interface WizardState extends HoaAnswers {
    /** Draft-only: choices cleared after an explicit No need seller confirmation. */
    hoaUtilityReselection?: ('water_source' | 'sewer_type')[];
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

function createSubmissionKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`;
}

/** Cheap fingerprint so a retry reuses its key only while the answers are unchanged. */
function digestOf(value: string): string {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
    }
    return `${value.length}:${hash}`;
}

function reconcileHoaUtilityChoices(state: WizardState, enabled: boolean): WizardState {
    if (!enabled || state.has_hoa !== 'no') {
        return { ...state, hoaUtilityReselection: [] };
    }
    const pending = new Set(state.hoaUtilityReselection || []);
    const next = { ...state };
    for (const field of ['water_source', 'sewer_type'] as const) {
        if (next[field] === 'hoa') {
            next[field] = 'not_sure';
            pending.add(field);
        }
    }
    return { ...next, hoaUtilityReselection: [...pending] };
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
        seller_intro?: string | null;
        property_address: string;
        utility_categories: UtilityCategory[];
        collect_electric_meter_number?: boolean;
        collect_hoa_questions?: boolean;
        packet_mode?: PacketMode;
        advanced_modules?: AdvancedModuleKey[];
        advanced_module_exclusions?: AdvancedModuleExclusions;
        advanced_packet_data?: AdvancedPacketData;
        hoa?: HoaAnswers;
        /** Seller editing session from the server; above 0 after a coordinator reopen. */
        edit_version?: number;
        /** The stored sheet, sent when the request was reopened. */
        prefill?: SellerPrefill;
    };
    initialSuggestions: Record<UtilityCategory, ProviderSuggestion[]>;
    token: string;
    brandProfile?: BrandProfile | null;
    isDemo?: boolean;
    isTestDrive?: boolean;
}

/*
 * linear: the first pass, in order.
 * review_edit: one provider or handoff section opened from Review; returns there.
 * catch_up: Home Basics was edited from Review; only the provider steps and
 *   handoff sections that edit newly added are visited before returning.
 */
type NavigationMode = 'linear' | 'review_edit' | 'catch_up';
const NAVIGATION_MODES: NavigationMode[] = ['linear', 'review_edit', 'catch_up'];

export function SellerWizard({ initialRequestData, initialSuggestions, token, brandProfile, isDemo = false, isTestDrive = false }: SellerWizardProps) {
    enum Step {
        WELCOME = 0,
        HOME_BASICS = 1,
        UTILITIES = 2,
        ADVANCED_DETAILS = 3,
        REVIEW = 4,
        SUCCESS = 5,
    }

    const editVersion = initialRequestData.edit_version ?? 0;
    const collectHoaQuestionsInitially = initialRequestData.collect_hoa_questions !== false;
    // A reopened request starts from the stored sheet. If that sheet holds HOA
    // billing choices that conflict with a No, Home Basics asks again first.
    const [initialWizardState] = useState<WizardState | null>(() => {
        if (!initialRequestData.prefill) return null;
        const packetMode: PacketMode = initialRequestData.packet_mode || 'simple';
        const modules = initialRequestData.advanced_modules || [];
        const exclusions = normalizeAdvancedModuleExclusions(initialRequestData.advanced_module_exclusions || {}, modules);
        return reconcileHoaUtilityChoices({
            heating_type: 'not_sure',
            ...createEmptyHoaAnswers(),
            ...initialRequestData.hoa,
            trash_handled_by: 'not_sure',
            packet_mode: packetMode,
            advanced_modules: packetMode === 'advanced'
                ? getEffectiveAdvancedModules(ADVANCED_MODULE_KEYS.filter((moduleKey) => modules.includes(moduleKey)), exclusions)
                : [],
            advanced_module_exclusions: exclusions,
            advanced: initialRequestData.advanced_packet_data || {},
            ...sellerPrefillToWizardState(initialRequestData.prefill),
        } as WizardState, collectHoaQuestionsInitially);
    });
    const startsFromStoredSheet = initialWizardState !== null;
    const [currentStep, setCurrentStep] = useState<Step>(() => {
        if (!initialWizardState) return Step.WELCOME;
        return initialWizardState.hoaUtilityReselection?.length ? Step.HOME_BASICS : Step.REVIEW;
    });
    // Set when the server refuses this page's answers for good.
    const [terminalNotice, setTerminalNotice] = useState<'submitted' | 'stale' | null>(null);
    const [submissionAttempt, setSubmissionAttempt] = useState<{ key: string; digest: string } | null>(null);
    const [utilityIndex, setUtilityIndex] = useState(0);
    const [advancedModuleIndex, setAdvancedModuleIndex] = useState(0);
    const [navigationMode, setNavigationMode] = useState<NavigationMode>('linear');
    // Handoff sections that were enabled when Home Basics was reopened from Review.
    const [reviewedAdvancedModules, setReviewedAdvancedModules] = useState<AdvancedModuleKey[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<{ kind: 'network' | 'server' | 'rate_limit' | 'unknown'; message: string } | null>(null);
    const [autosaveFlash, setAutosaveFlash] = useState(false);
    const autosaveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [suggestionsByCategory, setSuggestionsByCategory] = useState<Record<UtilityCategory, ProviderSuggestion[]>>(initialSuggestions);
    const [loadingSuggestions, setLoadingSuggestions] = useState<Partial<Record<UtilityCategory, boolean>>>({});
    const shouldReduceMotion = useReducedMotion();
    const collectElectricMeterNumber = initialRequestData.collect_electric_meter_number !== false;
    const collectHoaQuestions = initialRequestData.collect_hoa_questions !== false;
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

    const [state, setState] = useState<WizardState>(() => initialWizardState ?? ({
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        ...createEmptyHoaAnswers(),
        ...initialRequestData.hoa,
        trash_handled_by: 'not_sure',
        optional_utilities: [],
        packet_mode: requestPacketMode,
        advanced_modules: configuredAdvancedModules,
        advanced_module_exclusions: requestAdvancedModuleExclusions,
        advanced: initialRequestData.advanced_packet_data || {},
        utilities: {} as Record<UtilityCategory, UtilityWizardState>,
    }));

    // Derived during render, not in an effect, so a restored draft's provider-step
    // index is checked against the restored answers instead of the defaults.
    const visibleUtilities = useMemo(() => {
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

        return Array.from(new Set(nextUtilities));
    }, [state.water_source, state.sewer_type, state.fuels_present, state.optional_utilities, initialRequestData.utility_categories]);
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
                /** Written before navigationMode existed. */
                advancedNavigationMode?: NavigationMode;
                navigationMode?: NavigationMode;
                reviewedAdvancedModules?: AdvancedModuleKey[];
                editVersion?: number;
                submissionAttempt?: { key?: unknown; digest?: unknown } | null;
            };
            if ((parsed?.v !== 1 && parsed?.v !== 2) || !parsed.state) return;

            // A draft from an earlier editing session, or one left behind after
            // a submission, must not replace the answers the server holds now.
            if ((parsed.editVersion ?? 0) !== editVersion || parsed.currentStep === Step.SUCCESS) {
                localStorage.removeItem(draftStorageKey);
                return;
            }
            if (typeof parsed.submissionAttempt?.key === 'string' && typeof parsed.submissionAttempt?.digest === 'string') {
                setSubmissionAttempt({ key: parsed.submissionAttempt.key, digest: parsed.submissionAttempt.digest });
            }

            // Merge over the initial state so a draft saved before a question
            // existed keeps that question's default instead of dropping the key.
            const draftState = reconcileHoaUtilityChoices({
                ...parsed.state,
                has_hoa: parsed.state.has_hoa === undefined
                    ? initialRequestData.hoa?.has_hoa ?? null
                    : parsed.state.has_hoa,
            }, collectHoaQuestions);
            setState((prev) => ({ ...prev, ...draftState }));
            if (typeof parsed.currentStep === 'number') {
                setCurrentStep(draftState.hoaUtilityReselection?.length
                    ? Step.HOME_BASICS
                    : Math.max(0, Math.min(Step.SUCCESS, parsed.currentStep)) as Step);
            }
            if (typeof parsed.utilityIndex === 'number') {
                setUtilityIndex(Math.max(0, parsed.utilityIndex));
            }
            if (parsed.v === 2 && typeof parsed.advancedModuleIndex === 'number') {
                setAdvancedModuleIndex(Math.max(0, parsed.advancedModuleIndex));
            }
            const draftNavigationMode = parsed.navigationMode ?? parsed.advancedNavigationMode;
            if (parsed.v === 2 && draftNavigationMode && NAVIGATION_MODES.includes(draftNavigationMode)) {
                setNavigationMode(draftNavigationMode);
            }
            if (parsed.v === 2 && Array.isArray(parsed.reviewedAdvancedModules)) {
                setReviewedAdvancedModules(
                    ADVANCED_MODULE_KEYS.filter((moduleKey) => parsed.reviewedAdvancedModules?.includes(moduleKey))
                );
            }
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isDemo]);

    useEffect(() => {
        if (isDemo) return;
        // Nothing is kept once the answers are sent or can no longer be sent.
        if (currentStep === Step.SUCCESS || terminalNotice) return;
        const timeout = setTimeout(() => {
            try {
                localStorage.setItem(
                    draftStorageKey,
                    JSON.stringify({
                        v: 2,
                        editVersion,
                        submissionAttempt,
                        state,
                        currentStep,
                        utilityIndex,
                        advancedModuleIndex,
                        navigationMode,
                        reviewedAdvancedModules,
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
    }, [draftStorageKey, state, currentStep, utilityIndex, advancedModuleIndex, navigationMode, reviewedAdvancedModules, isDemo, editVersion, submissionAttempt, terminalNotice]);

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
        const uniqueUtils = visibleUtilities;

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
    }, [visibleUtilities]);

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
                setNavigationMode('linear');
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
            location: isDemo
                ? 'demo_seller_flow'
                : isTestDrive
                  ? 'test_drive_seller_flow'
                  : 'seller_flow',
            packet_mode: state.packet_mode,
        });
    }, [currentStep, isDemo, isTestDrive, utilityIndex, visibleUtilities, state.packet_mode, currentAdvancedModule]);

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

    const returnToReview = () => {
        setNavigationMode('linear');
        setCurrentStep(Step.REVIEW);
    };

    // After Home Basics is edited from Review: visit provider steps that have no
    // answer yet, then handoff sections that edit enabled, then go back to Review.
    const continueCatchUp = (utilityFrom: number, advancedFrom: number) => {
        const nextUtility = visibleUtilities.findIndex(
            (category, index) => index >= utilityFrom && !state.utilities[category]?.entry_mode
        );
        if (nextUtility >= 0) {
            setUtilityIndex(nextUtility);
            setCurrentStep(Step.UTILITIES);
            return;
        }

        const nextModule = orderedAdvancedModules.findIndex(
            (moduleKey, index) => index >= advancedFrom && !reviewedAdvancedModules.includes(moduleKey)
        );
        if (nextModule >= 0) {
            setAdvancedModuleIndex(nextModule);
            setCurrentStep(Step.ADVANCED_DETAILS);
            return;
        }

        returnToReview();
    };

    const handleNext = () => {
        if (currentStep === Step.WELCOME) {
            setCurrentStep(Step.HOME_BASICS);
        } else if (currentStep === Step.HOME_BASICS) {
            if (navigationMode === 'catch_up') {
                continueCatchUp(0, 0);
                return;
            }
            setCurrentStep(Step.UTILITIES);
            setUtilityIndex(0);
        } else if (currentStep === Step.UTILITIES) {
            if (navigationMode === 'review_edit') {
                returnToReview();
                return;
            }
            if (navigationMode === 'catch_up') {
                // The step just answered still reads as unanswered in this render.
                continueCatchUp(utilityIndex + 1, 0);
                return;
            }

            if (utilityIndex < visibleUtilities.length - 1) {
                setUtilityIndex((prev) => prev + 1);
            } else if (hasAdvancedStep) {
                setAdvancedModuleIndex(0);
                setNavigationMode('linear');
                setCurrentStep(Step.ADVANCED_DETAILS);
            } else {
                setCurrentStep(Step.REVIEW);
            }
        } else if (currentStep === Step.ADVANCED_DETAILS) {
            if (navigationMode === 'review_edit') {
                returnToReview();
                return;
            }
            if (navigationMode === 'catch_up') {
                continueCatchUp(visibleUtilities.length, advancedModuleIndex + 1);
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
            if (navigationMode === 'review_edit') {
                returnToReview();
                return;
            }
            if (navigationMode === 'catch_up') {
                setCurrentStep(Step.HOME_BASICS);
                return;
            }

            if (utilityIndex > 0) {
                setUtilityIndex((prev) => prev - 1);
            } else {
                setCurrentStep(Step.HOME_BASICS);
            }
        } else if (currentStep === Step.ADVANCED_DETAILS) {
            if (navigationMode === 'review_edit') {
                returnToReview();
                return;
            }
            if (navigationMode === 'catch_up') {
                setCurrentStep(Step.HOME_BASICS);
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
                setNavigationMode('linear');
                setAdvancedModuleIndex(Math.max(0, orderedAdvancedModules.length - 1));
                setCurrentStep(Step.ADVANCED_DETAILS);
            } else {
                setCurrentStep(Step.UTILITIES);
                setUtilityIndex(Math.max(0, visibleUtilities.length - 1));
            }
        }
    };

    const handleEditBasics = () => {
        setReviewedAdvancedModules(orderedAdvancedModules);
        setNavigationMode('catch_up');
        setCurrentStep(Step.HOME_BASICS);
    };

    const handleEditAdvancedModule = (moduleKey: AdvancedModuleKey) => {
        const targetIndex = orderedAdvancedModules.findIndex((m) => m === moduleKey);
        if (targetIndex < 0) return;

        setAdvancedModuleIndex(targetIndex);
        setNavigationMode('review_edit');
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

        const clearDraft = () => {
            try {
                localStorage.removeItem(draftStorageKey);
            } catch {
                // ignore
            }
        };

        // One key per set of answers: a retry after a lost response is
        // recognized by the server, while changed answers count as new.
        const answers = JSON.stringify({ ...state, hoaUtilityReselection: undefined });
        const digest = digestOf(answers);
        const attempt = submissionAttempt?.digest === digest
            ? submissionAttempt
            : { key: createSubmissionKey(), digest };
        if (attempt !== submissionAttempt) setSubmissionAttempt(attempt);

        try {
            const response = await fetch(`/api/seller/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...JSON.parse(answers),
                    edit_version: editVersion,
                    submission_key: attempt.key,
                }),
            });

            const refusal = response.status === 409
                ? ((await response.clone().json().catch(() => null)) as { code?: string } | null)?.code
                : null;
            if (refusal === 'ALREADY_SUBMITTED' || refusal === 'STALE_SESSION') {
                // These answers can never be accepted, so they are not kept.
                clearDraft();
                setTerminalNotice(refusal === 'ALREADY_SUBMITTED' ? 'submitted' : 'stale');
                setSubmitting(false);
                return;
            }

            if (response.ok) {
                try {
                    localStorage.removeItem(draftStorageKey);
                } catch {
                    // ignore
                }
                if (isTestDrive) {
                    trackEvent('test_drive_completed', {
                        source: 'seller_flow',
                    });
                } else {
                    trackEvent('seller_submitted', {
                        source: 'seller_flow',
                        utility_count: visibleUtilities.length,
                        location: 'seller_flow',
                        packet_mode: state.packet_mode,
                    });
                }
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
            location: isTestDrive ? 'test_drive_seller_flow' : 'seller_flow',
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
            stepNumber={currentStep === Step.HOME_BASICS ? undefined : currentStepNumber}
            stepTotal={totalSteps}
            autosaveFlash={autosaveFlash}
            sellerToken={isDemo ? undefined : token}
            showSaveLink={!isDemo && !isTestDrive && !terminalNotice && currentStep > Step.WELCOME && currentStep < Step.SUCCESS}
            isTestDrive={isTestDrive}
        >
            {terminalNotice && (
                <SellerStatusNotice
                    kind={terminalNotice}
                    address={initialRequestData.property_address}
                    brandProfile={brandProfile}
                />
            )}
            {!terminalNotice && (
            <AnimatePresence mode={shouldReduceMotion ? 'sync' : 'wait'} initial={!shouldReduceMotion}>
                {currentStep === Step.WELCOME && (
                    <WelcomeStep
                        key="welcome"
                        sellerIntro={initialRequestData.seller_intro}
                        address={initialRequestData.property_address}
                        onNext={handleNext}
                        isTestDrive={isTestDrive}
                        savesProgress={!isDemo}
                    />
                )}

                {currentStep === Step.HOME_BASICS && (
                    <HomeBasicsStep
                        key="basics"
                        state={state}
                        updateState={(updates) => setState((prev) => reconcileHoaUtilityChoices({ ...prev, ...updates }, collectHoaQuestions))}
                        requestedUtilityCategories={initialRequestData.utility_categories}
                        configuredAdvancedModules={configuredAdvancedModules}
                        collectHoaQuestions={collectHoaQuestions}
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
                        isReviewEdit={navigationMode === 'review_edit'}
                        onNext={handleNext}
                        onBack={handleBack}
                    />
                )}

                {currentStep === Step.ADVANCED_DETAILS && currentAdvancedModule && (
                    <AdvancedDetailsStep
                        key={`advanced-details-${currentAdvancedModule}-${navigationMode}`}
                        moduleKey={currentAdvancedModule}
                        moduleIndex={advancedModuleIndex}
                        moduleCount={orderedAdvancedModules.length}
                        isReviewEdit={navigationMode === 'review_edit'}
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
                            setNavigationMode('review_edit');
                            setCurrentStep(Step.UTILITIES);
                            setUtilityIndex(index);
                        }}
                        onEditAdvancedModule={handleEditAdvancedModule}
                        updateUtility={updateUtilityState}
                        collectElectricMeterNumber={collectElectricMeterNumber}
                        collectHoaQuestions={collectHoaQuestions}
                        reopened={startsFromStoredSheet}
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
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                                {isTestDrive ? 'Creating your test sheet…' : 'Sending your info to your agent…'}
                            </h2>
                            <p className="text-sm text-muted-foreground">This usually takes a few seconds. Please don’t close the tab.</p>
                        </div>
                    </motion.div>
                )}

                {currentStep === Step.SUCCESS && (
                    <SuccessStep
                        key="success"
                        isDemo={isDemo}
                        isTestDrive={isTestDrive}
                        demoData={isDemo ? {
                            address: initialRequestData.property_address,
                            state,
                        } : undefined}
                        brandProfile={brandProfile || undefined}
                        propertyAddress={initialRequestData.property_address}
                    />
                )}
            </AnimatePresence>
            )}
        </SellerLayout>
    );
}
