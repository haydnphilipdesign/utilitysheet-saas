"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { formatAdminDate } from "@/lib/admin/date-format";
import { cn } from "@/lib/utils";

export type AdminAccountPreviewRequest = {
    id: string;
    propertyAddress: string;
    status: string;
    createdAt: string;
};

export type AdminAccountPreviewAccount = {
    id: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    plan?: string | null;
    organizationName?: string | null;
};

type AdminAccountPreviewProps = {
    account: AdminAccountPreviewAccount;
    children: React.ReactNode;
    className?: string;
    align?: "left" | "inline";
    latestRequests?: AdminAccountPreviewRequest[];
};

function formatBadgeLabel(value: string) {
    return value.replace(/_/g, " ");
}

export function AdminAccountPreview({ account, children, className, align = "left", latestRequests = [] }: AdminAccountPreviewProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const displayName = account.name || account.email || "Unknown account";
    const hasProfile = Boolean(account.id);

    const copyEmail = async () => {
        if (!account.email) return;

        try {
            await navigator.clipboard.writeText(account.email);
            setCopied(true);
            toast.success("Email copied");
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Could not copy email");
        }
    };

    if (!hasProfile) {
        return <>{children}</>;
    }

    return (
        <>
            <button
                type="button"
                className={cn(
                    "rounded-md text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    align === "inline" ? "inline-flex max-w-full items-center" : "block w-full",
                    className
                )}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                {children}
            </button>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="right" className="w-full sm:max-w-xl">
                    <SheetHeader className="border-b border-border/70">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-secondary/60 text-sm font-semibold">
                            {(displayName[0] || "?").toUpperCase()}
                        </div>
                        <SheetTitle className="text-lg">{displayName}</SheetTitle>
                        <SheetDescription className="space-y-2">
                            {account.email ? <span className="block">{account.email}</span> : null}
                            <span className="block font-mono text-[11px]">ID: {account.id}</span>
                        </SheetDescription>
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            {account.role ? <Badge variant="secondary">{formatBadgeLabel(account.role)}</Badge> : null}
                            {account.plan ? <Badge variant="outline">{formatBadgeLabel(account.plan)}</Badge> : null}
                            {account.organizationName ? <Badge variant="outline">{account.organizationName}</Badge> : null}
                        </div>
                    </SheetHeader>

                    <div className="space-y-5 overflow-y-auto p-6">
                        <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account Shortcuts</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link href={`/admin/users/${account.id}`} className="inline-flex">
                                    <Button variant="outline" size="sm">
                                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                        View Profile
                                    </Button>
                                </Link>
                                {account.email ? (
                                    <>
                                        <Button variant="outline" size="sm" onClick={copyEmail}>
                                            {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                                            Copy Email
                                        </Button>
                                        <Link href={`mailto:${account.email}`} className="inline-flex">
                                            <Button variant="outline" size="sm">
                                                <Mail className="mr-1 h-3.5 w-3.5" />
                                                Email User
                                            </Button>
                                        </Link>
                                    </>
                                ) : null}
                            </div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Requests</h3>
                                <Link href={`/admin/requests?q=${account.id}`} className="text-xs text-muted-foreground hover:text-foreground">
                                    View all
                                </Link>
                            </div>
                            {latestRequests.length > 0 ? (
                                <div className="mt-3 divide-y divide-border/70">
                                    {latestRequests.map((request) => (
                                        <Link
                                            key={request.id}
                                            href={`/admin/requests/${request.id}`}
                                            className="block rounded-md py-2 text-sm hover:bg-background/70"
                                        >
                                            <span className="block truncate font-medium text-foreground">{request.propertyAddress}</span>
                                            <span className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                <span>{formatBadgeLabel(request.status)}</span>
                                                <span>{formatAdminDate(request.createdAt)}</span>
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">No requests found for this account.</p>
                            )}
                        </section>

                        <section>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account controls</h3>
                            <p className="text-sm text-muted-foreground">
                                Use the full profile for entitlement overrides, access changes, enforcement, request history, and audited account actions.
                            </p>
                            <Link href={`/admin/users/${account.id}`} className="mt-3 inline-flex">
                                <Button size="sm">
                                    <User className="mr-1 h-4 w-4" />
                                    Open Account Controls
                                </Button>
                            </Link>
                        </section>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
