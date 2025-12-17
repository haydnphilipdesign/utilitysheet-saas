import { neon, Pool } from '@neondatabase/serverless';

// Get database connection string from environment
const databaseUrl = process.env.DATABASE_URL || '';

// Create a SQL query function for simple queries
export const sql = databaseUrl ? neon(databaseUrl) : null;

// Create a connection pool for transactions
export const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

// Helper to check if database is configured
export const isDbConfigured = () => !!databaseUrl;
