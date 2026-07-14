import { sql } from '@/lib/neon/db';
import { StatsCard } from '@/components/admin/StatsCard';
import { Overview } from '@/components/admin/Overview';
import { RecentActivity } from '@/components/admin/RecentActivity';
import { Users, FileText, Building2, Activity, ClipboardCheck, Link2, TriangleAlert } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/primitives';
import { getActivationFunnelStats, getGrowthSourceStats } from '@/lib/admin/activation-funnel';
import { formatAdminDate } from '@/lib/admin/date-format';
import { getLatestRequestsForUsers } from '@/lib/admin';

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
        growthSources,
    ] = await Promise.all([
        sql`SELECT count(*) as count FROM accounts`,
        sql`SELECT count(*) as count FROM requests`,
        sql`SELECT count(*) as count FROM requests WHERE status = 'in_progress'`,
        sql`SELECT count(*) as count FROM organizations`,
        sql`SELECT status, count(*) as count FROM requests GROUP BY status`,
        sql`
            SELECT r.id, r.account_id, r.created_at, r.status, a.full_name, a.email 
            FROM requests r 
            LEFT JOIN accounts a ON r.account_id = a.id 
            ORDER BY r.created_at DESC 
            LIMIT 5
        `,
        getActivationFunnelStats(),
        getGrowthSourceStats(),
    ]);

    const latestRequestsByUser = await getLatestRequestsForUsers(
        recentRequests.map((request) => request.account_id).filter((id): id is string => Boolean(id))
    );

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
                id: r.account_id,
                name: r.full_name || 'Unknown User',
                email: r.email || 'No email',
            },
            action: 'Created a request',
            details: r.status,
            timestamp: formatAdminDate(r.created_at),
            latestRequests: r.account_id ? latestRequestsByUser[r.account_id] || [] : [],
        })),
        activationFunnel,
        growthSources,
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

            {stats.activationFunnel && (
                <div className="space-y-3">
                    <div>
                        <h2 className="text-lg font-semibold">Growth Funnel</h2>
                        <p className="text-sm text-muted-foreground">
                            Live seller submissions, repeat use, paid adoption, and first-touch sources.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatsCard
                            title="Activated Accounts"
                            value={stats.activationFunnel.firstLiveSubmission.toString()}
                            description={`${stats.activationFunnel.signupToActivationRate}% received a live seller submission`}
                            icon={ClipboardCheck}
                        />
                        <StatsCard
                            title="Activated This Week"
                            value={stats.activationFunnel.firstLiveSubmissionLast7d.toString()}
                            description="first live submissions in the last 7 days"
                            icon={Activity}
                        />
                        <StatsCard
                            title="Habitual Accounts"
                            value={stats.activationFunnel.habitualAccounts.toString()}
                            description={`${stats.activationFunnel.activationToHabitRate}% of activated accounts reached 3 submissions in 30 days`}
                            icon={FileText}
                        />
                        <StatsCard
                            title="Paying Accounts"
                            value={stats.activationFunnel.paidAccounts.toString()}
                            description="Pro accounts and active Team members"
                            icon={Building2}
                        />
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Acquisition source</th>
                                    <th className="px-4 py-3 text-right font-medium">Signups</th>
                                    <th className="px-4 py-3 text-right font-medium">Activated</th>
                                    <th className="px-4 py-3 text-right font-medium">Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.growthSources.map((row) => (
                                    <tr key={row.source} className="border-t border-border/70">
                                        <td className="px-4 py-3">{row.source}</td>
                                        <td className="px-4 py-3 text-right">{row.signups}</td>
                                        <td className="px-4 py-3 text-right">{row.activated}</td>
                                        <td className="px-4 py-3 text-right">{row.activationRate}%</td>
                                    </tr>
                                ))}
                                {stats.growthSources.length === 0 && (
                                    <tr className="border-t border-border/70">
                                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                                            No attributed signups in the last 90 days.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
