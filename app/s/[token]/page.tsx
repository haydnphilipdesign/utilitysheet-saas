'use client';

import { useEffect, useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Check, X, HelpCircle, ChevronDown, Loader2, Search, Zap, AlertTriangle } from 'lucide-react';
import type { UtilityCategory, ProviderSuggestion, ProviderEntryMode, WaterSource, SewerType, HeatingType } from '@/types';
import { UTILITY_CATEGORIES } from '@/lib/constants';
// Suggestion service only used server-side now
// import { getAllSuggestions, searchProviders } from '@/lib/providers/suggestion-service';

interface UtilityState {
    entry_mode: ProviderEntryMode | null;
    display_name: string | null;
    raw_text: string | null;
    hidden: boolean;
    notes?: string;
    extra?: Record<string, any>;
}

interface FormState {
    water_source: WaterSource;
    sewer_type: SewerType;
    heating_type: HeatingType;
    fuels_present: string[];
    primary_heating_type: string | null;
    trash_handled_by: 'municipal' | 'private' | 'not_sure';
    utilities: Record<UtilityCategory, UtilityState>;
}

interface RequestData {
    property_address: string;
    utility_categories: UtilityCategory[];
}

export default function SellerFormPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [suggestions, setSuggestions] = useState<Record<UtilityCategory, ProviderSuggestion[]>>({} as Record<UtilityCategory, ProviderSuggestion[]>);

    // Request data from API (replaces hardcoded mockRequest)
    const [requestData, setRequestData] = useState<RequestData | null>(null);

    const [formState, setFormState] = useState<FormState>({
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        trash_handled_by: 'not_sure',
        utilities: {} as Record<UtilityCategory, UtilityState>,
    });
    const [activeCategories, setActiveCategories] = useState<UtilityCategory[]>([]);

    // Fetch request data from API
    useEffect(() => {
        async function loadRequestData() {
            try {
                const response = await fetch(`/api/seller/${resolvedParams.token}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('Request not found. Please check your link and try again.');
                    } else {
                        setError('Failed to load request. Please try again later.');
                    }
                    setLoading(false);
                    return;
                }

                const data = await response.json();
                const request = data.request;

                const reqData: RequestData = {
                    property_address: request.property_address,
                    utility_categories: request.utility_categories || ['electric', 'gas', 'water', 'sewer', 'trash'],
                };

                setRequestData(reqData);
                setSuggestions(data.suggestions || {});

                // Initialize form state with utility categories
                let categories = reqData.utility_categories || ['electric', 'water', 'sewer', 'trash'];
                if (!categories.includes('electric')) {
                    categories = ['electric', ...categories];
                }
                setActiveCategories(categories);

                setFormState(prev => ({
                    ...prev,
                    utilities: categories.reduce((acc, cat) => {
                        acc[cat] = { entry_mode: null, display_name: null, raw_text: null, hidden: false };
                        return acc;
                    }, {} as Record<UtilityCategory, UtilityState>),
                }));

            } catch (err) {
                console.error('Failed to load request data:', err);
                setError('Failed to load request. Please try again later.');
            } finally {
                setLoading(false);
            }
        }

        loadRequestData();
    }, [resolvedParams.token]);

    // Update utilities based on activeCategories and fuels
    useEffect(() => {
        setFormState((prev) => {
            const newUtilities = { ...prev.utilities };

            // Ensure all active categories have a state
            activeCategories.forEach((cat) => {
                if (!newUtilities[cat]) {
                    newUtilities[cat] = { entry_mode: null, display_name: null, raw_text: null, hidden: false };
                }
                newUtilities[cat].hidden = false;
            });

            // Handle fuels
            const fuelCategories: UtilityCategory[] = ['gas', 'propane', 'oil'];
            fuelCategories.forEach((cat) => {
                const isPresent = prev.fuels_present.includes(cat === 'gas' ? 'natural_gas' : cat);
                if (isPresent) {
                    if (!newUtilities[cat]) {
                        newUtilities[cat] = { entry_mode: null, display_name: null, raw_text: null, hidden: false };
                    }
                    newUtilities[cat].hidden = false;
                } else {
                    if (newUtilities[cat]) {
                        newUtilities[cat].hidden = true;
                    }
                }
            });

            // Hide categories not in activeCategories (and not fuels handled above)
            Object.keys(newUtilities).forEach((cat) => {
                const category = cat as UtilityCategory;
                if (!activeCategories.includes(category) && !fuelCategories.includes(category)) {
                    newUtilities[category].hidden = true;
                }
            });

            return { ...prev, utilities: newUtilities };
        });
    }, [activeCategories, formState.fuels_present]);

    const handleConfirm = (category: UtilityCategory, suggestion: ProviderSuggestion) => {
        setFormState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [category]: {
                    entry_mode: 'suggested_confirmed',
                    display_name: suggestion.display_name,
                    raw_text: null,
                    hidden: false,
                },
            },
        }));
    };

    const handleNotSure = (category: UtilityCategory) => {
        setFormState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [category]: {
                    entry_mode: 'unknown',
                    display_name: null,
                    raw_text: null,
                    hidden: false,
                },
            },
        }));
    };

    const handleSelectProvider = (category: UtilityCategory, name: string) => {
        setFormState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [category]: {
                    entry_mode: 'search_selected',
                    display_name: name,
                    raw_text: name,
                    hidden: false,
                },
            },
        }));
    };

    const handleFreeText = (category: UtilityCategory, text: string) => {
        setFormState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [category]: {
                    entry_mode: 'free_text',
                    display_name: text,
                    raw_text: text,
                    hidden: false,
                },
            },
        }));
    };

    const resetCategory = (category: UtilityCategory) => {
        setFormState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [category]: {
                    entry_mode: null,
                    display_name: null,
                    raw_text: null,
                    hidden: false,
                },
            },
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const response = await fetch(`/api/seller/${resolvedParams.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState),
            });

            if (response.ok) {
                setSubmitted(true);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to submit form. Please try again.');
            }
        } catch (err) {
            console.error('Failed to submit form:', err);
            setError('An error occurred. Please try again later.');
        } finally {
            setSubmitting(false);
        }
    };

    const completedCount = Object.values(formState.utilities).filter(
        (u) => u.entry_mode !== null
    ).length;
    const totalCount = requestData?.utility_categories.length || 0;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                    <p className="text-zinc-400">Loading your form...</p>
                </div>
            </div>
        );
    }

    if (error || !requestData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
                        <p className="text-zinc-400 mb-6">
                            {error || 'Something went wrong. Please check your link and try again.'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Thank You!</h1>
                        <p className="text-zinc-400 mb-6">
                            Your utility information has been submitted successfully. Your agent will receive this information shortly.
                        </p>
                        <p className="text-sm text-zinc-500">
                            You can close this page now.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                            <Zap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-white">UtilitySheet</span>
                    </div>
                    <h1 className="text-lg font-semibold text-white">
                        Utility Information
                    </h1>
                    <p className="text-sm text-zinc-400 truncate">
                        {requestData.property_address}
                    </p>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                        {completedCount} of {totalCount} completed
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Intro */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="py-4">
                        <p className="text-sm text-zinc-300">
                            Please confirm your utility providers below. This takes <strong>1-2 minutes</strong> and helps ensure a smooth handoff to the buyers.
                        </p>
                    </CardContent>
                </Card>

                {/* Utilities Checklist */}
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-white px-1">Utilities to confirm</p>
                    <div className="flex flex-wrap gap-2">
                        {['electric', 'water', 'sewer', 'trash', 'internet', 'cable'].map((key) => {
                            const cat = UTILITY_CATEGORIES.find(c => c.key === key);
                            const isActive = activeCategories.includes(key as UtilityCategory);
                            const isElectric = key === 'electric';

                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        if (isElectric) return; // Electric is required/pre-selected
                                        setActiveCategories(prev =>
                                            isActive
                                                ? prev.filter(c => c !== key)
                                                : [...prev, key as UtilityCategory]
                                        );
                                    }}
                                    className={`py-2 px-4 rounded-full border text-sm font-medium transition-all ${isActive
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                        } ${isElectric ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                    {cat?.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Fuels Selection */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="py-5 space-y-6">
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-white flex items-center gap-2">
                                <span className="p-1 rounded bg-zinc-800">🔥</span>
                                Fuels present
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'natural_gas', label: 'Natural Gas' },
                                    { id: 'propane', label: 'Propane' },
                                    { id: 'oil', label: 'Heating Oil' },
                                    { id: 'electric', label: 'Electric-only (no gas/propane/oil)' },
                                    { id: 'not_sure', label: 'Not sure' }
                                ].map((fuel) => {
                                    const isSelected = formState.fuels_present.includes(fuel.id);
                                    return (
                                        <button
                                            key={fuel.id}
                                            onClick={() => {
                                                setFormState(prev => {
                                                    let next = [...prev.fuels_present];
                                                    if (isSelected) {
                                                        next = next.filter(f => f !== fuel.id);
                                                    } else {
                                                        // If selecting 'electric' or 'not_sure', clear others
                                                        if (fuel.id === 'electric' || fuel.id === 'not_sure') {
                                                            next = [fuel.id];
                                                        } else {
                                                            // If selecting a fuel, remove 'electric' and 'not_sure'
                                                            next = next.filter(f => f !== 'electric' && f !== 'not_sure');
                                                            next.push(fuel.id);
                                                        }
                                                    }
                                                    return { ...prev, fuels_present: next };
                                                });
                                            }}
                                            className={`py-3 px-3 text-xs text-left rounded-xl border transition-all ${isSelected
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-medium'
                                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                                }`}
                                        >
                                            {fuel.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Primary Heat Source - only show if multiple fuels or gas/propane/oil selected */}
                        {(formState.fuels_present.length > 0 && !formState.fuels_present.includes('electric') && !formState.fuels_present.includes('not_sure')) && (
                            <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                                <p className="text-sm font-medium text-white">Primary heat source</p>
                                <div className="flex flex-wrap gap-2">
                                    {['Gas', 'Propane', 'Oil', 'Electric', 'Not sure'].map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => setFormState(prev => ({ ...prev, primary_heating_type: option }))}
                                            className={`py-2 px-4 rounded-lg border text-xs transition-colors ${formState.primary_heating_type === option
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Utility Cards */}
                <div className="space-y-4 pt-6">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-sm font-semibold text-white">Utility Providers</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Confirm each below</p>
                    </div>
                    {requestData.utility_categories.map((category: UtilityCategory) => {
                        const catInfo = UTILITY_CATEGORIES.find((c) => c.key === category);
                        const state = formState.utilities[category];
                        const categorySuggestions = suggestions[category] || [];
                        const primarySuggestion = categorySuggestions[0];

                        if (state?.hidden) return null;

                        return (
                            <UtilityCard
                                key={category}
                                category={category}
                                label={catInfo?.label || category}
                                icon={catInfo?.icon || '⚡'}
                                state={state}
                                primarySuggestion={primarySuggestion}
                                onConfirm={() => primarySuggestion && handleConfirm(category, primarySuggestion)}
                                onNotSure={() => handleNotSure(category)}
                                onSelectProvider={(name) => handleSelectProvider(category, name)}
                                onFreeText={(text) => handleFreeText(category, text)}
                                onReset={() => resetCategory(category)}
                                extra={state?.extra}
                                onUpdateExtra={(extra) => setFormState(prev => ({
                                    ...prev,
                                    utilities: {
                                        ...prev.utilities,
                                        [category]: { ...prev.utilities[category], extra }
                                    }
                                }))}
                            />
                        );
                    })}
                </div>

                {/* Submit Button */}
                <div className="sticky bottom-0 py-4 bg-gradient-to-t from-zinc-950 to-transparent">
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-6 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit
                                <Check className="ml-2 h-5 w-5" />
                            </>
                        )}
                    </Button>
                    <p className="text-center text-xs text-zinc-500 mt-2">
                        You can submit even with &quot;Not Sure&quot; answers
                    </p>
                </div>
            </main>
        </div>
    );
}

// Utility Card Component
interface UtilityCardProps {
    category: UtilityCategory;
    label: string;
    icon: string;
    state: UtilityState;
    primarySuggestion?: ProviderSuggestion;
    onConfirm: () => void;
    onNotSure: () => void;
    onSelectProvider: (name: string) => void;
    onFreeText: (text: string) => void;
    onReset: () => void;
    extra?: Record<string, any>;
    onUpdateExtra?: (extra: Record<string, any>) => void;
}

function UtilityCard({
    category,
    label,
    icon,
    state,
    primarySuggestion,
    onConfirm,
    onNotSure,
    onSelectProvider,
    onFreeText,
    onReset,
    extra,
    onUpdateExtra,
}: UtilityCardProps) {
    const [showSearch, setShowSearch] = useState(false);
    const [showExtra, setShowExtra] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProviderSuggestion[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const response = await fetch(`/api/suggestions/search?query=${encodeURIComponent(searchQuery)}&category=${category}`);
                if (response.ok) {
                    const results = await response.json();
                    setSearchResults(results);
                }
            } catch (err) {
                console.error('Search failed:', err);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, category]);

    // Completed state
    if (state.entry_mode !== null) {
        return (
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{icon}</span>
                            <div>
                                <p className="text-sm text-zinc-400">{label}</p>
                                <p className="font-medium text-white">
                                    {state.display_name || (
                                        <span className="text-zinc-500 italic">Not sure</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 border-zinc-700 text-zinc-400 hover:text-white"
                                onClick={onReset}
                            >
                                Edit
                            </Button>
                            <div className="p-1 rounded-full bg-emerald-500/20">
                                <Check className="h-4 w-4 text-emerald-400" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Search state
    if (showSearch) {
        return (
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{icon}</span>
                            <p className="font-medium text-white">{label}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-500 hover:text-white"
                            onClick={() => setShowSearch(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search provider name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                            autoFocus
                        />
                    </div>
                    {searching && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                        </div>
                    )}
                    {searchResults.length > 0 && (
                        <div className="space-y-1">
                            {searchResults.map((result) => (
                                <button
                                    key={result.canonical_id || result.display_name}
                                    onClick={() => onSelectProvider(result.display_name)}
                                    className="w-full text-left px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-white transition-colors"
                                >
                                    {result.display_name}
                                </button>
                            ))}
                        </div>
                    )}
                    {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                        <div className="text-center py-2">
                            <p className="text-sm text-zinc-500 mb-2">No results found</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-zinc-700 text-zinc-300"
                                onClick={() => onFreeText(searchQuery)}
                            >
                                Use &quot;{searchQuery}&quot; anyway
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Default state with suggestion
    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="py-4 space-y-4">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <p className="font-medium text-white">{label}</p>
                </div>

                {category === 'trash' && !state.entry_mode && (
                    <div className="space-y-4 mb-4">
                        <p className="text-sm text-zinc-400">Trash is handled by:</p>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'municipal', label: 'Municipal / HOA (Included)', icon: '🏛️' },
                                { id: 'private', label: 'Private Hauler (I pay a bill)', icon: '🚛' },
                                { id: 'not_sure', label: 'Not sure', icon: '❓' }
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        onUpdateExtra?.({ ...extra, trash_type: option.id });
                                        if (option.id === 'municipal') {
                                            onSelectProvider('Municipal/HOA');
                                        }
                                    }}
                                    className={`w-full flex items-center justify-between py-3 px-4 rounded-xl border transition-all ${extra?.trash_type === option.id
                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-medium'
                                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                        }`}
                                >
                                    <span>{option.label}</span>
                                    <span>{option.icon}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {(category !== 'trash' || (category === 'trash' && extra?.trash_type === 'private' && !state.entry_mode)) && (
                    <>
                        {primarySuggestion ? (
                            <>
                                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                                    <p className="text-sm text-zinc-400 mb-1">We think your provider is:</p>
                                    <p className="text-lg font-medium text-white">{primarySuggestion.display_name}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={onConfirm}
                                        className="bg-emerald-500 text-white rounded-lg py-2.5 px-2 text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => setShowSearch(true)}
                                        className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg py-2.5 px-2 text-xs font-medium active:scale-95 transition-transform"
                                    >
                                        Not This
                                    </button>
                                    <button
                                        onClick={onNotSure}
                                        className="bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg py-2.5 px-2 text-xs font-medium active:scale-95 transition-transform"
                                    >
                                        Unsure
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    onClick={() => setShowSearch(true)}
                                    variant="outline"
                                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
                                >
                                    <Search className="mr-2 h-4 w-4" />
                                    Search
                                </Button>
                                <Button
                                    onClick={onNotSure}
                                    variant="outline"
                                    className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-sm"
                                >
                                    <HelpCircle className="mr-2 h-4 w-4" />
                                    Not Sure
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* Extra fields for specific utilities */}
                {(category === 'propane' || category === 'oil' || (category === 'trash' && extra?.trash_type === 'private')) && (
                    <div className="pt-2 border-t border-zinc-800/50 mt-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowExtra(!showExtra);
                            }}
                            className="flex items-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            <ChevronDown className={`mr-1 h-3 w-3 transition-transform ${showExtra ? 'rotate-180' : ''}`} />
                            More details
                        </button>

                        {showExtra && (
                            <div className="mt-3 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                {category === 'propane' && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-zinc-400">Tank Ownership</p>
                                        <div className="flex gap-2">
                                            {['Owned', 'Leased', 'Unsure'].map((option) => (
                                                <button
                                                    key={option}
                                                    onClick={() => onUpdateExtra?.({ ...extra, tank: option })}
                                                    className={`flex-1 py-1.5 px-2 text-xs rounded-md border transition-colors ${extra?.tank === option
                                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
                                                        }`}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {category === 'oil' && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-zinc-400">Auto-delivery plan?</p>
                                        <div className="flex gap-2">
                                            {['Yes', 'No', 'Unsure'].map((option) => (
                                                <button
                                                    key={option}
                                                    onClick={() => onUpdateExtra?.({ ...extra, auto_delivery: option })}
                                                    className={`flex-1 py-1.5 px-2 text-xs rounded-md border transition-colors ${extra?.auto_delivery === option
                                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
                                                        }`}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <p className="text-xs text-zinc-400">Notes (optional)</p>
                                    <Input
                                        placeholder="Add any additional details..."
                                        value={extra?.notes || ''}
                                        onChange={(e) => onUpdateExtra?.({ ...extra, notes: e.target.value })}
                                        className="h-8 text-xs bg-zinc-800/50 border-zinc-700 text-zinc-300"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
