'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
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

export type DeletableRequest = Pick<Request, 'id' | 'property_address' | 'status' | 'is_locked'>;

type DeleteRequestDialogProps = {
    request: DeletableRequest | null;
    onClose: () => void;
    onDeleted: (request: DeletableRequest) => void;
};

function consequences(request: DeletableRequest): string[] {
    if (request.is_locked) {
        return ['The locked submission and the seller’s answers will be removed.'];
    }
    if (request.status === 'submitted') {
        return [
            'The seller link and packet link will stop working.',
            'On the Free plan, this submission still counts toward this month’s limit.',
        ];
    }
    return [
        'The seller link will stop working, so the seller can no longer respond.',
        'Requests only count toward the Free plan limit once a seller submits, so this one never counted.',
    ];
}

export function DeleteRequestDialog({ request, onClose, onDeleted }: DeleteRequestDialogProps) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!request) return;
        setDeleting(true);
        try {
            const response = await fetch(`/api/requests/${request.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete request');
            }
            toast.success('Request deleted');
            onDeleted(request);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete request');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={request !== null} onOpenChange={(open) => { if (!open && !deleting) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete this request?</DialogTitle>
                    <DialogDescription>
                        {request && !request.is_locked ? `${request.property_address}. ` : ''}
                        This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                {request ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                        {consequences(request).map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                ) : null}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        {deleting ? 'Deleting…' : 'Delete request'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
