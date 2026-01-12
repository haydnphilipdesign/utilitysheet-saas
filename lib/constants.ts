import { UtilityCategory } from '@/types';

export const UTILITY_CATEGORIES: { key: UtilityCategory; label: string; icon: string }[] = [
    { key: 'electric', label: 'Electric', icon: '⚡' },
    { key: 'gas', label: 'Natural Gas', icon: '🔥' },
    { key: 'propane', label: 'Propane', icon: '🧴' },
    { key: 'oil', label: 'Heating Oil', icon: '🛢️' },
    { key: 'water', label: 'Water', icon: '💧' },
    { key: 'sewer', label: 'Sewer', icon: '🚰' },
    { key: 'trash', label: 'Trash', icon: '🗑️' },
    { key: 'internet', label: 'Internet', icon: '📶' },
    { key: 'cable', label: 'Cable/TV', icon: '📺' },
];

export const UTILITY_CATEGORY_KEYS: UtilityCategory[] = UTILITY_CATEGORIES.map((c) => c.key);

// Default buyer next steps for info sheets
export const DEFAULT_BUYER_STEPS = [
    'Contact each utility provider above to set up new service in your name.',
    'Schedule service to begin on your closing date or the following business day.',
    'Have your closing documents handy — providers may ask for verification of ownership.',
    'If transferring internet service, contact your provider at least 1-2 weeks in advance.',
];
