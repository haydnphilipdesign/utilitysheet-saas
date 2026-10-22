'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Loader2, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TEST_DRIVE_AREA_MAX_LENGTH } from '@/lib/test-drive/area';
import { cn } from '@/lib/utils';

type TestDriveAreaFormProps = {
    /**
     * `first`: the area is optional and the button starts the first test.
     * `another`: a "Try it in another area" button opens a field that starts a new test.
     */
    mode: 'first' | 'another';
    starting: boolean;
    error: string | null;
    onStart: (area: string) => void;
    onClearError: () => void;
    buttonVariant?: 'default' | 'outline';
    buttonClassName?: string;
    /** Extra actions shown beside the start button. */
    children?: ReactNode;
};

/**
 * Lets the user run the seller test in their own area so the provider
 * suggestions are ones they know. Only a city, state and ZIP are asked for:
 * the street stays fictional.
 */
export function TestDriveAreaForm({
    mode,
    starting,
    error,
    onStart,
    onClearError,
    buttonVariant = 'default',
    buttonClassName,
    children,
}: TestDriveAreaFormProps) {
    const inputId = useId();
    const hintId = useId();
    const errorId = useId();
    const [open, setOpen] = useState(mode === 'first');
    const [area, setArea] = useState('');

    if (!open) {
        return (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className={cn('w-fit', buttonClassName)}
            >
                <MapPin />
                Try it in another area
            </Button>
        );
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onStart(area);
    };

    const startLabel = mode === 'first' ? 'Start seller test' : 'Start new test';

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <div className="flex max-w-sm flex-col gap-1.5">
                <Label htmlFor={inputId} className="text-sm text-foreground">
                    {mode === 'first' ? 'Your area (optional)' : 'City and state'}
                </Label>
                <Input
                    id={inputId}
                    name="area"
                    value={area}
                    onChange={(event) => {
                        setArea(event.target.value);
                        if (error) onClearError();
                    }}
                    placeholder="e.g. Austin, TX 78704"
                    autoComplete="off"
                    maxLength={TEST_DRIVE_AREA_MAX_LENGTH}
                    required={mode === 'another'}
                    disabled={starting}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${errorId} ${hintId}` : hintId}
                />
                {error ? (
                    <p id={errorId} role="alert" className="text-xs text-destructive">
                        {error}
                    </p>
                ) : null}
                <p id={hintId} className="text-xs text-muted-foreground">
                    {mode === 'first'
                        ? 'Your seller sees the utility providers suggested there. The street stays made up. Leave it blank to use a sample town.'
                        : 'Starts a new test there. The street stays made up.'}
                </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                    type="submit"
                    size="sm"
                    variant={buttonVariant}
                    disabled={starting || (mode === 'another' && !area.trim())}
                    className={buttonClassName}
                >
                    {starting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    {starting ? 'Starting your test…' : startLabel}
                </Button>
                {mode === 'another' ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setOpen(false);
                            setArea('');
                            onClearError();
                        }}
                        disabled={starting}
                        className={buttonClassName}
                    >
                        Cancel
                    </Button>
                ) : null}
                {children}
            </div>
        </form>
    );
}
