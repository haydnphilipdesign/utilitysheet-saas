import { sql } from '@/lib/neon/db';
import { StatsCard } from '@/components/admin/StatsCard';
import { Overview } from '@/components/admin/Overview';
import { RecentActivity } from '@/components/admin/RecentActivity';
import { Users, FileText, Building2, Activity, ClipboardCheck, Link2, TriangleAlert } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/primitives';
import { getActivationFunnelStats } from '@/lib/admin/activation-funnel';

// Force dynamic rendering as this is an admin dashboard
export const dynamic = 'force-dynamic';

async function getStats() {
    if (!sql) return null;

    const [
        usersCount,
        requestsCount,
        activeRequestsCount,
        orgsCount,
        requestsByStatus,
        recentRequests,
        activationFunnel,
    ] = await Promise.all([
        sql`SELECT count(*) as count FROM accounts`,
        sql`SELECT count(*) as count FROM requests`,
        sql`SELECT count(*) as count FROM requests WHERE status = 'in_progress'`,
        sql`SELECT count(*) as count FROM organizations`,
        sql`SELECT status, count(*) as count FROM requests GROUP BY status`,
        sql`
            SELECT r.id, r.created_at, r.status, a.full_name, a.email 
            FROM requests r 
            LEFT JOIN accounts a ON r.account_id = a.id 
            ORDER BY r.created_at DESC 
            LIMIT 5
        `,
        getActivationFunnelStats(),
    ]);

    return {
        totalUsers: Number(usersCount[0]?.count || 0),
        totalRequests: Number(requestsCount[0]?.count || 0),
        activeRequests: Number(activeRequestsCount[0]?.count || 0),
        totalOrgs: Number(orgsCount[0]?.count || 0),
        requestsByStatus: requestsByStatus.map(r => ({
            name: r.status?.charAt(0).toUpperCase() + r.status?.slice(1) || 'Unknown',
            total: Number(r.count || 0)
        })),
        recentActivity: recentRequests.map(r => ({
            id: r.id,
            user: {
                name: r.full_name || 'Unknown User',
                email: r.email || 'No email',
            },
            action: 'Created a request',
            details: r.status,
            timestamp: new Date(r.created_at).toLocaleDateString(),
        })),
        activationFunnel,
    };
}

export default async function AdminDashboardPage() {
    const stats = await getStats();

    if (!stats) {
        return <div className="p-8">Database not configured</div>;
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Admin Dashboard"
                description="Live overview of user growth, requests, and organization activity."
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Users"
                    value={stats.totalUsers.toString()}
                    description="Registered users"
                    icon={Users}
                />
                <StatsCard
                    title="Total Requests"
                    value={stats.totalRequests.toString()}
                    description="All time requests"
                    icon={FileText}
                />
                <StatsCard
                    title="Active Requests"
                    value={stats.activeRequests.toString()}
                    description="Currently in progress"
                    icon={Activity}
                />
                <StatsCard
                    title="Organizations"
                    value={stats.totalOrgs.toString()}
                    description="Active organizations"
                    icon={Building2}
                />
            </div>

            {stats.activationFunnel && (
                <div className="space-y-3">
                    <div>
                        <h2 className="text-lg font-semibold">Activation Funnel</h2>
                        <p className="text-sm text-muted-foreground">
                            App-side activation health for regular user accounts.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatsCard
                            title="Dashboard Ready"
                            value={`${stats.activationFunnel.dashboardReadyRate}%`}
                            description={`${stats.activationFunnel.dashboardReady} of ${stats.activationFunnel.totalAccounts} have core defaults`}
                            icon={Activity}
                        />
                        <StatsCard
                            title="Setup Complete"
                            value={`${stats.activationFunnel.onboardingCompletionRate}%`}
                            description={`${stats.activationFunnel.onboardingCompleted} completed onboarding`}
                            icon={ClipboardCheck}
                        />
                        <StatsCard
                            title="Seller Link Ready"
                            value={stats.activationFunnel.sellerLinkReady.toString()}
                            description="users have reusable intake links"
                            icon={Link2}
                        />
                        <StatsCard
                            title="No Setup / No Request"
                            value={`${stats.activationFunnel.inactiveRate}%`}
                            description={`${stats.activationFunnel.noOnboardingNoRequest} users may need follow-up`}
                            icon={TriangleAlert}
                            trend="down"
                        />
                    </div>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium">Request Status Distribution</h3>
                    </div>
                    <Overview data={stats.requestsByStatus} />
                </div>
                <div className="col-span-3 rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium">Recent Activity</h3>
                        <p className="text-sm text-muted-foreground">
                            Latest requests created.
                        </p>
                    </div>
                    <RecentActivity items={stats.recentActivity} />
                </div>
            </div>
        </div>
    );
}
