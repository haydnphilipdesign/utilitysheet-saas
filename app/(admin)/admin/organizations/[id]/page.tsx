import { notFound } from 'next/navigation';
import { sql } from '@/lib/neon/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AdminAccountPreview } from '@/components/admin/AdminAccountPreview';
import { formatAdminDate } from '@/lib/admin/date-format';
import { getLatestRequestsForUsers } from '@/lib/admin';
import { Building2, CreditCard, Users } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/primitives';
import { classifyAdminWorkspace, getAdminWorkspaceKindLabel } from '@/lib/admin/workspace-classification';

type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    subscription_status: string | null;
    subscription_id: string | null;
    subscription_ends_at: string | null;
    seat_quantity: number;
    created_at: string;
};

type OrganizationMemberRow = {
    id: string;
    organization_id: string;
    account_id: string;
    role: 'admin' | 'member';
    created_at: string;
    full_name: string | null;
    email: string;
    user_role: string;
    subscription_status: string | null;
};

async function getOrgData(orgId: string) {
    if (!sql) return null;

    const [orgRes, membersRes] = await Promise.all([
        sql`SELECT * FROM organizations WHERE id = ${orgId}`,
        sql`
            SELECT om.*, a.full_name, a.email, a.role as user_role, a.subscription_status
            FROM organization_members om 
            JOIN accounts a ON om.account_id = a.id 
            WHERE organization_id = ${orgId} 
            ORDER BY om.created_at ASC
        `
    ]);

    if (!orgRes[0]) return null;

    return {
        org: orgRes[0] as unknown as OrganizationRow,
        members: membersRes as unknown as OrganizationMemberRow[],
    };
}

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getOrgData(id);

    if (!data) {
        notFound();
    }

    const { org, members } = data;
    const orgAdmins = members.filter((member) => member.role === 'admin');
    const workspaceKind = classifyAdminWorkspace({
        subscriptionStatus: org.subscription_status,
        memberCount: members.length,
    });
    const latestRequests = await getLatestRequestsForUsers(members.map((member) => member.account_id));

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title={org.name}
                description={`Workspace slug: ${org.slug}`}
                action={(
                    <Badge variant={workspaceKind === 'team_organization' ? 'default' : 'secondary'}>
                        {getAdminWorkspaceKindLabel(workspaceKind)}
                    </Badge>
                )}
            />

            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={org.logo_url || undefined} />
                    <AvatarFallback><Building2 className="h-6 w-6" /></AvatarFallback>
                </Avatar>
                <p className="text-sm text-muted-foreground">
                    {workspaceKind === 'team_organization'
                        ? 'This workspace has Team entitlement and is counted as Team adoption.'
                        : workspaceKind === 'shared_workspace'
                            ? 'This workspace has multiple members but no Team entitlement, so it is not counted as a Team organization.'
                            : 'This is a personal/default account workspace and is not counted as Team adoption.'}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Workspace information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">ID</span> {org.id}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Created</span> {formatAdminDate(org.created_at)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> Billing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="py-1">
                            <span className="font-medium text-sm text-muted-foreground block">Plan</span>
                            <Badge variant={org.subscription_status === 'team' ? 'default' : 'outline'}>{org.subscription_status || 'free'}</Badge>
                        </div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Seats</span> {org.seat_quantity || 0}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Renews / Ends</span> {org.subscription_ends_at ? formatAdminDate(org.subscription_ends_at) : 'N/A'}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Stripe Subscription</span> {org.subscription_id || 'N/A'}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Workspace Admins</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {orgAdmins.length ? orgAdmins.map((admin) => (
                            <AdminAccountPreview
                                key={admin.id}
                                account={{
                                    id: admin.account_id,
                                    name: admin.full_name,
                                    email: admin.email,
                                    role: admin.user_role,
                                    plan: admin.subscription_status,
                                    organizationName: org.name,
                                }}
                                latestRequests={latestRequests[admin.account_id] || []}
                            >
                                <span className="block font-medium text-foreground">{admin.full_name || admin.email}</span>
                                <span className="block text-xs text-muted-foreground">{admin.email}</span>
                            </AdminAccountPreview>
                        )) : (
                            <p className="text-sm text-muted-foreground">No workspace admins found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" /> Members ({members.length})
                </h3>
                <div className="rounded-md border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50 text-left">
                                <th className="p-4 font-medium">Name</th>
                                <th className="p-4 font-medium">Email</th>
                                <th className="p-4 font-medium">Role</th>
                                <th className="p-4 font-medium">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/50">
                                    <td className="p-4 font-medium">
                                        <AdminAccountPreview
                                            account={{
                                                id: member.account_id,
                                                name: member.full_name,
                                                email: member.email,
                                                role: member.user_role,
                                                plan: member.subscription_status,
                                                organizationName: org.name,
                                            }}
                                            latestRequests={latestRequests[member.account_id] || []}
                                        >
                                            {member.full_name || member.email}
                                        </AdminAccountPreview>
                                    </td>
                                    <td className="p-4 text-muted-foreground">
                                        <AdminAccountPreview
                                            account={{
                                                id: member.account_id,
                                                name: member.full_name,
                                                email: member.email,
                                                role: member.user_role,
                                                plan: member.subscription_status,
                                                organizationName: org.name,
                                            }}
                                            latestRequests={latestRequests[member.account_id] || []}
                                        >
                                            {member.email}
                                        </AdminAccountPreview>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>{member.role}</Badge>
                                    </td>
                                    <td className="p-4 text-muted-foreground">{formatAdminDate(member.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
