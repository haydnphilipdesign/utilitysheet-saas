'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
    const [expandedModule, setExpandedModule] = useState<AdvancedModuleKey | null>(null);

    return (
        <div className={cn('space-y-3', className)}>
            {ADVANCED_MODULE_KEYS.map((moduleKey) => {
                const moduleMeta = ADVANCED_MODULE_METADATA[moduleKey];
                const moduleEnabled = enabledModules.includes(moduleKey);
                const includedCount = getAdvancedModuleIncludedFieldCount(moduleKey, exclusions);
                const totalFields = moduleMeta.fields.length;
                const excludedSet = new Set(exclusions[moduleKey] || []);
                const fieldGroups = groupModuleFields(moduleMeta.fields);
                const modulePanelId = `advanced-module-panel-${moduleKey}`;

                const handleModuleToggle = (nextEnabled: boolean) => {
                    onToggleModule(moduleKey);
                    setExpandedModule(nextEnabled ? moduleKey : (current) => (
                        current === moduleKey ? null : current
                    ));
                };

                return (
                    <div
                        key={moduleKey}
                        className={cn(
                            'overflow-hidden rounded-xl border transition-colors',
                            moduleEnabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-background/20'
                        )}
                    >
                        <div className="flex items-center gap-3 p-3 sm:p-4">
                            <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                                onClick={() => moduleEnabled && setExpandedModule((current) => (
                                    current === moduleKey ? null : moduleKey
                                ))}
                                disabled={disabled || !moduleEnabled}
                                aria-expanded={expandedModule === moduleKey}
                                aria-controls={modulePanelId}
                            >
                                <ChevronDown
                                    className={cn(
                                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                        expandedModule === moduleKey && 'rotate-180'
                                    )}
                                />
                                <span className="min-w-0 flex-1 space-y-1">
                                    <span className="block text-sm font-semibold text-foreground">{moduleMeta.label}</span>
                                    <span className="block text-xs leading-relaxed text-muted-foreground">{moduleMeta.summary}</span>
                                    <span className="block text-xs font-medium text-foreground/80">
                                        {includedCount} of {totalFields} questions included
                                    </span>
                                </span>
                            </button>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                                    {moduleEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <Switch
                                    checked={moduleEnabled}
                                    onCheckedChange={handleModuleToggle}
                                    disabled={disabled}
                                    aria-label={`${moduleEnabled ? 'Disable' : 'Enable'} ${moduleMeta.label}`}
                                    data-testid={`module-toggle-${moduleKey}`}
                                />
                            </div>
                        </div>

                        {moduleEnabled && expandedModule === moduleKey && (
                            <div
                                id={modulePanelId}
                                className="space-y-3 border-t border-border/70 bg-background/45 p-3 sm:p-4"
                            >
                                <p className="text-sm text-muted-foreground">
                                    Choose the questions sellers will see.
                                </p>
                                {fieldGroups.map((fieldGroup) => (
                                    <div key={fieldGroup.key} className={cn(fieldGroup.label && 'space-y-1')}>
                                        {fieldGroup.label && (
                                            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                {fieldGroup.label}
                                            </p>
                                        )}
                                        {fieldGroup.fields.map((field) => {
                                            const fieldExcluded = excludedSet.has(field.key);
                                            const fieldIncluded = !fieldExcluded;
                                            return (
                                                <label
                                                    key={field.key}
                                                    data-testid={`module-field-toggle-${moduleKey}-${field.key}`}
                                                    className={cn(
                                                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
                                                        fieldIncluded
                                                            ? 'border-emerald-500/30 bg-emerald-500/8'
                                                            : 'border-border bg-background/30 hover:border-input',
                                                        disabled && 'cursor-not-allowed opacity-60'
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={fieldIncluded}
                                                        onCheckedChange={() => onToggleField(moduleKey, field.key)}
                                                        disabled={disabled}
                                                        aria-label={`Include ${field.label}`}
                                                        className="mt-0.5"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-medium text-foreground">{field.label}</span>
                                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                                            {field.sellerPrompt}
                                                        </span>
                                                        {field.example && (
                                                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground/90">
                                                                Example: {field.example}
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}

                        {moduleEnabled && includedCount === 0 && (
                            <p className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-300">
                                Include at least one question or disable this module before saving.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
