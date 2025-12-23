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
    utility_categories: string[];
}

interface RequestsTableProps {
    requests: Request[];
}

export function RequestsTable({ requests }: RequestsTableProps) {
    if (requests.length === 0) {
        return <div className="text-muted-foreground py-4">No requests found.</div>;
    }

    return (
        <div className="rounded-md border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50 text-left rounded-t-md">
                        <th className="p-4 font-medium">Address</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium">Created</th>
                        <th className="p-4 font-medium center w-[50px]">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((request) => (
                        <tr key={request.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-4 font-medium">{request.property_address}</td>
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
                            <td className="p-4">
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
