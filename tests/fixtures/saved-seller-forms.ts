import type { IntakeLink } from '@/lib/neon/queries/intake-links';
export const savedForm: IntakeLink = {
    id: '00000000-0000-4000-8000-000000000011', account_id: 'account-1', organization_id: null,
    name: 'Listing', seller_heading: 'A few questions about your home', seller_intro: 'Please share the details you know.', scope_initialized: true,
    slug: 'listing-form', is_active: true, is_default: true, is_referral_identity: true,
    default_brand_profile_id: null, default_utility_categories: ['electric', 'water'], default_packet_mode: 'simple',
    advanced_modules: [], advanced_module_exclusions: {}, collect_hoa_questions: false,
    collect_electric_meter_number: false, revision: 2, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z',
};
