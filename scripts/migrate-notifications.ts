import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

async function main() {
    let databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        try {
            const envPath = path.resolve(process.cwd(), '.env.local');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/DATABASE_URL=(.*)/);
                if (match) {
                    databaseUrl = match[1].trim();
                    if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) || (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
                        databaseUrl = databaseUrl.slice(1, -1);
                    }
                }
            }
        } catch (e) {
            console.warn('Could not read .env.local');
        }
    }

    if (!databaseUrl) {
        console.error('DATABASE_URL is not set and could not be found in .env.local');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    try {
        console.log('Adding notification_preferences column to accounts table...');
        await sql`
      ALTER TABLE accounts 
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;
    `;
        console.log('Successfully added notification_preferences column.');
    } catch (error) {
        console.error('Error running migration:', error);
        process.exit(1);
    }
}

main();
