'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/**
 * Shared yes/no confirmation. Use this instead of `window.confirm` so a
 * confirmation looks and behaves like every other dialog in the product.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancel',
    onConfirm,
    busy = false,
    destructive = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    busy?: boolean;
    destructive?: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={(next) => { if (next || !busy) onOpenChange(next); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={busy}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
