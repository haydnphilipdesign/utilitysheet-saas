import { notFound } from 'next/navigation';
import { sql } from '@/lib/neon/db';
import { UtilityEntriesTable } from '@/components/admin/UtilityEntriesTable';
import { EventLogTable } from '@/components/admin/EventLogTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

async function getRequestData(requestId: string) {
    if (!sql) return null;

    const [requestRes, entriesRes, logsRes] = await Promise.all([
        sql`
            SELECT r.*, a.full_name as user_name, a.email as user_email 
            FROM requests r 
            LEFT JOIN accounts a ON r.account_id = a.id 
            WHERE r.id = ${requestId}
        `,
        sql`SELECT * FROM utility_entries WHERE request_id = ${requestId} ORDER BY created_at ASC`,
        sql`SELECT * FROM event_logs WHERE request_id = ${requestId} ORDER BY created_at DESC`
    ]);

    if (!requestRes[0]) return null;

    return {
        request: requestRes[0],
        entries: entriesRes,
        logs: logsRes
    };
}

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
    const data = await getRequestData(params.id);

    if (!data) {
        notFound();
    }

    const { request, entries, logs } = data;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Request Details</h2>
                    <p className="text-muted-foreground">ID: {request.id}</p>
                </div>
                <Badge className="text-lg px-4 py-1" variant={
                    request.status === 'submitted' ? 'default' :
                        request.status === 'in_progress' ? 'secondary' :
                            'outline'
                }>
                    {request.status}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Property Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Address</span> {request.property_address}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Utilities</span> {request.utility_categories?.join(', ') || 'N/A'}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Water Source</span> {request.water_source || 'N/A'}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Sewer Type</span> {request.sewer_type || 'N/A'}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Heating Type</span> {request.heating_type || 'N/A'}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Seller & User Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Seller Name</span> {request.seller_name || 'N/A'}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Seller Email</span> {request.seller_email || 'N/A'}</div>
                        <Separator className="my-2" />
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Agent Name</span> {request.user_name || 'N/A'}</div>
                        <div className="py-1"><span className="font-medium text-sm text-muted-foreground block">Agent Email</span> {request.user_email || 'N/A'}</div>
                    </CardContent>
                </Card>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-4">Utility Entries</h3>
                <UtilityEntriesTable entries={entries as any[]} />
            </div>

            <div>
                <h3 className="text-lg font-medium mb-4">Event Logs</h3>
                <EventLogTable logs={logs as any[]} />
            </div>
        </div>
    );
}
