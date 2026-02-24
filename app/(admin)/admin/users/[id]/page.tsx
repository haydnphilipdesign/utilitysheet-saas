import { notFound } from 'next/navigation';
import { sql } from '@/lib/neon/db';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Building } from 'lucide-react';
import type { Request, EffectivePlan } from '@/types';
import type { AdminAuditLog } from '@/types';

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
            SELECT l.*, a.email as admin_email 
            FROM admin_audit_logs l 
            LEFT JOIN accounts a ON l.admin_id = a.id 
            WHERE target_user_id = ${userId} 
            ORDER BY created_at DESC
        `
    ]);

    if (!userRes[0]) return null;

    return {
        user: userRes[0],
        requests: requestsRes,
        logs: logsRes
    };
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getUserData(id);

    if (!data) {
        notFound();
    }

    const { user, requests, logs } = data;
    const effectivePlan: EffectivePlan =
        user.active_organization_subscription_status === 'team'
            ? 'team'
            : (user.subscription_status || 'free');
    const initials = user.full_name
        ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : user.email.slice(0, 2).toUpperCase();

    return (
        <div className="space-y-8">
            {/* Header: Profile & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            {user.full_name || 'No Name'}
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="ml-2">
                                {user.role}
                            </Badge>
                            {effectivePlan === 'pro' && (
                                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                                    PRO
                                </Badge>
                            )}
                            {effectivePlan === 'team' && (
                                <Badge className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white border-0">
                                    TEAM
                                </Badge>
                            )}
                        </h2>
                        <div className="flex flex-col gap-1 mt-1 text-muted-foreground">
                            <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4" /> {user.email}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-mono text-xs opacity-50">ID: {user.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Details Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between py-1 border-b last:border-0 border-border/50">
                            <span className="text-muted-foreground text-sm">Phone</span>
                            <span className="font-medium text-sm">{user.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b last:border-0 border-border/50">
                            <span className="text-muted-foreground text-sm">Company</span>
                            <span className="font-medium text-sm">{user.company_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b last:border-0 border-border/50">
                            <span className="text-muted-foreground text-sm">Joined</span>
                            <span className="font-medium text-sm">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Subscription</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between py-1 border-b last:border-0 border-border/50">
                            <span className="text-muted-foreground text-sm">Plan</span>
                            <span className="font-medium text-sm capitalize">{effectivePlan}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b last:border-0 border-border/50">
                            <span className="text-muted-foreground text-sm">Status</span>
                            <span className="font-medium text-sm capitalize">
                                {effectivePlan === 'canceled' ? 'Canceled' : 'Active'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Organization</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {user.active_organization_id ? (
                            <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                    {user.active_organization_name || 'Organization'} ({user.active_organization_id})
                                </span>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">No active organization</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tabs: Requests & History */}
            <Tabs defaultValue="requests" className="w-full">
                <TabsList>
                    <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
                    <TabsTrigger value="log">Audit Log ({logs.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="requests" className="mt-4">
                    <RequestsTable requests={requests as unknown as Request[]} />
                </TabsContent>
                <TabsContent value="log" className="mt-4">
                    <AuditLogTable logs={logs as unknown as AdminAuditLog[]} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
