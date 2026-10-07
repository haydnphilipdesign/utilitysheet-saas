'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type { SellerFormCapabilities } from '@/lib/seller-forms/capabilities';

/** Explains why another form cannot be created right now. */
export function FormLimitDialog({
    capabilities,
    open,
    onOpenChange,
}: {
    capabilities: SellerFormCapabilities;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {capabilities.upgradeRequired
                            ? 'Save more workflows with Pro'
                            : 'Additional forms unavailable'}
                    </DialogTitle>
                    <DialogDescription>
                        {capabilities.message}
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    You can keep customizing, previewing and sharing
                    existing forms. Paused forms count toward your
                    allowance.
                </p>
                {capabilities.upgradeRequired &&
                    !capabilities.pilotAvailable && (
                        <p className="text-sm text-muted-foreground">
                            Additional forms are temporarily unavailable.
                        </p>
                    )}
                {capabilities.upgradeRequired && (
                    <Link
                        className="text-primary underline"
                        href="/dashboard/settings?tab=billing"
                    >
                        View Pro upgrade
                    </Link>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Where a new (or duplicated) form's unsaved draft opens. */
export function newFormHref(duplicateId?: string) {
    return `/dashboard/forms/new${duplicateId ? `?duplicate=${duplicateId}` : ''}`;
}

export function FormCreationAction({
    capabilities,
}: {
    capabilities: SellerFormCapabilities;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button
                onClick={() =>
                    capabilities.canCreate
                        ? router.push(newFormHref())
                        : setOpen(true)
                }
            >
                <Plus />
                New form
                {capabilities.upgradeRequired && (
                    <Badge variant="secondary">Pro</Badge>
                )}
            </Button>
            <FormLimitDialog capabilities={capabilities} open={open} onOpenChange={setOpen} />
        </>
    );
}
