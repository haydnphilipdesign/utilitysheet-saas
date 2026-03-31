/**
 * Database Queries - Barrel Export
 * 
 * This file re-exports all query functions from domain-specific modules
 * for backwards compatibility with existing imports.
 * 
 * Usage:
 *   import { getRequests, createRequest } from '@/lib/neon/queries';
 * 
 * Or import directly from specific modules:
 *   import { getRequests } from '@/lib/neon/queries/requests';
 */

// Account queries
export {
    ensureAccountRecord,
    getOrCreateAccount,
    updateAccount,
    setOnboardingCompleted,
    getAccountById,
    getAccountsByAuthUserIds,
    getAccountByStripeCustomerId,
    updateAccountStripeCustomer,
    updateAccountSubscription,
    getAccountsWithWeeklySummaryEnabled,
    getMonthlyUsage,
} from './accounts';

// Request queries
export type { PaginatedResult } from './requests';
export {
    getRequests,
    getRequestById,
    getRequestByToken,
    getRequestBySellerToken,
    createRequest,
    updateRequestConfiguration,
    updateSubmittedRequestData,
    propagateAdvancedModuleDefaultsToOpenRequests,
    getRequestCountForAccount,
    updateRequestStatus,
    deleteRequest,
    getDashboardStats,
    getWeeklyStats,
    getUtilityEntriesByRequestId,
} from './requests';

// Brand profile queries
export {
    getBrandProfiles,
    getBrandProfile,
    getDefaultBrandProfile,
    createBrandProfile,
    updateBrandProfile,
    deleteBrandProfile,
} from './brand-profiles';

// Organization queries
export {
    createOrganization,
    getOrganizationById,
    getOrganizationByStripeCustomerId,
    updateOrganizationStripeCustomer,
    updateOrganizationSubscription,
    updateOrganization,
    getAccountOrganizations,
    setActiveOrganization,
    getOrganizationMemberRole,
    getOrganizationMembers,
    getOrganizationSeatUsage,
    isOrganizationMemberByEmail,
    getOrganizationAdminCount,
    updateOrganizationMemberRole,
    removeOrganizationMember,
    clearActiveOrganizationIfMatches,
    getPendingOrganizationInvite,
    createOrganizationInvite,
    createOrganizationInviteWithSeatGuard,
    getOrganizationInviteByToken,
    getOrganizationInvites,
    acceptOrganizationInvite,
    acceptOrganizationInviteWithSeatGuard,
    addOrganizationMember,
} from './organizations';

// Event log queries
export {
    createEventLog,
} from './event-logs';

// Product updates (changelog) queries
export {
    getProductUpdates,
    createProductUpdate,
    deleteProductUpdate,
} from './updates';

// Provider memory queries
export {
    getProviderMemoryCandidates,
} from './provider-memory';

// Intake link queries
export {
    ensureIntakeLink,
    getOrCreateIntakeLink,
    getIntakeLinkBySlug,
    updateIntakeLinkSlug,
    updateIntakeLinkPacketDefaults,
    slugifyIntakeSlug,
    validateIntakeSlug,
} from './intake-links';

export type { ActivationOutreachCandidate } from './activation-outreach';
export {
    getDueActivationOutreachCandidates,
    recordActivationOutreachAttempt,
} from './activation-outreach';
