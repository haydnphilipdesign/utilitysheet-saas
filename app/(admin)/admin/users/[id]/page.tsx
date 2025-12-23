import { notFound } from 'next/navigation';
import { sql } from '@/lib/neon/db';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { impersonateUser, banUserAction, unbanUserAction } from '../actions';
import { UserCheck, Ban, Shield, Mail, Phone, Calendar, Building } from 'lucide-react';

async function getUserData(userId: string) {
    if (!sql) return null;

    const [userRes, requestsRes, logsRes] = await Promise.all([
        sql`SELECT * FROM accounts WHERE id = ${userId}`,
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

export default async function UserDetailPage({ params }: { params: { id: string } }) {
    const data = await getUserData(params.id);

    if (!data) {
        notFound();
    }

    const { user, requests, logs } = data;
    const initials = user.full_name
        ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : user.email.slice(0, 2).toUpperCase();

    // Server actions wrapping
    async function handleImpersonate() {
        "use server";
        await impersonateUser(user.id);
    }

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
                            {user.subscription_status === 'pro' && (
                                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                                    PRO
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
                <div className="flex gap-2">
                    <form action={handleImpersonate}>
                        <Button variant="outline">
                            <UserCheck className="mr-2 h-4 w-4" />
                            Impersonate
                        </Button>
                    </form>
                    {/* Add Ban/Unban buttons if needed here or rely on the dropdown in the table */}
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
                            <span className="font-medium text-sm capitalize">{user.plan || 'Free'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b last:border-0 border-border/50">
                            <span className="text-muted-foreground text-sm">Status</span>
                            <span className="font-medium text-sm capitalize">{user.subscription_status || 'Active'}</span>
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
                                <span className="text-sm">In Org ({user.active_organization_id})</span>
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
                    <RequestsTable requests={requests as any[]} />
                </TabsContent>
                <TabsContent value="log" className="mt-4">
                    <AuditLogTable logs={logs as any[]} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
