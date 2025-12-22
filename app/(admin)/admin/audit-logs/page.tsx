import { getAuditLogs } from '@/lib/admin';
import { format } from 'date-fns';
import { FileText, User, Shield, Ban, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const actionIcons: Record<string, any> = {
    'impersonation_started': UserCheck,
    'impersonation_ended': UserCheck,
    'user_banned': Ban,
    'user_unbanned': UserCheck,
    'role_changed': Shield,
    'user_updated': User,
};

const actionColors: Record<string, string> = {
    'impersonation_started': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'impersonation_ended': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'user_banned': 'bg-red-500/10 text-red-500 border-red-500/20',
    'user_unbanned': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'role_changed': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'user_updated': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default async function AuditLogsPage() {
    const logs = await getAuditLogs(100);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
                <p className="text-muted-foreground mt-1">
                    Track all admin actions and changes
                </p>
            </div>

            <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-4 opacity-50" />
                        <p>No audit logs yet</p>
                        <p className="text-sm">Admin actions will appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {logs.map((log) => {
                            const Icon = actionIcons[log.action] || FileText;
                            const colorClass = actionColors[log.action] || 'bg-gray-500/10 text-gray-500';

                            return (
                                <div key={log.id} className="p-4 hover:bg-secondary/30 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${colorClass}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={colorClass}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    by <span className="font-medium text-foreground">{log.admin_name || log.admin_email}</span>
                                                </span>
                                                {log.target_email && (
                                                    <>
                                                        <span className="text-muted-foreground">→</span>
                                                        <span className="text-sm font-medium text-foreground">
                                                            {log.target_name || log.target_email}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                                            </p>
                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                <pre className="mt-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded overflow-x-auto">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
