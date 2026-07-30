'use client';

import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_METADATA,
    getAdvancedModuleIncludedFieldCount,
} from '@/lib/packet/modules';
import type { AdvancedModuleFieldMeta } from '@/lib/packet/modules';
import type { AdvancedModuleExclusions, AdvancedModuleKey } from '@/types';

interface AdvancedModuleConfiguratorProps {
    enabledModules: AdvancedModuleKey[];
    exclusions: AdvancedModuleExclusions;
    onToggleModule: (moduleKey: AdvancedModuleKey) => void;
    onToggleField: (moduleKey: AdvancedModuleKey, fieldKey: string) => void;
    disabled?: boolean;
    className?: string;
}

interface AdvancedModuleFieldGroup {
    key: string;
    label?: string;
    fields: AdvancedModuleFieldMeta[];
}

function groupModuleFields(fields: AdvancedModuleFieldMeta[]): AdvancedModuleFieldGroup[] {
    const groups: AdvancedModuleFieldGroup[] = [];
    const groupedIndexes = new Map<string, number>();

    for (const field of fields) {
        const groupLabel = field.groupLabel?.trim();
        if (!groupLabel) {
            groups.push({
                key: `field-${field.key}`,
                fields: [field],
            });
            continue;
        }

        const existingIndex = groupedIndexes.get(groupLabel);
        if (existingIndex === undefined) {
            groupedIndexes.set(groupLabel, groups.length);
            groups.push({
                key: `group-${groupLabel.toLowerCase().replace(/\s+/g, '-')}`,
                label: groupLabel,
                fields: [field],
            });
            continue;
        }

        groups[existingIndex].fields.push(field);
    }

    return groups;
}

export function AdvancedModuleConfigurator({
    enabledModules,
    exclusions,
    onToggleModule,
    onToggleField,
    disabled = false,
    className,
}: AdvancedModuleConfiguratorProps) {
    return (
        <div className={cn('space-y-3', className)}>
            {ADVANCED_MODULE_KEYS.map((moduleKey) => {
                const moduleMeta = ADVANCED_MODULE_METADATA[moduleKey];
                const moduleEnabled = enabledModules.includes(moduleKey);
                const includedCount = getAdvancedModuleIncludedFieldCount(moduleKey, exclusions);
                const totalFields = moduleMeta.fields.length;
                const excludedSet = new Set(exclusions[moduleKey] || []);
                const fieldGroups = groupModuleFields(moduleMeta.fields);

                return (
                    <div
                        key={moduleKey}
                        className={cn(
                            'rounded-xl border p-3 sm:p-4 space-y-3',
                            moduleEnabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-background/20'
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">{moduleMeta.label}</p>
                                <p className="text-xs text-muted-foreground">{moduleMeta.summary}</p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant={moduleEnabled ? 'default' : 'outline'}
                                className={moduleEnabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-input'}
                                onClick={() => onToggleModule(moduleKey)}
                                disabled={disabled}
                                title={`Toggle ${moduleMeta.label}`}
                                aria-label={`Toggle ${moduleMeta.label}`}
                                data-testid={`module-toggle-${moduleKey}`}
                            >
                                {moduleEnabled ? 'Enabled' : 'Disabled'}
                            </Button>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                                <span className="text-foreground font-medium">Seller will be asked:</span> {moduleMeta.sellerAsks}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                <span className="text-foreground font-medium">Packet output:</span> {moduleMeta.outputImpact}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {includedCount} of {totalFields} questions included
                            </p>
                        </div>

                        <details className="group rounded-lg border border-border bg-background/40" open={moduleEnabled}>
                            <summary className="list-none cursor-pointer px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                                <span>Customize questions — include or remove each one</span>
                                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="space-y-2 px-2 pb-2">
                                {fieldGroups.map((fieldGroup) => (
                                    <div key={fieldGroup.key} className={cn(fieldGroup.label ? 'rounded-md border border-border/60 bg-background/40 p-2 space-y-2' : 'space-y-2')}>
                                        {fieldGroup.label && (
                                            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{fieldGroup.label}</p>
                                        )}
                                        {fieldGroup.fields.map((field) => {
                                            const fieldExcluded = excludedSet.has(field.key);
                                            const fieldIncluded = !fieldExcluded;
                                            const rowDisabled = disabled || !moduleEnabled;
                                            return (
                                                <button
                                                    key={field.key}
                                                    type="button"
                                                    disabled={rowDisabled}
                                                    aria-pressed={fieldIncluded}
                                                    data-testid={`module-field-toggle-${moduleKey}-${field.key}`}
                                                    onClick={() => onToggleField(moduleKey, field.key)}
                                                    className={cn(
                                                        'w-full rounded-md border px-2.5 py-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                                                        fieldIncluded
                                                            ? 'border-emerald-500/35 bg-emerald-500/10'
                                                            : 'border-border bg-background/30 hover:border-input'
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium text-foreground">{field.label}</p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{field.sellerPrompt}</p>
                                                            {field.example && (
                                                                <p className="text-[11px] text-muted-foreground mt-0.5">Example: {field.example}</p>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                                                            {fieldIncluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                                            {fieldIncluded ? 'Included' : 'Excluded'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </details>

                        {moduleEnabled && includedCount === 0 && (
                            <p className="text-xs text-amber-500">
                                Include at least one question or disable this module before saving.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
