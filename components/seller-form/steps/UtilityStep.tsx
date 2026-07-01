'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Check,
    Search,
    X,
    Loader2,
    Zap,
    Droplets,
    Flame,
    Fuel,
    FlameKindling,
    Trash2,
    Wifi,
    Tv,
    Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import { UtilityCategory, ProviderSuggestion, TrashPickupDay, TrashUtilityExtra } from '@/types';
import { trackEvent } from '@/lib/analytics/events';

// Category-specific icons
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

const TRASH_PICKUP_DAY_OPTIONS: Array<{ value: TrashPickupDay; label: string }> = [
    { value: 'not_sure', label: 'Not sure' },
    { value: 'varies', label: 'Varies' },
    { value: 'mon', label: 'Monday' },
    { value: 'tue', label: 'Tuesday' },
    { value: 'wed', label: 'Wednesday' },
    { value: 'thu', label: 'Thursday' },
    { value: 'fri', label: 'Friday' },
    { value: 'sat', label: 'Saturday' },
    { value: 'sun', label: 'Sunday' },
];
const TRASH_WEEKDAY_OPTIONS = TRASH_PICKUP_DAY_OPTIONS.filter((option) => option.value !== 'not_sure' && option.value !== 'varies');

interface UtilityStepProps {
    category: UtilityCategory;
    categoryLabel: string;
    state: WizardState;
    updateState: (
        category: UtilityCategory,
        updates: Partial<WizardState['utilities'][UtilityCategory]>
    ) => void;
    suggestions: ProviderSuggestion[];
    loadingSuggestions?: boolean;
    token: string;
    collectElectricMeterNumber?: boolean;
    onNext: () => void;
    onBack: () => void;
}

export function UtilityStep({
    category,
    categoryLabel,
    state,
    updateState,
    suggestions,
    loadingSuggestions = false,
    token,
    collectElectricMeterNumber = false,
    onNext,
    onBack,
}: UtilityStepProps) {
    const [mode, setMode] = useState<'view' | 'search' | 'meter' | 'trash_details'>('view');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProviderSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const alternativeSuggestions = suggestions || [];

    useEffect(() => {
        setMode('view');
        setSearchQuery('');
        setSearchResults([]);
    }, [category]);

    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/seller/${encodeURIComponent(token)}/suggestions/search?query=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(category)}`, {
                    signal: controller.signal,
                });
                if (res.ok) {
                    setSearchResults(await res.json());
                } else {
                    setSearchResults([]);
                }
            } catch (e) {
                if (!(e instanceof DOMException && e.name === 'AbortError')) {
                    console.error(e);
                }
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [searchQuery, category, token]);

    const currentUtilityState = state.utilities[category];
    const shouldGateElectricMeter = collectElectricMeterNumber && category === 'electric';
    const shouldGateTrashDetails = category === 'trash';

    const currentTrashExtra: TrashUtilityExtra =
        currentUtilityState?.extra && typeof currentUtilityState.extra === 'object' && !Array.isArray(currentUtilityState.extra)
            ? (currentUtilityState.extra as TrashUtilityExtra)
            : {};

    const updateTrashExtra = (updates: Partial<TrashUtilityExtra>) => {
        const nextExtra: TrashUtilityExtra = {
            ...currentTrashExtra,
            ...updates,
        };
        if (nextExtra.has_recycling === 'no') {
            nextExtra.recycling_pickup_day = null;
        }

        updateState(category, {
            extra: nextExtra,
        });
    };

    const currentTrashPickupDays = Array.isArray(currentTrashExtra.trash_pickup_days)
        ? currentTrashExtra.trash_pickup_days
        : currentTrashExtra.trash_pickup_day && currentTrashExtra.trash_pickup_day !== 'not_sure' && currentTrashExtra.trash_pickup_day !== 'varies'
            ? [currentTrashExtra.trash_pickup_day]
            : [];

    const toggleTrashPickupDay = (day: TrashPickupDay, checked: boolean) => {
        const nextDays = checked
            ? Array.from(new Set([...currentTrashPickupDays, day]))
            : currentTrashPickupDays.filter((selectedDay) => selectedDay !== day);

        updateTrashExtra({
            trash_pickup_days: nextDays,
            trash_pickup_day: nextDays[0] ?? null,
        });
    };

    const setTrashPickupSingleValue = (day: TrashPickupDay) => {
        updateTrashExtra({
            trash_pickup_days: [],
            trash_pickup_day: day,
        });
    };

    const advanceOrShowDetails = () => {
        if (shouldGateElectricMeter) {
            setMode('meter');
            return;
        }
        if (shouldGateTrashDetails) {
            setMode('trash_details');
            return;
        }
        onNext();
    };

    const handleConfirmSuggestion = (suggestion: ProviderSuggestion) => {
        updateState(category, {
            entry_mode: 'suggested_confirmed',
            display_name: suggestion.display_name,
            raw_text: null,
            canonical_id: suggestion.canonical_id || null,
            confidence_score: suggestion.confidence,
            contact_phone: suggestion.contact_phone || null,
            contact_url: suggestion.contact_website || null,
        });
        advanceOrShowDetails();
    };

    const handleSelectResult = (result: ProviderSuggestion) => {
        updateState(category, {
            entry_mode: 'search_selected',
            display_name: result.display_name,
            raw_text: result.display_name,
            canonical_id: result.canonical_id || null,
            confidence_score: result.confidence,
            contact_phone: result.contact_phone || null,
            contact_url: result.contact_website || null,
        });
        advanceOrShowDetails();
    };

    const handleManualEntry = () => {
        updateState(category, {
            entry_mode: 'free_text',
            display_name: searchQuery,
            raw_text: searchQuery,
            canonical_id: null,
            confidence_score: null,
        });
        advanceOrShowDetails();
    };

    const handleSkip = () => {
        trackSkip('i_dont_know');
        updateState(category, {
            entry_mode: 'unknown',
            display_name: null,
            raw_text: null,
            canonical_id: null,
            confidence_score: null,
        });
        if (shouldGateTrashDetails) {
            setMode('trash_details');
            return;
        }
        onNext();
    };

    const handleManualEntryFromSearch = () => {
        trackEvent('seller_provider_search_no_results_committed', {
            category,
            query_length: searchQuery.length,
            location: 'seller_flow',
        });
        handleManualEntry();
    };

    const handleBackPress = () => {
        if (mode === 'meter' || mode === 'search' || mode === 'trash_details') {
            setMode('view');
            return;
        }
        onBack();
    };

    const handleContinueWithMeter = () => {
        onNext();
    };

    const handleContinueWithoutMeter = () => {
        updateState(category, { meter_number: null });
        onNext();
    };

    const iconConfig = categoryIcons[category];
    const CategoryIcon = iconConfig?.icon || Zap;
    const iconColorClass = iconConfig?.color || 'text-slate-500';

    const PROVIDER_PROMPTS: Partial<Record<UtilityCategory, string>> = {
        electric: 'Who provides electricity for this home?',
        water: 'Who provides water service to this home?',
        sewer: 'Which authority handles wastewater service for this home?',
        gas: 'Who supplies natural gas to this home?',
        propane: 'Who delivers propane to this home?',
        oil: 'Who delivers heating oil to this home?',
        trash: 'Who handles trash and recycling pickup?',
        internet: 'Who provides internet service to this home?',
        cable: 'Who provides cable or TV service to this home?',
    };
    const PROVIDER_HELPERS: Partial<Record<UtilityCategory, string>> = {
        water: "Usually a city utility or water district. Check a recent water bill if you're not sure.",
        sewer: "Often the city, county, or a separate sewer authority. Check a recent bill or your county's website.",
        electric: "Listed on your monthly electric bill.",
        gas: "Listed on your monthly gas bill.",
        propane: "The company that fills your propane tank.",
        oil: "The company that delivers heating oil.",
        trash: "Could be the city, the county, or a private hauler.",
        internet: "Like Xfinity, Spectrum, AT&T Fiber, etc.",
        cable: "Like Xfinity, Spectrum, DirecTV, etc.",
    };
    const providerPrompt = PROVIDER_PROMPTS[category] || `Who provides your ${categoryLabel.toLowerCase()}?`;
    const providerHelper = PROVIDER_HELPERS[category];

    const trackSkip = (reason: 'i_dont_know' | 'skipped_section' = 'i_dont_know') => {
        trackEvent('seller_utility_skipped', {
            category,
            reason,
            location: 'seller_flow',
        });
    };

    return (
        <motion.div
            key={category}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 sm:space-y-6"
        >
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
                <button
                    type="button"
                    onClick={handleBackPress}
                    aria-label={mode === 'meter' || mode === 'search' || mode === 'trash_details' ? 'Back to providers' : 'Back'}
                    className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <CategoryIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColorClass}`} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground">{categoryLabel} Provider</h3>
                        <p className="text-muted-foreground text-xs sm:text-sm">{providerPrompt}</p>
                    </div>
                </div>
            </div>

            {providerHelper && mode === 'view' && (
                <p className="text-xs text-muted-foreground -mt-2 sm:-mt-4">{providerHelper}</p>
            )}

            {mode === 'view' && (
                <div className="space-y-4 sm:space-y-6">
                    {loadingSuggestions ? (
                        <div className="bg-muted/50 border border-border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
                            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center">
                                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground animate-spin" />
                            </div>
                            <div>
                                <h4 className="text-base sm:text-lg font-medium text-foreground">Finding providers...</h4>
                                <p className="text-muted-foreground text-xs sm:text-sm mt-1">Loading suggestions for your area.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={() => setMode('search')}
                                    className="w-full py-3 bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    Search Providers
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="w-full py-3 bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    I&apos;m not sure
                                </button>
                            </div>
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Suggested for your area</p>

                            <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                {suggestions.slice(0, 3).map((suggestion) => (
                                    <button
                                        type="button"
                                        key={suggestion.display_name}
                                        onClick={() => handleConfirmSuggestion(suggestion)}
                                        className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/50 hover:bg-muted border border-border rounded-xl text-left transition-all group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                <CategoryIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColorClass}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-medium text-foreground block text-sm sm:text-base truncate">
                                                    {suggestion.display_name}
                                                </span>
                                                {suggestion.rationale_short && (
                                                    <span className="text-xs text-muted-foreground mt-0.5 block line-clamp-2">
                                                        {suggestion.rationale_short}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-[color:var(--brand-accent)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('search')}
                                    className="py-3 sm:py-3.5 bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-sm active:scale-[0.98]"
                                >
                                    Search for another
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    data-testid={`seller-utility-skip-${category}`}
                                    className="py-3 sm:py-3.5 bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-sm active:scale-[0.98]"
                                >
                                    I&apos;m not sure
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Picking &quot;I&apos;m not sure&quot; is fine. We&apos;ll flag it for your agent to fill in.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-muted/50 border border-border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
                            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[var(--brand-accent-soft)] flex items-center justify-center">
                                <Search className="h-6 w-6 sm:h-8 sm:w-8 text-[color:var(--brand-accent)]" />
                            </div>
                            <div>
                                <h4 className="text-base sm:text-lg font-medium text-foreground">Help us find your provider</h4>
                                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                                    {providerHelper || "We don't have a suggestion for this one. You can search by name, or skip if you're not sure."}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={() => setMode('search')}
                                    className="w-full py-3 bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    Search Providers
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    data-testid={`seller-utility-skip-${category}`}
                                    className="w-full py-3 bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    I&apos;m not sure, my agent can fill this in
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mode === 'search' && (
                <div className="space-y-3 sm:space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        <input
                            autoFocus
                            type="text"
                            inputMode="search"
                            placeholder={`Search ${categoryLabel} providers...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-xl py-3 sm:py-4 pl-10 sm:pl-12 pr-10 sm:pr-12 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
                            data-testid="seller-provider-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full text-muted-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <div className="space-y-2 max-h-[280px] sm:max-h-[350px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                        {isSearching && (
                            <div className="p-4 text-center text-muted-foreground text-xs sm:text-sm">Searching...</div>
                        )}

                        {!isSearching && searchQuery.length >= 2 && searchResults.map((result) => (
                            <button
                                type="button"
                                key={result.display_name}
                                onClick={() => handleSelectResult(result)}
                                className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl text-left transition-all group active:scale-[0.98]"
                            >
                                <span className="font-medium text-foreground transition-colors text-sm sm:text-base truncate">{result.display_name}</span>
                                <Check className="h-4 w-4 text-[color:var(--brand-accent)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                            </button>
                        ))}

                        {!isSearching && (!searchQuery || searchQuery.length < 2) && alternativeSuggestions.length > 0 && (
                            <>
                                <div className="px-1 pt-2 pb-1">
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Suggested for your area</p>
                                </div>
                                {alternativeSuggestions.map((suggestion) => (
                                    <button
                                        type="button"
                                        key={suggestion.display_name}
                                        onClick={() => handleConfirmSuggestion(suggestion)}
                                        className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl text-left transition-all group active:scale-[0.98]"
                                    >
                                        <div className="min-w-0">
                                            <span className="font-medium text-foreground transition-colors block text-sm sm:text-base truncate">
                                                {suggestion.display_name}
                                            </span>
                                            {suggestion.rationale_short && (
                                                <span className="text-xs text-muted-foreground mt-0.5 block truncate">
                                                    {suggestion.rationale_short}
                                                </span>
                                            )}
                                        </div>
                                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[color:var(--brand-accent)]" />
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}

                        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                            <div className="pt-3 pb-2 space-y-3">
                                <p className="text-muted-foreground text-xs sm:text-sm text-center">
                                    No matches in our directory. That&apos;s ok, you can still use this name.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleManualEntryFromSearch}
                                    className="w-full py-3 bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white rounded-xl font-semibold transition-colors active:scale-[0.98] text-sm sm:text-base"
                                    data-testid="seller-provider-use-typed"
                                >
                                    {`Use "${searchQuery}"`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="w-full py-2.5 bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-sm active:scale-[0.98]"
                                >
                                    Search again
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setMode('view')}
                        className="w-full py-2.5 sm:py-3 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm active:scale-[0.98]"
                    >
                        Cancel Search
                    </button>
                </div>
            )}

            {mode === 'meter' && (
                <div className="space-y-4 sm:space-y-5">
                    <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                        <p className="text-[11px] sm:text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                            Selected Provider
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-foreground truncate">
                            {currentUtilityState?.display_name || 'Electric provider selected'}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                        <label htmlFor="electric-meter-number" className="block text-xs sm:text-sm font-medium text-foreground mb-1.5">
                            Meter Number (optional)
                        </label>
                        <input
                            id="electric-meter-number"
                            type="text"
                            value={currentUtilityState?.meter_number || ''}
                            onChange={(e) => updateState(category, { meter_number: e.target.value })}
                            placeholder="Enter the electric meter number"
                            maxLength={64}
                            className="w-full bg-background/70 border border-border rounded-lg py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
                            data-testid="seller-electric-meter-number"
                        />
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1.5">
                            If available, this will be added to the final PDF.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={handleContinueWithMeter}
                            className="w-full py-3 bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                        >
                            Continue
                        </button>
                        <button
                            type="button"
                            onClick={handleContinueWithoutMeter}
                            className="w-full py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                        >
                            Continue without meter number
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMode('view')}
                        className="w-full py-2.5 sm:py-3 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm active:scale-[0.98]"
                    >
                        Change provider
                    </button>
                </div>
            )}

            {mode === 'trash_details' && (
                <div className="space-y-4 sm:space-y-5" data-testid="seller-trash-details-step">
                    <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                        <p className="text-[11px] sm:text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                            Selected Provider
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-foreground truncate">
                            {currentUtilityState?.display_name || 'No provider selected'}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4 space-y-4">
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-foreground">Recycling at this home (optional)</p>
                            <p className="text-xs text-muted-foreground mt-1">Tell us if recycling pickup is available.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'yes' as const, label: 'Yes' },
                                { value: 'no' as const, label: 'No' },
                                { value: 'not_sure' as const, label: 'Not sure' },
                            ].map((option) => {
                                const isSelected = currentTrashExtra.has_recycling === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => updateTrashExtra({ has_recycling: option.value })}
                                        className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${isSelected
                                            ? 'bg-[color:var(--brand-accent)] text-white border-[color:var(--brand-accent)]'
                                            : 'bg-muted/50 border-border text-muted-foreground hover:border-ring'
                                            }`}
                                        data-testid={`seller-trash-recycling-${option.value}`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Trash pickup days</span>
                                <div className="grid grid-cols-2 gap-2" data-testid="seller-trash-pickup-days">
                                    {TRASH_WEEKDAY_OPTIONS.map((option) => {
                                        const inputId = `seller-trash-pickup-day-${option.value}`;
                                        const isChecked = currentTrashPickupDays.includes(option.value);
                                        return (
                                            <label
                                                key={option.value}
                                                htmlFor={inputId}
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm transition-all ${isChecked
                                                    ? 'bg-[color:var(--brand-accent)] text-white border-[color:var(--brand-accent)]'
                                                    : 'bg-muted/50 border-border text-muted-foreground hover:border-ring'
                                                    }`}
                                            >
                                                <input
                                                    id={inputId}
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => toggleTrashPickupDay(option.value, e.target.checked)}
                                                    className="h-4 w-4 rounded border-border accent-[var(--brand-accent)]"
                                                />
                                                {option.label}
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {TRASH_PICKUP_DAY_OPTIONS.slice(0, 2).map((option) => {
                                        const isSelected = currentTrashExtra.trash_pickup_day === option.value && currentTrashPickupDays.length === 0;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setTrashPickupSingleValue(option.value)}
                                                className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${isSelected
                                                    ? 'bg-[color:var(--brand-accent)] text-white border-[color:var(--brand-accent)]'
                                                    : 'bg-muted/50 border-border text-muted-foreground hover:border-ring'
                                                    }`}
                                                data-testid={`seller-trash-pickup-${option.value}`}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {(currentTrashExtra.has_recycling === 'yes' || currentTrashExtra.has_recycling === 'not_sure') && (
                                <label className="space-y-1" htmlFor="seller-recycling-pickup-day">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Recycling pickup day</span>
                                    <select
                                        id="seller-recycling-pickup-day"
                                        data-testid="seller-recycling-pickup-day"
                                        value={currentTrashExtra.recycling_pickup_day || 'not_sure'}
                                        onChange={(e) => updateTrashExtra({ recycling_pickup_day: e.target.value as TrashPickupDay })}
                                        className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground"
                                    >
                                        {TRASH_PICKUP_DAY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={onNext}
                            className="w-full py-3 bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                        >
                            Continue
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMode('view')}
                        className="w-full py-2.5 sm:py-3 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm active:scale-[0.98]"
                    >
                        Change provider
                    </button>
                </div>
            )}
        </motion.div>
    );
}
