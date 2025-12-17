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
import { Check, X, HelpCircle, ChevronDown, Loader2, Search, Zap } from 'lucide-react';
import type { UtilityCategory, ProviderSuggestion, ProviderEntryMode, WaterSource, SewerType, HeatingType } from '@/types';
import { UTILITY_CATEGORIES } from '@/lib/providers/mock-data';
import { getAllSuggestions, searchProviders } from '@/lib/providers/suggestion-service';

interface UtilityState {
    entry_mode: ProviderEntryMode | null;
    display_name: string | null;
    raw_text: string | null;
    hidden: boolean;
}

interface FormState {
    water_source: WaterSource;
    sewer_type: SewerType;
    heating_type: HeatingType;
    utilities: Record<UtilityCategory, UtilityState>;
}

// Mock request data (would come from API in real app)
const mockRequest = {
    property_address: '123 Oak Street, Charlotte, NC 28202',
    utility_categories: ['electric', 'gas', 'water', 'sewer', 'trash'] as UtilityCategory[],
};

export default function SellerFormPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [suggestions, setSuggestions] = useState<Record<UtilityCategory, ProviderSuggestion[]>>({} as Record<UtilityCategory, ProviderSuggestion[]>);

    const [formState, setFormState] = useState<FormState>({
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        utilities: mockRequest.utility_categories.reduce((acc, cat) => {
            acc[cat] = { entry_mode: null, display_name: null, raw_text: null, hidden: false };
            return acc;
        }, {} as Record<UtilityCategory, UtilityState>),
    });

    useEffect(() => {
        // Fetch suggestions for all categories
        async function loadSuggestions() {
            try {
                const result = await getAllSuggestions(
                    mockRequest.property_address,
                    mockRequest.utility_categories
                );
                setSuggestions(result);
            } catch (error) {
                console.error('Failed to load suggestions:', error);
            } finally {
                setLoading(false);
            }
        }

        loadSuggestions();
    }, []);

    // Update hidden state based on applicability toggles
    useEffect(() => {
        setFormState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                water: {
                    ...prev.utilities.water,
                    hidden: prev.water_source === 'well',
                    entry_mode: prev.water_source === 'well' ? 'not_applicable' : prev.utilities.water?.entry_mode,
                },
                sewer: {
                    ...prev.utilities.sewer,
                    hidden: prev.sewer_type === 'septic',
                    entry_mode: prev.sewer_type === 'septic' ? 'not_applicable' : prev.utilities.sewer?.entry_mode,
                },
                gas: {
                    ...prev.utilities.gas,
                    hidden: prev.heating_type === 'electric',
                    entry_mode: prev.heating_type === 'electric' ? 'not_applicable' : prev.utilities.gas?.entry_mode,
                },
            },
        }));
    }, [formState.water_source, formState.sewer_type, formState.heating_type]);

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
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setSubmitted(true);
        setSubmitting(false);
    };

    const completedCount = Object.values(formState.utilities).filter(
        (u) => u.entry_mode !== null
    ).length;
    const totalCount = mockRequest.utility_categories.length;
    const progress = (completedCount / totalCount) * 100;

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
                        {mockRequest.property_address}
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

                {/* Applicability Toggles */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="py-4 space-y-4">
                        <p className="text-sm font-medium text-white">Property Details</p>

                        {/* Water Source */}
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-400">Water Source</p>
                            <div className="flex gap-2">
                                {(['city', 'well', 'not_sure'] as WaterSource[]).map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => setFormState((prev) => ({ ...prev, water_source: option }))}
                                        className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${formState.water_source === option
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                            }`}
                                    >
                                        {option === 'city' ? 'City' : option === 'well' ? 'Well' : 'Not Sure'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sewer Type */}
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-400">Sewer System</p>
                            <div className="flex gap-2">
                                {(['public', 'septic', 'not_sure'] as SewerType[]).map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => setFormState((prev) => ({ ...prev, sewer_type: option }))}
                                        className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${formState.sewer_type === option
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                            }`}
                                    >
                                        {option === 'public' ? 'Public' : option === 'septic' ? 'Septic' : 'Not Sure'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Heating Type */}
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-400">Heating Fuel</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['natural_gas', 'electric', 'not_sure'] as HeatingType[]).map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => setFormState((prev) => ({ ...prev, heating_type: option }))}
                                        className={`py-2 px-3 text-sm rounded-lg border transition-colors ${formState.heating_type === option
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                            }`}
                                    >
                                        {option === 'natural_gas' ? 'Gas' : option === 'electric' ? 'Electric' : 'Not Sure'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Utility Cards */}
                {mockRequest.utility_categories.map((category) => {
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
                        />
                    );
                })}

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
}: UtilityCardProps) {
    const [showSearch, setShowSearch] = useState(false);
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
            const results = await searchProviders(searchQuery, category);
            setSearchResults(results);
            setSearching(false);
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
                            <div className="p-1 rounded-full bg-emerald-500/20">
                                <Check className="h-4 w-4 text-emerald-400" />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-white"
                                onClick={onReset}
                            >
                                <X className="h-4 w-4" />
                            </Button>
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

                {primarySuggestion ? (
                    <>
                        <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                            <p className="text-sm text-zinc-400 mb-1">We think your provider is:</p>
                            <p className="text-lg font-medium text-white">{primarySuggestion.display_name}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                onClick={onConfirm}
                                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                            >
                                <Check className="mr-1 h-4 w-4" />
                                Confirm
                            </Button>
                            <Button
                                onClick={() => setShowSearch(true)}
                                variant="outline"
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            >
                                Not This
                            </Button>
                            <Button
                                onClick={onNotSure}
                                variant="outline"
                                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                            >
                                <HelpCircle className="mr-1 h-4 w-4" />
                                Unsure
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            onClick={() => setShowSearch(true)}
                            variant="outline"
                            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                            <Search className="mr-2 h-4 w-4" />
                            Search Provider
                        </Button>
                        <Button
                            onClick={onNotSure}
                            variant="outline"
                            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                        >
                            <HelpCircle className="mr-2 h-4 w-4" />
                            Not Sure
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
