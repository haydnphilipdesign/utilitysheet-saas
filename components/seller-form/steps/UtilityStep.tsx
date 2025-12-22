'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Search, AlertCircle, X, HelpCircle } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import { UtilityCategory, ProviderSuggestion } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UtilityStepProps {
    category: UtilityCategory;
    categoryLabel: string;
    state: WizardState;
    updateState: (category: UtilityCategory, updates: any) => void;
    suggestions: ProviderSuggestion[];
    onNext: () => void;
    onBack: () => void;
}

export function UtilityStep({
    category,
    categoryLabel,
    state,
    updateState,
    suggestions,
    onNext,
    onBack
}: UtilityStepProps) {
    const [mode, setMode] = useState<'view' | 'search'>('view');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProviderSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Primary suggestion is the first one
    const topSuggestion = suggestions?.[0];

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

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/suggestions/search?query=${encodeURIComponent(searchQuery)}&category=${category}`);
                if (res.ok) setSearchResults(await res.json());
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, category]);

    const currentUtilityState = state.utilities[category];
    const isCompleted = currentUtilityState?.entry_mode !== null;

    const handleConfirmSuggestion = (s: ProviderSuggestion) => {
        updateState(category, {
            entry_mode: 'suggested_confirmed',
            display_name: s.display_name,
            raw_text: null,
            contact_phone: s.contact_phone || null,
            contact_url: s.contact_website || null
        });
        onNext();
    };

    const handleSelectResult = (result: ProviderSuggestion) => {
        updateState(category, {
            entry_mode: 'search_selected',
            display_name: result.display_name,
            raw_text: result.display_name,
            contact_phone: result.contact_phone || null,
            contact_url: result.contact_website || null
        });
        onNext();
    };

    const handleManualEntry = () => {
        updateState(category, {
            entry_mode: 'free_text',
            display_name: searchQuery,
            raw_text: searchQuery
        });
        onNext();
    };

    const handleSkip = () => {
        updateState(category, {
            entry_mode: 'unknown',
            display_name: null,
            raw_text: null
        });
        onNext();
    };

    return (
        <motion.div
            key={category}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                >
                    ←
                </button>
                <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">{categoryLabel} Provider</h3>
                    <p className="text-muted-foreground text-sm">Who provides your {categoryLabel.toLowerCase()}?</p>
                </div>
            </div>

            {mode === 'view' && (
                <div className="space-y-6">
                    {suggestions.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Suggested for your area</p>

                            <div className="grid grid-cols-1 gap-3">
                                {suggestions.slice(0, 3).map((s) => (
                                    <button
                                        key={s.display_name}
                                        onClick={() => handleConfirmSuggestion(s)}
                                        className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted border border-border rounded-xl text-left transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-lg shrink-0">
                                                ⚡
                                            </div>
                                            <div>
                                                <span className="font-medium text-foreground block">
                                                    {s.display_name}
                                                </span>
                                                {s.rationale_short && (
                                                    <span className="text-xs text-muted-foreground mt-0.5 block">
                                                        {s.rationale_short}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Check className="h-5 w-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setMode('search')}
                                    className="py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-sm"
                                >
                                    Search for another
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors text-sm"
                                >
                                    I don't know
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-muted/50 border border-border rounded-2xl p-8 text-center space-y-6">
                            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Search className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h4 className="text-lg font-medium text-foreground">Search for your provider</h4>
                                <p className="text-muted-foreground text-sm mt-1">We couldn't auto-detect this one.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => setMode('search')}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                                >
                                    Search Providers
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-3 bg-transparent border border-border text-muted-foreground hover:text-foreground rounded-xl font-medium transition-colors"
                                >
                                    I don't know
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mode === 'search' && (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            autoFocus
                            type="text"
                            placeholder={`Search ${categoryLabel} providers...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-xl py-4 pl-12 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full text-muted-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {isSearching && (
                            <div className="p-4 text-center text-muted-foreground text-sm">Searching...</div>
                        )}

                        {/* Search Results */}
                        {!isSearching && searchQuery.length >= 2 && searchResults.map((result) => (
                            <button
                                key={result.display_name}
                                onClick={() => handleSelectResult(result)}
                                className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl text-left transition-all group"
                            >
                                <span className="font-medium text-foreground transition-colors">{result.display_name}</span>
                                <Check className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}

                        {/* Alternative Suggestions (when not searching or search is empty) */}
                        {!isSearching && (!searchQuery || searchQuery.length < 2) && alternativeSuggestions.length > 0 && (
                            <>
                                <div className="px-1 pt-2 pb-1">
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Suggested for your area</p>
                                </div>
                                {alternativeSuggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.display_name}
                                        onClick={() => handleConfirmSuggestion(suggestion)}
                                        className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl text-left transition-all group"
                                    >
                                        <div>
                                            <span className="font-medium text-foreground transition-colors block">
                                                {suggestion.display_name}
                                            </span>
                                            {suggestion.rationale_short && (
                                                <span className="text-xs text-muted-foreground mt-0.5 block">
                                                    {suggestion.rationale_short}
                                                </span>
                                            )}
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Check className="h-4 w-4 text-emerald-500" />
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}

                        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                            <div className="text-center pt-4 pb-2">
                                <p className="text-muted-foreground text-sm mb-3">No matching providers found.</p>
                                <button
                                    onClick={handleManualEntry}
                                    className="text-emerald-400 hover:text-emerald-300 text-sm font-medium underline underline-offset-4"
                                >
                                    Use "{searchQuery}" anyway
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setMode('view')}
                        className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                        Cancel Search
                    </button>
                </div>
            )}
        </motion.div>
    );
}
