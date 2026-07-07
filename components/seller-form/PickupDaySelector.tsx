'use client';

import { Check } from 'lucide-react';
import type { TrashPickupDay } from '@/types';

export type PickupDaySpecial = 'not_sure' | 'varies';

export const PICKUP_WEEKDAYS: Array<{ value: TrashPickupDay; label: string; short: string }> = [
    { value: 'mon', label: 'Monday', short: 'Mon' },
    { value: 'tue', label: 'Tuesday', short: 'Tue' },
    { value: 'wed', label: 'Wednesday', short: 'Wed' },
    { value: 'thu', label: 'Thursday', short: 'Thu' },
    { value: 'fri', label: 'Friday', short: 'Fri' },
    { value: 'sat', label: 'Saturday', short: 'Sat' },
    { value: 'sun', label: 'Sunday', short: 'Sun' },
];

const SPECIAL_OPTIONS: Array<{ value: PickupDaySpecial; label: string }> = [
    { value: 'not_sure', label: 'Not sure' },
    { value: 'varies', label: 'Varies' },
];

interface PickupDaySelectorProps {
    /** Selected weekday values. Empty when a special state is active. */
    days: TrashPickupDay[];
    /** Exclusive "Not sure" / "Varies" state. Null when weekdays are selected. */
    special: PickupDaySpecial | null;
    onChange: (next: { days: TrashPickupDay[]; special: PickupDaySpecial | null }) => void;
    /**
     * Prefix for element ids and test ids. Day inputs get
     * `${idPrefix}-day-${value}`; special buttons get `${idPrefix}-${value}`.
     */
    idPrefix: string;
    /** 'multi' allows several weekdays (default); 'single' replaces the selection. */
    mode?: 'single' | 'multi';
    disabled?: boolean;
}

const CHIP_BASE =
    'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs sm:text-sm font-medium transition-all select-none cursor-pointer active:scale-[0.97]';
const CHIP_SELECTED =
    'bg-[color:var(--brand-accent)] text-white border-[color:var(--brand-accent)]';
const CHIP_UNSELECTED =
    'bg-muted/50 border-border text-muted-foreground hover:border-ring hover:text-foreground';
const CHIP_FOCUS =
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--brand-accent)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background';
const BUTTON_FOCUS =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Shared pickup-day control for trash and recycling. Weekdays render as
 * checkbox chips (multi-select by default); "Not sure" and "Varies" are
 * mutually exclusive with any weekday selection so the agent never receives
 * contradictory data like "Monday + Not sure".
 */
export function PickupDaySelector({
    days,
    special,
    onChange,
    idPrefix,
    mode = 'multi',
    disabled = false,
}: PickupDaySelectorProps) {
    const weekdayOrder = (day: TrashPickupDay) => PICKUP_WEEKDAYS.findIndex((option) => option.value === day);

    const toggleDay = (day: TrashPickupDay, checked: boolean) => {
        if (disabled) return;
        if (mode === 'single') {
            onChange({ days: checked ? [day] : [], special: null });
            return;
        }
        const nextDays = (checked
            ? [...days.filter((selected) => selected !== day), day]
            : days.filter((selected) => selected !== day)
        ).sort((a, b) => weekdayOrder(a) - weekdayOrder(b));
        onChange({ days: nextDays, special: null });
    };

    const toggleSpecial = (value: PickupDaySpecial) => {
        if (disabled) return;
        onChange({ days: [], special: special === value ? null : value });
    };

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2" data-testid={`${idPrefix}-days`}>
                {PICKUP_WEEKDAYS.map((option) => {
                    const inputId = `${idPrefix}-day-${option.value}`;
                    const isChecked = days.includes(option.value);
                    return (
                        <label
                            key={option.value}
                            htmlFor={inputId}
                            className={`${CHIP_BASE} ${CHIP_FOCUS} ${isChecked ? CHIP_SELECTED : CHIP_UNSELECTED} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <input
                                id={inputId}
                                type="checkbox"
                                className="sr-only"
                                checked={isChecked}
                                disabled={disabled}
                                onChange={(e) => toggleDay(option.value, e.target.checked)}
                                data-testid={inputId}
                                aria-label={option.label}
                            />
                            {isChecked && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                            <span aria-hidden="true">{option.short}</span>
                        </label>
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {SPECIAL_OPTIONS.map((option) => {
                    const isSelected = special === option.value && days.length === 0;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={isSelected}
                            disabled={disabled}
                            onClick={() => toggleSpecial(option.value)}
                            data-testid={`${idPrefix}-${option.value}`}
                            className={`${CHIP_BASE} ${BUTTON_FOCUS} px-3 ${isSelected ? CHIP_SELECTED : CHIP_UNSELECTED} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
