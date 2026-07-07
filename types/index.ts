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

export type PacketMode = 'simple' | 'advanced';

export type AdvancedModuleKey =
    | 'lawn_exterior'
    | 'irrigation_seasonal_controls'
    | 'mailbox_access'
    | 'smart_home_security'
    | 'service_providers';

export type AdvancedModuleExclusions = Partial<Record<AdvancedModuleKey, string[]>>;

export type AdvancedPacketData = {
    lawn_exterior?: {
        lawn_care_provider_name?: string | null;
        lawn_care_provider_phone?: string | null;
        snow_removal_provider_name?: string | null;
        snow_removal_provider_phone?: string | null;
        lawn_exterior_notes?: string | null;
    } | null;
    irrigation_seasonal_controls?: {
        has_irrigation_system?: 'yes' | 'no' | 'not_sure' | null;
        irrigation_provider_name?: string | null;
        irrigation_provider_phone?: string | null;
        watering_days?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> | null;
        irrigation_season_start_month?: string | null;
        irrigation_season_end_month?: string | null;
        irrigation_notes?: string | null;
    } | null;
    mailbox_access?: {
        mailbox_number?: string | null;
        mailbox_location?: string | null;
        parking_instructions?: string | null;
        breaker_box_location?: string | null;
        main_water_shutoff_location?: string | null;
    } | null;
    smart_home_security?: {
        security_system_brand?: string | null;
        smart_thermostat_brand?: string | null;
        smart_doorbell_brand?: string | null;
        smart_home_notes?: string | null;
    } | null;
    service_providers?: {
        hvac_provider_name?: string | null;
        hvac_provider_phone?: string | null;
        pest_control_provider_name?: string | null;
        pest_control_provider_phone?: string | null;
        plumber_provider_name?: string | null;
        plumber_provider_phone?: string | null;
        service_provider_notes?: string | null;
    } | null;
};

export type WaterSource = 'city' | 'well' | 'hoa' | 'not_sure';
export type SewerType = 'public' | 'septic' | 'hoa' | 'not_sure';
export type HeatingType = 'natural_gas' | 'propane' | 'oil' | 'electric' | 'not_sure';
export type TrashPickupDay =
    | 'mon'
    | 'tue'
    | 'wed'
    | 'thu'
    | 'fri'
    | 'sat'
    | 'sun'
    | 'varies'
    | 'not_sure';

export interface TrashUtilityExtra {
    [key: string]: unknown;
    has_recycling?: 'yes' | 'no' | 'not_sure' | null;
    trash_pickup_day?: TrashPickupDay | null;
    trash_pickup_days?: TrashPickupDay[] | null;
    recycling_pickup_day?: TrashPickupDay | null;
    recycling_pickup_days?: TrashPickupDay[] | null;
}

export type ActorType = 'agent' | 'seller' | 'system';

export type EventName =
    | 'request_created'
    | 'link_copied'
    | 'seller_opened'
    | 'seller_saved'
    | 'seller_submitted'
    | 'submitted_sheet_edited'
    | 'pdf_generated'
    | 'pdf_downloaded'
    | 'reminder_sent';

// User Role enum for admin functionality
export type UserRole = 'user' | 'admin' | 'banned';

export type Plan = 'free' | 'pro' | 'canceled';
export type OrganizationPlan = 'free' | 'team' | 'canceled';
export type EffectivePlan = Plan | 'team';

export type UpdateCategory = 'bugfix' | 'feature' | 'announcement';

export type MessageTemplates = {
    seller_request?: {
        sms?: string;
        mailto?: {
            subject?: string;
            body?: string;
        };
        email?: {
            subject?: string;
            body?: string;
            button_text?: string;
        };
    };
    seller_reminder?: {
        email?: {
            subject?: string;
            body?: string;
            button_text?: string;
        };
    };
};

// Admin audit action types
export type AdminAction =
    | 'user_banned'
    | 'user_unbanned'
    | 'role_changed'
    | 'plan_changed'
    | 'impersonation_started'
    | 'impersonation_ended'
    | 'request_status_changed'
    | 'request_seller_updated'
    | 'request_reminder_sent'
    | 'testimonial_request_sent'
    | 'testimonial_test_sent'
    | 'user_updated'
    | 'product_update_created'
    | 'product_update_deleted';

// Entities
export interface Account {
    id: string;
    auth_user_id: string | null;
    email: string;
    full_name: string | null;
    company_name: string | null;
    phone: string | null;
    active_organization_id: string | null;
    role: UserRole;
    stripe_customer_id?: string | null;
    subscription_status: Plan;
    subscription_id?: string | null;
    subscription_ends_at?: string | null;
    onboarding_completed_at?: string | null;
    notification_preferences?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export type ActivationOutreachStage = 'after_15m' | 'after_1d';
export type ActivationOutreachStatus = 'sent' | 'skipped' | 'failed';

export interface ActivationOutreachLog {
    id: string;
    account_id: string;
    auth_user_id: string | null;
    email: string;
    campaign: string;
    stage: ActivationOutreachStage;
    status: ActivationOutreachStatus;
    metadata: Record<string, unknown> | null;
    sent_at: string | null;
    created_at: string;
}

export interface AdminUserRow extends Account {
    active_organization_subscription_status?: OrganizationPlan | null;
    active_organization_name?: string | null;
    effective_subscription_status?: EffectivePlan;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    stripe_customer_id?: string | null;
    subscription_status?: OrganizationPlan;
    subscription_id?: string | null;
    subscription_ends_at?: string | null;
    seat_quantity?: number;
    // Returned by membership-joined queries (not a column on organizations)
    role?: 'admin' | 'member';
    created_at: string;
    updated_at: string;
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    account_id: string;
    role: 'admin' | 'member';
    created_at: string;
}

export interface BrandProfile {
    id: string;
    account_id: string;
    organization_id: string | null;
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    contact_website: string | null;
    disclaimer_text: string | null;
    message_templates: MessageTemplates | null;
    is_default: boolean;
    // Advanced customization fields
    buyer_next_steps: string[] | null;
    next_steps_title: string | null;
    show_powered_by: boolean;
    show_generation_date: boolean;
    welcome_message: string | null;
    created_at: string;
}

export interface PropertyAddressStructured {
    street: string;
    city: string;
    state: string;
    zip: string;
    full: string;
    confidence: 'high' | 'medium' | 'low';
    issues: string[];
    source: 'local' | 'verified';
}

export interface Request {
    id: string;
    account_id: string;
    organization_id: string | null;
    brand_profile_id: string | null;
    property_address: string;
    property_address_structured: PropertyAddressStructured | null;
    seller_name: string | null;
    seller_email: string | null;
    seller_phone: string | null;
    closing_date: string | null;
    status: RequestStatus;
    public_token: string;
    seller_token?: string | null;
    utility_categories?: UtilityCategory[] | null;
    water_source?: WaterSource | null;
    sewer_type?: SewerType | null;
    heating_type?: HeatingType | null;
    packet_mode?: PacketMode | null;
    advanced_modules?: AdvancedModuleKey[] | null;
    advanced_module_exclusions?: AdvancedModuleExclusions | null;
    advanced_packet_data?: AdvancedPacketData | null;
    metered_at?: string | null;
    is_locked?: boolean | null;
    can_edit_submitted_sheet?: boolean | null;
    locked_reason?: string | null;
    locked_at?: string | null;
    deleted_at?: string | null;
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
    entry_mode: ProviderEntryMode | null;
    display_name: string | null;
    raw_text: string | null;
    meter_number?: string | null;
    canonical_id: string | null;
    confidence_score: number | null;
    contact_phone: string | null;
    contact_url: string | null;
    extra?: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface SubmittedSheetEditableTrashDetails {
    hasRecycling: '' | 'yes' | 'no' | 'not_sure';
    trashPickupDay: '' | TrashPickupDay;
    trashPickupDays: TrashPickupDay[];
    recyclingPickupDay: '' | TrashPickupDay;
    recyclingPickupDays: TrashPickupDay[];
}

export interface SubmittedSheetEditableUtility {
    providerName: string;
    contactPhone: string;
    contactUrl: string;
    meterNumber: string;
    trashDetails: SubmittedSheetEditableTrashDetails;
}

export type SubmittedSheetEditableUtilities = Partial<Record<UtilityCategory, SubmittedSheetEditableUtility>>;

export interface SubmittedSheetEditorRequest {
    id: string;
    publicToken: string;
    propertyAddress: string;
    sellerName: string | null;
    sellerEmail: string | null;
    sellerPhone: string | null;
    closingDate: string | null;
    status: RequestStatus;
    updatedAt: string;
    packetMode: PacketMode;
    utilityCategories: UtilityCategory[];
    advancedModules: AdvancedModuleKey[];
    advancedModuleExclusions: AdvancedModuleExclusions;
    waterSource: WaterSource | null;
    sewerType: SewerType | null;
    heatingType: HeatingType | null;
}

export interface SubmittedSheetEditorPayload {
    request: SubmittedSheetEditorRequest;
    editor: {
        collectElectricMeterNumber: boolean;
        utilities: SubmittedSheetEditableUtilities;
        advanced: AdvancedPacketData;
    };
}

export interface SubmittedSheetUpdatePayload {
    updatedAt: string;
    propertyAddress: string;
    utilities: SubmittedSheetEditableUtilities;
    advanced: AdvancedPacketData;
}

export interface EventLog {
    id: string;
    request_id: string;
    event_type: EventName | string;
    event_data: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

// Admin Audit Log for tracking admin actions
export interface AdminAuditLog {
    id: string;
    admin_id: string;
    target_user_id: string | null;
    action: AdminAction;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
}

export interface ProductUpdate {
    id: string;
    title: string;
    body: string;
    category: UpdateCategory;
    is_published: boolean;
    published_at: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
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
    contact_phone?: string;
    contact_website?: string;
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
    meter_number?: string | null;
    extra?: Record<string, unknown> | null;
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
    packet_mode?: PacketMode;
    advanced_modules?: AdvancedModuleKey[];
    advanced_module_exclusions?: AdvancedModuleExclusions;
}

// Brand Profile Form
// Optional fields use explicit update semantics shared with the branding API:
// key absent = leave unchanged, null = clear the stored value, value = set it.
export interface BrandProfileFormData {
    name: string;
    logo_url?: string | null;
    primary_color: string;
    secondary_color: string;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    contact_website?: string | null;
    disclaimer_text?: string | null;
    message_templates?: MessageTemplates;
    is_default: boolean;
    // Advanced customization fields
    buyer_next_steps?: string[] | null;
    next_steps_title?: string | null;
    show_powered_by?: boolean;
    show_generation_date?: boolean;
    welcome_message?: string | null;
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
