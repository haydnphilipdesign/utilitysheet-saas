import { sql } from '@/lib/neon/db';
import { OrgTable } from '@/components/admin/OrgTable';

export const dynamic = 'force-dynamic';

async function getOrgs() {
    if (!sql) return [];

    // Assuming we want member count, we might need a subquery or join
    // But for now let's just count members if possible or just list orgs
    // Simple query:
    const data = await sql`
        SELECT o.*, 
        (SELECT count(*) FROM organization_members WHERE organization_id = o.id) as member_count 
        FROM organizations o 
        ORDER BY o.created_at DESC
    `;

    return data;
}

export default async function OrgsPage() {
    const orgs = await getOrgs();

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
                    <p className="text-muted-foreground">
                        Manage B2B accounts and teams.
                    </p>
                </div>
            </div>
            <OrgTable orgs={orgs as any[]} />
        </div>
    );
}
