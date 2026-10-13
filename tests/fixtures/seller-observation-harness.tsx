import React from 'react';
import { createRoot } from 'react-dom/client';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import type { ProviderSuggestion, UtilityCategory } from '@/types';

// Isolated browser bundle of the real seller wizard: no Next server, database or
// collector. The spec intercepts every request this page makes.
const token = window.location.pathname.split('/').filter(Boolean).pop() || 'synthetic-token';

createRoot(document.getElementById('root')!).render(
    <SellerWizard
        token={token}
        initialRequestData={{
            property_address: '12 Sentinel Street, Faketown, PA 18301',
            utility_categories: ['electric', 'water'],
            collect_electric_meter_number: false,
            collect_hoa_questions: false,
            packet_mode: 'simple',
            advanced_modules: [],
            advanced_packet_data: {},
        }}
        initialSuggestions={{
            electric: [{ display_name: 'Sentinel Electric Cooperative', confidence: 0.9 }],
        } as Record<UtilityCategory, ProviderSuggestion[]>}
    />
);
