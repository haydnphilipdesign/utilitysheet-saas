'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import type { SavedSellerForm, SellerFormsResponse } from './types';
export function FormShareSelector({
    onSelect,
}: {
    onSelect: (form: SavedSellerForm) => void;
}) {
    const [forms, setForms] = useState<SavedSellerForm[]>([]);
    const [selected, setSelected] = useState('');
    useEffect(() => {
        let canceled = false;
        void fetch('/api/seller-forms')
            .then(async (res) => {
                if (!res.ok) return;
                const data: SellerFormsResponse = await res.json();
                if (canceled) return;
                setForms(data.forms);
                const form = data.forms.find((f) => f.id === data.defaultId);
                if (form) {
                    setSelected(form.id);
                    onSelect(form);
                }
            })
            .catch(() => {});
        return () => {
            canceled = true;
        };
    }, [onSelect]);
    const form = forms.find((f) => f.id === selected);
    return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
            {forms.length > 1 && (
                <>
                    <Label htmlFor="shareForm">Form to share</Label>
                    <select
                        id="shareForm"
                        className="max-w-full rounded-md border border-input bg-background p-2"
                        value={selected}
                        onChange={(e) => {
                            setSelected(e.target.value);
                            const next = forms.find(
                                (f) => f.id === e.target.value,
                            );
                            if (next) onSelect(next);
                        }}
                    >
                        {forms.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.name}
                                {f.isDefault ? ' (default)' : ''}
                                {!f.isMine ? ' (shared by your team)' : ''}
                                {!f.isActive ? ' (paused)' : ''}
                            </option>
                        ))}
                    </select>
                </>
            )}
            <Link
                href="/dashboard/forms"
                className="text-primary underline underline-offset-4"
            >
                Manage forms
            </Link>
            {form && !form.isActive && (
                <p role="status" className="w-full text-muted-foreground">
                    This form is paused. Resume it in Manage forms to share it.
                </p>
            )}
        </div>
    );
}
