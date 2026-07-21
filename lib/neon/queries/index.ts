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
export type { PaginatedResult, TestDriveRequestResult } from './requests';
export {
    getRequests,
    getRequestById,
    getRequestByToken,
    getRequestBySellerToken,
    createRequest,
    getOrCreateTestDriveRequest,
    getTestDriveRequestState,
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
    getBrandProfileForScope,
    getDefaultBrandProfile,
    getIntakeBrandProfile,
    getBrandProfileRequestCounts,
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
    updateOrganizationNotificationSettings,
    getOrganizationAdminRecipients,
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
    getPendingOrganizationInvites,
    getOrganizationInviteForOrganization,
    refreshPendingOrganizationInvite,
    cancelPendingOrganizationInvite,
    acceptOrganizationInvite,
    acceptOrganizationInviteWithSeatGuard,
    addOrganizationMember,
} from './organizations';

// Event log queries
export {
    createEventLog,
    getTestDriveLifecycleEvents,
} from './event-logs';
export type { TestDriveLifecycleEvent } from './event-logs';

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
    getIntakeLinkByAccountId,
    getIntakeLinkBySlug,
    updateIntakeLinkSlug,
    updateIntakeLinkSellerFormDefaults,
    updateIntakeLinkPacketDefaults,
    normalizeIntakeUtilityCategories,
    slugifyIntakeSlug,
    validateIntakeSlug,
} from './intake-links';

export type { ActivationOutreachCandidate } from './activation-outreach';
export {
    getDueActivationOutreachCandidates,
    recordActivationOutreachAttempt,
} from './activation-outreach';

export { saveFirstTouchGrowthAttribution } from './growth-attribution';

export type { GrowthReferralEventType, GrowthReferralSurface } from './growth-referral-events';
export { recordGrowthReferralEvent } from './growth-referral-events';

export type {
    AwardedReferralCredit,
    ReferralCredit,
    ReferralCreditCounts,
    ReferralCreditStatus,
} from './referral-credits';

export type { AccountSecurityEventAction } from './account-data';
export {
    getAccountClosureReadiness,
    getAccountDataExport,
    recordAccountSecurityEvent,
    updateAccountEmail,
} from './account-data';
export {
    awardReferralCreditForActivation,
    getEarnedReferralCredits,
    getReferralCreditCountsForAccount,
    getReferralCreditsForAccount,
    getValidReferralReferrerAccountId,
    markReferralCreditApplied,
} from './referral-credits';
