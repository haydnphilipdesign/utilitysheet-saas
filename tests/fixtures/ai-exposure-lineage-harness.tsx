import React from 'react';
import { createRoot } from 'react-dom/client';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import type { ProviderSuggestion, UtilityCategory } from '@/types';

const names = ['Fixture Electric','Fixture Backup Power','Fixture Other Energy','Fixture Fourth Utility'];
const initial = names.map((display_name,index) => ({ display_name,confidence: 0.9,
    ai_lineage: { run_id: '00000000-0000-4000-8000-000000000001',exposure_id: '00000000-0000-4000-8000-000000000002',
        item_id: `00000000-0000-4000-8000-${String(index+11).padStart(12,'0')}` } }));
const token = 'synthetic-lineage-capability';
createRoot(document.getElementById('root')!).render(<SellerWizard token={token}
    initialRequestData={{ property_address: '12 Fixture Street, Faketown, PA 18301',utility_categories: ['electric','water'],
        collect_electric_meter_number: false,collect_hoa_questions: false,packet_mode: 'simple',advanced_modules: [],advanced_packet_data: {} }}
    initialSuggestions={{ electric: initial } as Record<UtilityCategory,ProviderSuggestion[]>} />);
