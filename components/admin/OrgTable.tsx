"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Organization {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    created_at: string;
    member_count: number;
}

interface OrgTableProps {
    orgs: Organization[];
}

export function OrgTable({ orgs }: OrgTableProps) {
    if (orgs.length === 0) {
        return <div className="py-8 text-center text-muted-foreground">No organizations found.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-[760px] w-full text-sm">
                <thead>
                    <tr className="border-b border-border/70 bg-secondary/40 text-left">
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</th>
                        <th className="p-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {orgs.map((org) => (
                        <tr key={org.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/25">
                            <td className="p-4 font-medium flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={org.logo_url || undefined} />
                                    <AvatarFallback><Building2 className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                {org.name}
                            </td>
                            <td className="p-4 text-muted-foreground">{org.slug}</td>
                            <td className="p-4">{org.member_count}</td>
                            <td className="p-4 text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-right">
                                <Link href={`/admin/organizations/${org.id}`}>
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
