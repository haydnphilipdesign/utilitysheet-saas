import { cookies } from 'next/headers';
import { ImpersonationBannerClient } from './ImpersonationBannerClient';
import { sql } from '@/lib/neon/db';

export async function ImpersonationBanner() {
    const cookieStore = await cookies();
    const impersonatorId = cookieStore.get('impersonator_id')?.value;
    const impersonatedUserId = cookieStore.get('impersonated_user_id')?.value;

    if (!impersonatorId || !impersonatedUserId) return null;

    // Get the impersonated user's info
    let impersonatedEmail = 'Unknown User';
    if (sql) {
        const result = await sql`
            SELECT email, full_name FROM accounts WHERE id = ${impersonatedUserId}
        `;
        if (result[0]) {
            impersonatedEmail = result[0].full_name || result[0].email;
        }
    }

    return <ImpersonationBannerClient impersonatedUserName={impersonatedEmail} />;
}
