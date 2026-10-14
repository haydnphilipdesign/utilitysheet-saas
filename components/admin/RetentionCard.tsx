import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAdminDate } from '@/lib/admin/date-format';
import type { SectionState } from '@/lib/ops/overview';
import type { RetentionAction, RetentionMode, RetentionPlanItem, RetentionStatus } from '@/lib/telemetry/retention';

const MODE_TEXT: Record<RetentionMode, string> = {
    off: 'Off. Nothing is counted or deleted (except operational incidents and job runs if their own switch is on).',
    preview: 'Preview. The daily run counts what each rule would affect and changes nothing.',
    enforce: 'On. The daily run deletes or clears up to 2,000 rows per rule, oldest first.',
};

const ACTION_TEXT: Record<RetentionAction, string> = { skip: 'off', preview: 'preview', enforce: 'on' };

function windowText(item: RetentionPlanItem): string {
    if (item.windowDays === null) return 'any age (one-time cleanup)';
    return `older than ${item.windowDays} days`;
}

function lastRunText(item: RetentionPlanItem, summary: Record<string, number>): string {
    const affected = summary[item.key];
    if (affected === undefined) return 'not in the last run';
    const action = summary[`${item.key}Action`] === 2 ? 'enforce' : 'preview';
    const verb = item.kind === 'delete'
        ? (action === 'enforce' ? 'deleted' : 'would delete')
        : (action === 'enforce' ? 'cleared' : 'would clear');
    return `last run ${verb} ${affected.toLocaleString('en-US')}`;
}

/** Admin Operations: retention configuration and the last recorded daily run. */
export function RetentionCard({ state }: { state: SectionState<RetentionStatus> }) {
    return (
        <Card className="border-border/70 bg-card shadow-sm xl:col-span-2">
            <CardHeader>
                <CardTitle className="text-base">Retention</CardTitle>
                <CardDescription>
                    Old telemetry is removed by rule. Lifecycle events, reminder records, audit logs, billing and outreach records are never removed by it.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                {state.status === 'ok' ? (
                    <>
                        <p>{MODE_TEXT[state.data.mode]}</p>
                        <p className="text-xs text-muted-foreground">
                            {state.data.lastRun
                                ? `Last run ${formatAdminDate(state.data.lastRun.startedAt)}, ${state.data.lastRun.status}.`
                                : 'No run recorded yet.'}
                        </p>
                        <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                            {state.data.plan.map((item) => (
                                <li key={item.key}>
                                    <div className="font-medium">{item.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {item.kind === 'delete' ? 'Delete' : 'Clear'} {windowText(item)}{' · '}{ACTION_TEXT[item.action]}
                                        {state.data.lastRun ? ` · ${lastRunText(item, state.data.lastRun.summary)}` : ''}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
                        Retention status could not be loaded just now. Refresh to try again.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
