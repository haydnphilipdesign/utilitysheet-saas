import { neon } from '@neondatabase/serverless';

// Get database connection string from environment
const databaseUrl = process.env.DATABASE_URL;

// Create SQL query function - returns null if not configured
export const sql = databaseUrl ? neon(databaseUrl) : null;

// Helper to check if database is configured
export const isDbConfigured = () => !!databaseUrl;

// Helper to generate UUID for public tokens
export function generateToken(): string {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
