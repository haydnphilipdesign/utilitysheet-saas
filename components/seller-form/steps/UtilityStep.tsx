'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Search, X, Loader2, Zap, Droplets, Flame, Fuel, FlameKindling, Trash2, Wifi, Tv, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import { UtilityCategory, ProviderSuggestion } from '@/types';

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
    onBack
}: UtilityStepProps) {
    const [mode, setMode] = useState<'view' | 'search' | 'meter'>('view');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProviderSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // All suggestions available for search
    const alternativeSuggestions = suggestions || [];

    // Reset local state when category changes
    useEffect(() => {
        setMode('view');
        setSearchQuery('');
        setSearchResults([]);
    }, [category]);

    // Search effect
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

    const advanceOrShowMeterStep = () => {
        if (shouldGateElectricMeter) {
            setMode('meter');
            return;
        }
        onNext();
    };

    const handleConfirmSuggestion = (s: ProviderSuggestion) => {
        updateState(category, {
            entry_mode: 'suggested_confirmed',
            display_name: s.display_name,
            raw_text: null,
            contact_phone: s.contact_phone || null,
            contact_url: s.contact_website || null
        });
        advanceOrShowMeterStep();
    };

    const handleSelectResult = (result: ProviderSuggestion) => {
        updateState(category, {
            entry_mode: 'search_selected',
            display_name: result.display_name,
            raw_text: result.display_name,
            contact_phone: result.contact_phone || null,
            contact_url: result.contact_website || null
        });
        advanceOrShowMeterStep();
    };

    const handleManualEntry = () => {
        updateState(category, {
            entry_mode: 'free_text',
            display_name: searchQuery,
            raw_text: searchQuery
        });
        advanceOrShowMeterStep();
    };

    const handleSkip = () => {
        updateState(category, {
            entry_mode: 'unknown',
            display_name: null,
            raw_text: null
        });
        onNext();
    };

    const handleBackPress = () => {
        if (mode === 'meter' || mode === 'search') {
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

    // Get category icon
    const iconConfig = categoryIcons[category];
    const CategoryIcon = iconConfig?.icon || Zap;
    const iconColorClass = iconConfig?.color || 'text-slate-500';

    return (
        <motion.div
            key={category}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 sm:space-y-6"
        >
            {/* Header */}
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
                <button
                    onClick={handleBackPress}
                    aria-label={mode === 'meter' || mode === 'search' ? 'Back to providers' : 'Back'}
                    className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center shrink-0`}>
                        <CategoryIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColorClass}`} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground">{categoryLabel} Provider</h3>
                        <p className="text-muted-foreground text-xs sm:text-sm truncate">Who provides your {categoryLabel.toLowerCase()}?</p>
                    </div>
                </div>
            </div>

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
                                    onClick={() => setMode('search')}
                                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    Search Providers
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    I don&apos;t know
                                </button>
                            </div>
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Suggested for your area</p>

                            <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                {suggestions.slice(0, 3).map((s) => (
                                    <button
                                        key={s.display_name}
                                        onClick={() => handleConfirmSuggestion(s)}
                                        className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/50 hover:bg-muted border border-border rounded-xl text-left transition-all group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center shrink-0`}>
                                                <CategoryIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColorClass}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-medium text-foreground block text-sm sm:text-base truncate">
                                                    {s.display_name}
                                                </span>
                                                {s.rationale_short && (
                                                    <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 block truncate">
                                                        {s.rationale_short}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2">
                                <button
                                    onClick={() => setMode('search')}
                                    className="py-2.5 sm:py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-xs sm:text-sm active:scale-[0.98]"
                                >
                                    Search for another
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="py-2.5 sm:py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-xs sm:text-sm active:scale-[0.98]"
                                >
                                    I don&apos;t know
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-muted/50 border border-border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
                            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center">
                                <Search className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h4 className="text-base sm:text-lg font-medium text-foreground">Search for your provider</h4>
                                <p className="text-muted-foreground text-xs sm:text-sm mt-1">We couldn&apos;t auto-detect this one.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                <button
                                    onClick={() => setMode('search')}
                                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    Search Providers
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                                >
                                    I don&apos;t know
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

                        {/* Search Results */}
                        {!isSearching && searchQuery.length >= 2 && searchResults.map((result) => (
                            <button
                                key={result.display_name}
                                onClick={() => handleSelectResult(result)}
                                className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl text-left transition-all group active:scale-[0.98]"
                            >
                                <span className="font-medium text-foreground transition-colors text-sm sm:text-base truncate">{result.display_name}</span>
                                <Check className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                            </button>
                        ))}

                        {/* Alternative Suggestions (when not searching or search is empty) */}
                        {!isSearching && (!searchQuery || searchQuery.length < 2) && alternativeSuggestions.length > 0 && (
                            <>
                                <div className="px-1 pt-2 pb-1">
                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider">Suggested for your area</p>
                                </div>
                                {alternativeSuggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.display_name}
                                        onClick={() => handleConfirmSuggestion(suggestion)}
                                        className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl text-left transition-all group active:scale-[0.98]"
                                    >
                                        <div className="min-w-0">
                                            <span className="font-medium text-foreground transition-colors block text-sm sm:text-base truncate">
                                                {suggestion.display_name}
                                            </span>
                                            {suggestion.rationale_short && (
                                                <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 block truncate">
                                                    {suggestion.rationale_short}
                                                </span>
                                            )}
                                        </div>
                                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}

                        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                            <div className="text-center pt-4 pb-2">
                                <p className="text-muted-foreground text-xs sm:text-sm mb-3">No matching providers found.</p>
                                <button
                                    onClick={handleManualEntry}
                                    className="text-slate-500 hover:text-slate-400 text-xs sm:text-sm font-medium underline underline-offset-4"
                                >
                                    {`Use "${searchQuery}" anyway`}
                                </button>
                            </div>
                        )}
                    </div>

                    <button
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
                            onClick={handleContinueWithMeter}
                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                        >
                            Continue
                        </button>
                        <button
                            onClick={handleContinueWithoutMeter}
                            className="w-full py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground rounded-xl font-medium transition-colors active:scale-[0.98] text-sm sm:text-base"
                        >
                            Continue without meter number
                        </button>
                    </div>

                    <button
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
