'use client';

import { useEffect, useRef, useState } from 'react';

import { FeedbackDialog } from '@/components/feedback-dialog';
import { DeleteRequestDialog, type DeletableRequest } from '@/components/requests/DeleteRequestDialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const FIXTURE_REQUEST: DeletableRequest = {
    id: 'fixture-request',
    property_address: '1 Fixture Lane, Testville',
    status: 'sent',
    is_locked: false,
};

export function DialogFixtures() {
    const [deleteTarget, setDeleteTarget] = useState<DeletableRequest | null>(null);
    const [choice, setChoice] = useState('None');
    const mainRef = useRef<HTMLElement>(null);

    // Lets tests wait until event handlers are attached.
    useEffect(() => {
        mainRef.current?.setAttribute('data-hydrated', 'true');
    }, []);

    return (
        <main ref={mainRef} className="mx-auto max-w-xl space-y-4 p-6">
            <h1 className="text-lg font-semibold">Dialog keyboard fixtures</h1>
            <button type="button" className="rounded border px-3 py-2">Background before</button>

            <FeedbackDialog />

            <Button type="button" variant="outline" onClick={() => setDeleteTarget(FIXTURE_REQUEST)}>
                Delete fixture request
            </Button>
            <DeleteRequestDialog
                request={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onDeleted={() => setDeleteTarget(null)}
            />

            <Dialog>
                <DialogTrigger render={<Button type="button" variant="outline" />}>Open menu dialog</DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Choose a utility</DialogTitle>
                        <DialogDescription>Selected: {choice}</DialogDescription>
                    </DialogHeader>
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
                            Pick utility
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setChoice('Electric')}>Electric</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setChoice('Water')}>Water</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" />}>Done</DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <input aria-label="Background input" className="block rounded border px-3 py-2" />
            <a href="#background" className="underline">Background link</a>
        </main>
    );
}
