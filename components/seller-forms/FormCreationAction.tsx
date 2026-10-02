'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export function FormCreationAction({
    capabilities,
    duplicateId,
}: {
    capabilities: SellerFormCapabilities;
    duplicateId?: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const label = duplicateId ? 'Duplicate' : 'New form';
    return (
        <>
            <Button
                variant={duplicateId ? 'outline' : 'default'}
                onClick={() =>
                    capabilities.canCreate
                        ? router.push(
                              `/dashboard/forms/new${duplicateId ? `?duplicate=${duplicateId}` : ''}`,
                          )
                        : setOpen(true)
                }
            >
                {label}
                {capabilities.upgradeRequired && (
                    <Badge variant="secondary">Pro</Badge>
                )}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
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
        </>
    );
}
