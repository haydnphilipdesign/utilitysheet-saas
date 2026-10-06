'use client';

import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { Request } from '@/types';

type ReopenRequestDialogProps = {
    request: Pick<Request, 'id' | 'property_address' | 'seller_email'> | null;
    onClose: () => void;
    onReopened: (request: Request) => void;
};

export function ReopenRequestDialog({ request, onClose, onReopened }: ReopenRequestDialogProps) {
    const [working, setWorking] = useState(false);

    const handleReopen = async () => {
        if (!request) return;
        setWorking(true);
        try {
            const response = await fetch(`/api/requests/${request.id}/reopen`, { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Failed to reopen request');
            }
            toast.success('Reopened. Send the seller their link when you are ready.');
            onReopened(data as Request);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to reopen request');
        } finally {
            setWorking(false);
        }
    };

    return (
        <Dialog open={request !== null} onOpenChange={(open) => { if (!open && !working) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reopen this request for the seller?</DialogTitle>
                    <DialogDescription>
                        {request ? `${request.property_address}. ` : ''}
                        The seller can correct their answers and submit again.
                    </DialogDescription>
                </DialogHeader>
                <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                    <li>The seller link becomes editable again and starts from the current info sheet, including any edits you made.</li>
                    <li>The info sheet link and PDF are unavailable until the seller submits again, or until you close the request without changes.</li>
                    <li>The seller&apos;s next submission replaces the info sheet.</li>
                    <li>This does not use another submission from your monthly limit.</li>
                    <li>
                        No email is sent. Share the seller link yourself
                        {request?.seller_email ? ', or use Send Reminder afterwards.' : '.'}
                    </li>
                </ul>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={working}>
                        Cancel
                    </Button>
                    <Button onClick={handleReopen} disabled={working}>
                        {working ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        {working ? 'Reopening…' : 'Reopen for Seller'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
