'use client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useId } from 'react';
export function QuestionCollectionSwitches({
    hoa,
    meter,
    onHoa,
    onMeter,
    disabled = false,
}: {
    hoa: boolean;
    meter: boolean;
    onHoa: (value: boolean) => void;
    onMeter: (value: boolean) => void;
    disabled?: boolean;
}) {
    const id = useId();
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <Label htmlFor={`${id}-hoa`}>
                    Ask about HOA or condo association
                </Label>
                <Switch
                    id={`${id}-hoa`}
                    aria-label="Ask about HOA or condo association"
                    checked={hoa}
                    onCheckedChange={onHoa}
                    disabled={disabled}
                />
            </div>
            <div className="flex items-center justify-between gap-4">
                <Label htmlFor={`${id}-meter`}>
                    Collect electric meter number
                </Label>
                <Switch
                    id={`${id}-meter`}
                    aria-label="Collect electric meter number"
                    checked={meter}
                    onCheckedChange={onMeter}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}
