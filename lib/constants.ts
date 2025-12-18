import { UtilityCategory } from '@/types';

export const UTILITY_CATEGORIES: { key: UtilityCategory; label: string; icon: string }[] = [
    { key: 'electric', label: 'Electric', icon: '⚡' },
    { key: 'gas', label: 'Natural Gas', icon: '🔥' },
    { key: 'water', label: 'Water', icon: '💧' },
    { key: 'sewer', label: 'Sewer', icon: '🚰' },
    { key: 'trash', label: 'Trash', icon: '🗑️' },
    { key: 'internet', label: 'Internet', icon: '📶' },
];
