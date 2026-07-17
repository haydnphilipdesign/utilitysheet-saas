'use client';

import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';

type AdminActionReasonFieldProps = {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    label?: string;
    placeholder?: string;
};

export function AdminActionReasonField({
    value,
    onChange,
    disabled = false,
    label = 'Admin reason',
    placeholder = 'Explain why this action is needed...',
}: AdminActionReasonFieldProps) {
    const id = useId();
    const descriptionId = `${id}-description`;

    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium text-foreground">
                {label} <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                aria-describedby={descriptionId}
                className="min-h-20"
            />
            <p id={descriptionId} className="text-xs text-muted-foreground">
                Required, at least 3 characters. This reason is stored in the Admin audit log.
            </p>
        </div>
    );
}

