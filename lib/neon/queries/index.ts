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
    getOrCreateAccount,
    updateAccount,
    getAccountById,
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
    createRequest,
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
    getAccountOrganizations,
    setActiveOrganization,
} from './organizations';
