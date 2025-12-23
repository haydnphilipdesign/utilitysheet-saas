import { notFound } from 'next/navigation';
import { sql } from '@/lib/neon/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building2, Users } from 'lucide-react';

async function getOrgData(orgId: string) {
    if (!sql) return null;

    const [orgRes, membersRes] = await Promise.all([
        sql`SELECT * FROM organizations WHERE id = ${orgId}`,
        sql`
            SELECT om.*, a.full_name, a.email, a.role as user_role 
            FROM organization_members om 
            JOIN accounts a ON om.account_id = a.id 
            WHERE organization_id = ${orgId} 
            ORDER BY om.created_at ASC
        `
    ]);

    if (!orgRes[0]) return null;

    return {
        org: orgRes[0],
        members: membersRes
    };
}

export default async function OrgDetailPage({ params }: { params: { id: string } }) {
    const data = await getOrgData(params.id);

    if (!data) {
        notFound();
    }

    const { org, members } = data;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={org.logo_url || undefined} />
                    <AvatarFallback className="text-xl"><Building2 className="h-10 w-10" /></AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{org.name}</h2>
                    <p className="text-muted-foreground">slug: {org.slug}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Organization Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">ID</span> {org.id}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Created</span> {new Date(org.created_at).toLocaleDateString()}</div>
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
                            {members.map((member: any) => (
                                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/50">
                                    <td className="p-4 font-medium">{member.full_name}</td>
                                    <td className="p-4 text-muted-foreground">{member.email}</td>
                                    <td className="p-4">
                                        <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>{member.role}</Badge>
                                    </td>
                                    <td className="p-4 text-muted-foreground">{new Date(member.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
