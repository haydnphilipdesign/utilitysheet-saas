"use client";

interface EventLog {
    id: string;
    event_type: string;
    event_data: any;
    ip_address: string;
    created_at: string;
}

interface EventLogTableProps {
    logs: EventLog[];
}

export function EventLogTable({ logs }: EventLogTableProps) {
    if (logs.length === 0) {
        return <div className="text-muted-foreground py-4">No event logs found.</div>;
    }

    return (
        <div className="rounded-md border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50 text-left">
                        <th className="p-4 font-medium">Event</th>
                        <th className="p-4 font-medium">Data</th>
                        <th className="p-4 font-medium">IP Address</th>
                        <th className="p-4 font-medium">Time</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-4 font-medium">{log.event_type}</td>
                            <td className="p-4">
                                <pre className="text-xs font-mono text-muted-foreground max-w-xs overflow-hidden text-ellipsis">
                                    {JSON.stringify(log.event_data)}
                                </pre>
                            </td>
                            <td className="p-4 text-muted-foreground text-xs">{log.ip_address || '-'}</td>
                            <td className="p-4 text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
