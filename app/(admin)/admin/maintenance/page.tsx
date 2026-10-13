import { MaintenanceControl } from '@/components/admin/MaintenanceControl';
import { AdminPageHeader } from '@/components/admin/primitives';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin';
import { formatAdminDateTime } from '@/lib/admin/date-format';
import { getMaintenanceStatus } from '@/lib/maintenance/config';
import { getMaintenanceHistory, readMaintenanceState, type MaintenanceHistoryEntry, type StoredMaintenanceState } from '@/lib/neon/queries/maintenance';

export const dynamic = 'force-dynamic';

const HISTORY_LABELS: Record<MaintenanceHistoryEntry['action'], string> = {
    maintenance_enabled: 'Turned on',
    maintenance_updated: 'Estimate changed',
    maintenance_disabled: 'Turned off',
};

/** Read directly, not through the short cache the public endpoints use. */
async function loadMaintenanceView() {
    let stored: StoredMaintenanceState | null = null;
    let history: MaintenanceHistoryEntry[] = [];
    let unreadable = false;
    try {
        [stored, history] = await Promise.all([readMaintenanceState(), getMaintenanceHistory(8)]);
    } catch {
        unreadable = true;
    }
    const now = Date.now();
    const switchOn = stored?.enabled === true;
    return {
        stored, history, unreadable, switchOn,
        forcedByEnvironment: getMaintenanceStatus(now).maintenance,
        estimate: switchOn && stored?.expectedBackAt && Date.parse(stored.expectedBackAt) > now ? stored.expectedBackAt : null,
    };
}

export default async function AdminMaintenancePage() {
    await requireAdmin();
    const { stored, history, unreadable, switchOn, forcedByEnvironment, estimate } = await loadMaintenanceView();
    const on = forcedByEnvironment || switchOn;

    const disabledReason = unreadable
        ? 'The maintenance switch could not be read just now. Reload the page to try again.'
        : stored === null
            ? 'The maintenance switch is not installed yet: migrations-maintenance-state.sql has not been applied to this database.'
            : process.env.ADMIN_WRITES_DISABLED === 'true'
                ? 'Admin writes are disabled (ADMIN_WRITES_DISABLED=true), so the switch is read-only.'
                : null;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Maintenance"
                description="Pause the seller form and sheet PDF downloads for a short while, with a clear message for the people affected."
            />

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-base">Maintenance mode</CardTitle>
                        <Badge variant={on ? 'destructive' : 'secondary'} data-testid="maintenance-status">{on ? 'On' : 'Off'}</Badge>
                    </div>
                    <CardDescription>
                        {on
                            ? switchOn
                                ? `On since ${formatAdminDateTime(stored?.enabledAt)}. ${estimate ? `People are told to expect us back around ${formatAdminDateTime(estimate)}.` : 'No estimate is being shown.'}`
                                : 'On because of the hosting setting, not this switch.'
                            : 'Everything is running normally.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {forcedByEnvironment && (
                        <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground" data-testid="maintenance-forced">
                            The <code>MAINTENANCE_MODE</code> setting in hosting is on for this deployment. It overrides this switch:
                            the pause stays on until that setting is turned off and the site is redeployed.
                        </p>
                    )}
                    <MaintenanceControl enabled={switchOn} disabledReason={disabledReason} />
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">What it does</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p><span className="font-medium text-foreground">Paused:</span> sending a seller form, provider suggestions and lookup, the seller&apos;s &quot;email me this link&quot;, and sheet PDF downloads.</p>
                        <p><span className="font-medium text-foreground">Still working:</span> sign-in, the dashboard, creating requests, reminders, viewing completed sheets on the web, billing and scheduled jobs.</p>
                        <p>New visitors to a seller link see a &quot;paused for maintenance&quot; screen. Sellers who already have the form open can keep answering and are told their answers were not sent yet. Their answers stay in their own browser; nothing is sent for them afterwards, they press Submit again.</p>
                        <p>A change here reaches the whole site within about 10 seconds. Customers see a banner in their dashboard while it is on.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent changes</CardTitle>
                        <CardDescription>Every change is also in the audit log.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {history.map((entry) => (
                                    <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
                                        <span className="font-medium text-foreground">{HISTORY_LABELS[entry.action]}</span>
                                        <span className="text-muted-foreground">{formatAdminDateTime(entry.createdAt)}{entry.adminEmail ? ` by ${entry.adminEmail}` : ''}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}