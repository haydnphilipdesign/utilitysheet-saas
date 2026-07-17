import { notFound } from 'next/navigation';
import { Building2, Mail } from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { AdminUserControls } from '@/components/admin/AdminUserControls';
import { AdminPageHeader } from '@/components/admin/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatAdminDate } from '@/lib/admin/date-format';
import type { AdminAuditLogRow } from '@/lib/admin';
import type { AdminUserRow, EffectivePlan, Request } from '@/types';

async function getUserData(userId: string) {
    if (!sql) return null;

    const [userRes, requestsRes, logsRes] = await Promise.all([
        sql`
            SELECT
                a.*,
                o.name as active_organization_name,
                o.subscription_status as active_organization_subscription_status
            FROM accounts a
            LEFT JOIN organizations o ON o.id = a.active_organization_id
            WHERE a.id = ${userId}
        `,
        sql`SELECT * FROM requests WHERE account_id = ${userId} ORDER BY created_at DESC`,
        sql`
            SELECT
                l.*,
                a.email as admin_email,
                a.full_name as admin_name,
                t.email as target_email,
                t.full_name as target_name
            FROM admin_audit_logs l
            LEFT JOIN accounts a ON l.admin_id = a.id
            LEFT JOIN accounts t ON l.target_user_id = t.id
            WHERE target_user_id = ${userId}
            ORDER BY created_at DESC
        `,
    ]);

    if (!userRes[0]) return null;

    return {
        user: userRes[0] as unknown as AdminUserRow,
        requests: requestsRes,
        logs: logsRes,
    };
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getUserData(id);

    if (!data) notFound();

    const { user, requests, logs } = data;
    const effectivePlan: EffectivePlan = user.active_organization_subscription_status === 'team'
        ? 'team'
        : (user.subscription_status || 'free');
    const managedUser: AdminUserRow = { ...user, effective_subscription_status: effectivePlan };
    const initials = user.full_name
        ? user.full_name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()
        : user.email.slice(0, 2).toUpperCase();

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title={user.full_name || user.email}
                description="Account context, requests, and the same audited controls available from User Management."
                action={(
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={user.role === 'admin' ? 'default' : user.role === 'banned' ? 'destructive' : 'secondary'}>
                            {user.role}
                        </Badge>
                        <Badge variant="outline">{effectivePlan}</Badge>
                    </div>
                )}
            />

            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardContent className="flex items-start gap-4 p-5">
                        <Avatar className="h-16 w-16">
                            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4 shrink-0" />
                                <span className="truncate">{user.email}</span>
                            </div>
                            <p className="break-all font-mono text-xs text-muted-foreground">ID: {user.id}</p>
                            <p className="text-xs text-muted-foreground">Joined {formatAdminDate(user.created_at)}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Account controls</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Every write requires a reason and remains subject to server authorization, policy checks, audit logging, and the Admin write safety catch.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <AdminUserControls user={managedUser} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader><CardTitle className="text-sm font-medium">Contact information</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div><span className="block text-xs text-muted-foreground">Phone</span>{user.phone || 'Not provided'}</div>
                        <div><span className="block text-xs text-muted-foreground">Company</span>{user.company_name || 'Not provided'}</div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader><CardTitle className="text-sm font-medium">UtilitySheet entitlement</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div><span className="block text-xs text-muted-foreground">Effective access</span><span className="capitalize">{effectivePlan}</span></div>
                        <div>
                            <span className="block text-xs text-muted-foreground">Account override</span>
                            <span className="capitalize">{user.subscription_status}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">Account entitlement is not a statement of Stripe subscription state.</p>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader><CardTitle className="text-sm font-medium">Active workspace</CardTitle></CardHeader>
                    <CardContent>
                        {user.active_organization_id ? (
                            <div className="flex items-start gap-2 text-sm">
                                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground">{user.active_organization_name || 'Workspace'}</p>
                                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{user.active_organization_id}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No active workspace.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="requests" className="w-full">
                <TabsList>
                    <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
                    <TabsTrigger value="log">Audit log ({logs.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="requests" className="mt-4">
                    <RequestsTable requests={requests as unknown as Request[]} />
                </TabsContent>
                <TabsContent value="log" className="mt-4">
                    <AuditLogTable logs={logs as unknown as AdminAuditLogRow[]} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
