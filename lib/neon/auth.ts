import { createAuthClient } from '@neondatabase/auth';

// Get the Neon Auth URL from environment or use empty string for demo mode
const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL || '';

// Create auth client - returns null if not configured (demo mode)
export const authClient = authUrl ? createAuthClient(authUrl) : null;

// Helper to check if auth is configured
export const isAuthConfigured = () => !!authUrl;
