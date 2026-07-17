"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Eye, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatAdminDate } from "@/lib/admin/date-format";
import { getAdminWorkspaceKindLabel, type AdminWorkspaceKind } from "@/lib/admin/workspace-classification";

interface Organization {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    subscription_status?: string | null;
    seat_quantity?: number;
    created_at: string;
    member_count: number;
    admin_names?: string[];
    admin_count?: number;
    workspace_kind: AdminWorkspaceKind;
}

interface OrgTableProps {
    orgs: Organization[];
}

export function OrgTable({ orgs }: OrgTableProps) {
    if (orgs.length === 0) {
        return <div className="py-8 text-center text-muted-foreground">No workspaces found.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-[920px] w-full text-sm">
                <thead>
                    <tr className="border-b border-border/70 bg-secondary/40 text-left">
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace type</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entitlement</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admins</th>
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
                                <Link href={`/admin/organizations/${org.id}`} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    {org.name}
                                </Link>
                            </td>
                            <td className="p-4 text-muted-foreground">{org.slug}</td>
                            <td className="p-4">
                                <Badge variant={org.workspace_kind === 'team_organization' ? 'default' : 'secondary'}>
                                    {getAdminWorkspaceKindLabel(org.workspace_kind)}
                                </Badge>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col gap-1">
                                    <Badge variant={org.subscription_status === "team" ? "default" : "outline"} className="w-fit">
                                        {org.subscription_status || "free"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{org.seat_quantity || 0} seats</span>
                                </div>
                            </td>
                            <td className="p-4 text-muted-foreground">
                                <span className="block max-w-[220px] truncate">
                                    {org.admin_names?.length ? org.admin_names.slice(0, 2).join(", ") : "No admins"}
                                </span>
                                {(org.admin_count || 0) > 2 ? (
                                    <span className="text-xs">+{(org.admin_count || 0) - 2} more</span>
                                ) : null}
                            </td>
                            <td className="p-4">{org.member_count}</td>
                            <td className="p-4 text-muted-foreground">{formatAdminDate(org.created_at)}</td>
                            <td className="p-4 text-right">
                                <Link
                                    href={`/admin/organizations/${org.id}`}
                                    aria-label={`Inspect workspace ${org.name}`}
                                    title="Inspect workspace"
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                                >
                                    <Eye className="h-4 w-4" />
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
