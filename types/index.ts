// UtilitySheet Type Definitions

// Enums
export type RequestStatus = 'draft' | 'sent' | 'in_progress' | 'submitted';

export type ProviderEntryMode =
    | 'suggested_confirmed'
    | 'search_selected'
    | 'free_text'
    | 'unknown'
    | 'not_applicable';

export type UtilityCategory =
    | 'electric'
    | 'gas'
    | 'water'
    | 'sewer'
    | 'trash'
    | 'internet'
    | 'cable'
    | 'propane'
    | 'oil';

export type WaterSource = 'city' | 'well' | 'not_sure';
export type SewerType = 'public' | 'septic' | 'not_sure';
export type HeatingType = 'natural_gas' | 'propane' | 'oil' | 'electric' | 'not_sure';

export type ActorType = 'agent' | 'seller' | 'system';

export type EventName =
    | 'request_created'
    | 'link_copied'
    | 'seller_opened'
    | 'seller_saved'
    | 'seller_submitted'
    | 'pdf_generated'
    | 'pdf_downloaded'
    | 'reminder_sent';

// Entities
export interface Account {
    id: string;
    email: string;
    full_name: string | null;
    plan: 'free' | 'pro' | 'team';
    created_at: string;
}

export interface Team {
    id: string;
    name: string;
    created_at: string;
}

export interface BrandProfile {
    id: string;
    account_id: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    contact_website: string | null;
    disclaimer_text: string | null;
    is_default: boolean;
    created_at: string;
}

export interface PropertyAddressStructured {
    street: string;
    city: string;
    state: string;
    zip: string;
    full: string;
}

export interface Request {
    id: string;
    account_id: string;
    brand_profile_id: string | null;
    property_address: string;
    property_address_structured: PropertyAddressStructured | null;
    seller_name: string | null;
    seller_email: string | null;
    seller_phone: string | null;
    closing_date: string | null;
    status: RequestStatus;
    public_token: string;
    created_at: string;
    updated_at: string;
    last_activity_at: string;
    // Joined data
    brand_profile?: BrandProfile | null;
    utility_entries?: UtilityEntry[];
}

export interface UtilityEntry {
    id: string;
    request_id: string;
    category: UtilityCategory;
    provider_entry_mode: ProviderEntryMode | null;
    provider_display_name: string | null;
    provider_raw_text: string | null;
    provider_canonical_id: string | null;
    suggestion_confidence: number | null;
    contact_phone: string | null;
    contact_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface EventLog {
    id: string;
    request_id: string;
    actor_type: ActorType;
    event_name: EventName;
    payload: Record<string, unknown> | null;
    created_at: string;
}

export interface ProviderCanonical {
    id: string;
    normalized_name: string;
    aliases: string[];
    contact_phone: string | null;
    contact_urls: string[];
    service_types: UtilityCategory[];
    last_verified_at: string | null;
}

// Provider Suggestion API
export interface ProviderSuggestion {
    display_name: string;
    canonical_id?: string;
    confidence: number;
    rationale_short?: string;
}

export interface ProviderContact {
    customer_service_phone?: string;
    start_stop_service_url?: string;
    main_website?: string;
    hours?: string;
}

// Form Data Types
export interface SellerFormData {
    water_source: WaterSource;
    sewer_type: SewerType;
    heating_type: HeatingType;
    fuels_present: (HeatingType | 'not_sure')[];
    primary_heating_type: HeatingType | 'not_sure';
    trash_handled_by: 'municipal' | 'private' | 'not_sure';
    utilities: Record<UtilityCategory, UtilityFormEntry>;
}

export interface UtilityFormEntry {
    entry_mode: ProviderEntryMode;
    display_name: string | null;
    raw_text: string | null;
}

// Request Creation Form
export interface CreateRequestFormData {
    property_address: string;
    seller_name?: string;
    seller_email?: string;
    seller_phone?: string;
    closing_date?: string;
    brand_profile_id?: string;
    utility_categories: UtilityCategory[];
}

// Brand Profile Form
export interface BrandProfileFormData {
    name: string;
    logo_url?: string;
    primary_color: string;
    secondary_color: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    contact_website?: string;
    disclaimer_text?: string;
    is_default: boolean;
}

// Dashboard Stats
export interface DashboardStats {
    total_requests: number;
    draft: number;
    sent: number;
    in_progress: number;
    submitted: number;
    needs_attention: number;
}
