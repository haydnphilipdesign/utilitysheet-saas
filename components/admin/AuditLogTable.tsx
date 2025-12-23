"use client";

interface AuditLog {
    id: string;
    action: string;
    admin_email?: string;
    metadata: any;
    created_at: string;
}

interface AuditLogTableProps {
    logs: AuditLog[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
    if (logs.length === 0) {
        return <div className="text-muted-foreground py-4">No audit logs found.</div>;
    }

    return (
        <div className="rounded-md border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50 text-left">
                        <th className="p-4 font-medium">Action</th>
                        <th className="p-4 font-medium">Performed By</th>
                        <th className="p-4 font-medium">Details</th>
                        <th className="p-4 font-medium">Date</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-4 font-medium">{log.action}</td>
                            <td className="p-4 text-muted-foreground">{log.admin_email || 'System'}</td>
                            <td className="p-4 text-xs font-mono text-muted-foreground max-w-xs truncate">
                                {JSON.stringify(log.metadata)}
                            </td>
                            <td className="p-4 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
