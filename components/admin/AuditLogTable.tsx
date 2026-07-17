'use client';

import Link from 'next/link';
import type { AdminAuditLogRow } from '@/lib/admin';
import { buildAuditLogPresentation } from '@/lib/admin/audit-log-presentation';
import { formatAdminDateTime } from '@/lib/admin/date-format';

interface AuditLogTableProps {
    logs: AdminAuditLogRow[];
}
export function AuditLogTable({ logs }: AuditLogTableProps) {
    if (logs.length === 0) {
        return <div className="py-4 text-muted-foreground">No audit logs found.</div>;
    }

    return (
        <div className="space-y-3">
            {logs.map((log) => {
                const presentation = buildAuditLogPresentation(log);
                return (
                    <article key={log.id} className="rounded-lg border border-border/70 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="font-medium text-foreground">{presentation.label}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{presentation.summary}</p>
                            </div>
                            <time dateTime={log.created_at} className="text-xs font-medium text-foreground">
                                {formatAdminDateTime(log.created_at)}
                            </time>
                        </div>
                        {presentation.reason ? (
                            <p className="mt-3 rounded-md bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Reason:</span> {presentation.reason}
                            </p>
                        ) : null}
                        {presentation.relatedRecords.length ? (
                            <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                {presentation.relatedRecords.map((record) => (
                                    <Link key={`${record.href}-${record.label}`} href={record.href} className="font-medium text-foreground hover:underline">
                                        {record.label}
                                    </Link>
                                ))}
                            </div>
                        ) : null}
                        {(presentation.userAgent || Object.keys(presentation.metadata).length) ? (
                            <details className="mt-3 rounded-md border border-border/70 p-3">
                                <summary className="cursor-pointer text-xs text-muted-foreground">Technical evidence</summary>
                                {presentation.userAgent ? (
                                    <p className="mt-2 break-words text-xs text-muted-foreground">User agent: {presentation.userAgent}</p>
                                ) : null}
                                {Object.keys(presentation.metadata).length ? (
                                    <pre className="mt-2 overflow-x-auto text-[11px] text-muted-foreground">
                                        {JSON.stringify(presentation.metadata, null, 2)}
                                    </pre>
                                ) : null}
                            </details>
                        ) : null}
                    </article>
                );
            })}
        </div>
    );
}
