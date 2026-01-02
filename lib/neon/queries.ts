/**
 * Database Queries
 * 
 * This file has been refactored into domain-specific modules for better maintainability.
 * All exports are re-exported from the modular structure in ./queries/
 * 
 * Modules:
 * - queries/accounts.ts - Account management
 * - queries/requests.ts - Request CRUD and stats
 * - queries/brand-profiles.ts - Brand profile management
 * - queries/organizations.ts - Organization management
 * 
 * This file is kept for backwards compatibility with existing imports.
 */

export * from './queries/index';
