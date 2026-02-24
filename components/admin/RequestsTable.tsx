"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface Request {
    id: string;
    property_address: string;
    status: string;
    created_at: string;
    utility_categories?: string[] | null;
    user_name?: string | null;
    user_email?: string | null;
    seller_name?: string | null;
    seller_email?: string | null;
}

interface RequestsTableProps {
    requests: Request[];
}

export function RequestsTable({ requests }: RequestsTableProps) {
    if (requests.length === 0) {
        return <div className="py-8 text-center text-muted-foreground">No requests found.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-[760px] w-full text-sm">
                <thead>
                    <tr className="border-b border-border/70 bg-secondary/40 text-left">
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</th>
                        <th className="p-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((request) => (
                        <tr key={request.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/25">
                            <td className="p-4 font-medium">{request.property_address}</td>
                            <td className="p-4 text-muted-foreground">
                                {request.user_name || request.user_email || request.seller_name || request.seller_email || '-'}
                            </td>
                            <td className="p-4">
                                <Badge variant={
                                    request.status === 'submitted' ? 'default' :
                                        request.status === 'in_progress' ? 'secondary' :
                                            'outline'
                                }>
                                    {request.status}
                                </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">{new Date(request.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-right">
                                <Link href={`/admin/requests/${request.id}`}>
                                    <Button size="icon" variant="ghost" className="h-8 w-8">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
