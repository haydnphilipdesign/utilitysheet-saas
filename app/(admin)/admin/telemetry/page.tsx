import Link from 'next/link';
import { UsageTelemetryReport } from '@/components/admin/UsageTelemetryReport';
import { AdminAuthorizationError } from '@/lib/admin';
import { getAdminTelemetry, telemetryDays } from '@/lib/neon/queries/admin-telemetry';
import { AdminPageHeader, AdminStatStrip } from '@/components/admin/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function AdminTelemetryPage({ searchParams }: {
    searchParams: Promise<{ days?: string | string[] }>;
}) {
    const days = telemetryDays((await searchParams).days);
    let data;
    try {
        data = await getAdminTelemetry(days);
    } catch (error) {
        if (error instanceof AdminAuthorizationError) throw error;
        return <div role="alert" className="p-6">Telemetry is temporarily unavailable. Reload to try again.</div>;
    }
    if (!data) return <div role="status" className="p-6">Database not configured. Telemetry is unavailable.</div>;
    const f = data.forms;
    const count = (n: number) => n.toLocaleString();
    const adoption = f.formAccounts ? `${Math.round(100 * f.multiFormAccounts / f.formAccounts)}%` : '—';
    const completion = f.attributedRequests ? `${Math.round(100 * f.completedRequests / f.attributedRequests)}%` : '—';

    return <div className="space-y-6">
        <AdminPageHeader title="Telemetry" description="Saved seller form adoption and recorded product activity." />
        <nav aria-label="Telemetry period" className="flex flex-wrap gap-2">
            {[7, 30, 90].map((period) => <Link key={period} href={`/admin/telemetry?days=${period}`}
                aria-current={days === period ? 'page' : undefined}
                className={`rounded-md border px-4 py-2 text-sm ${days === period ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary'}`}>
                Last {period} days
            </Link>)}
        </nav>
        <section aria-labelledby="inventory-heading" className="space-y-3">
            <h2 id="inventory-heading" className="text-lg font-semibold">Saved forms · current inventory</h2>
            <p className="text-sm text-muted-foreground">Customer accounts only. Counts include automatically provisioned and paused forms; this is today’s inventory, independent of the selected period.</p>
            <AdminStatStrip stats={[
                { label: 'Accounts with forms', value: count(f.formAccounts), hint: `Of ${count(f.accounts)} customer accounts` },
                { label: 'Multiple-form accounts', value: count(f.multiFormAccounts), hint: `${adoption} of accounts with forms; at least two in the same workspace` },
                { label: 'Saved forms', value: count(f.forms), hint: 'All customer-owned forms' },
                { label: 'Active forms', value: count(f.activeForms), hint: `${count(f.forms - f.activeForms)} paused` },
            ]} />
        </section>
        <section aria-labelledby="usage-heading" className="space-y-3">
            <h2 id="usage-heading" className="text-lg font-semibold">Actual use · requests created in the last {days} days</h2>
            <p className="text-sm text-muted-foreground">Excludes demo and deleted requests. Completion reflects the current outcome of this request cohort, not submissions received during the period.</p>
            <AdminStatStrip stats={[
                { label: 'Using multiple forms', value: count(f.multiFormUsers), hint: 'Accounts with requests from at least two distinct forms in one workspace' },
                { label: 'Forms used', value: count(f.usedForms), hint: 'Distinct forms with a real request in this cohort' },
                { label: 'Form-based requests', value: count(f.attributedRequests), hint: `Of ${count(f.requests)} real requests created` },
                { label: 'Completed form requests', value: count(f.completedRequests), hint: `${completion} of form-based requests; first submission recorded` },
            ]} />
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                {count(f.requests - f.attributedRequests)} requests have no saved-form attribution. Older requests and manual API requests may lack it; they are not assigned to a form retroactively.
                {' '}This report measures saved configurations and real use. Create, duplicate, preview and copy-link action history is not collected here.
            </p>
        </section>
        <UsageTelemetryReport data={data.usage} days={days} />
        <Card>
            <CardHeader><CardTitle>Request events</CardTitle><CardDescription>Top 50 recorded event types in the last {days} days, across non-demo, non-deleted customer requests. Event counts can include repeat actions.</CardDescription></CardHeader>
            <CardContent>{data.events.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <caption className="sr-only">Request event counts for the selected period</caption>
                <thead><tr className="border-b"><th scope="col" className="p-2">Event</th><th scope="col" className="p-2 text-right">Events</th><th scope="col" className="p-2 text-right">Distinct requests</th></tr></thead>
                <tbody>{data.events.map((e) => <tr key={e.event} className="border-b"><th scope="row" className="break-all p-2 font-normal">{e.event}</th><td className="p-2 text-right tabular-nums">{count(e.count)}</td><td className="p-2 text-right tabular-nums">{count(e.requests)}</td></tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No request events recorded in this period.</p>}</CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>AI suggestions and search</CardTitle><CardDescription>Recorded runs in the last {days} days linked to non-demo, non-deleted customer requests. Unlinked runs are excluded. Fresh latency excludes cache hits.</CardDescription></CardHeader>
            <CardContent>{data.ai.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <caption className="sr-only">AI telemetry by feature and outcome</caption>
                <thead><tr className="border-b">{['Feature', 'Outcome', 'Runs', 'Cache hits', 'Average fresh latency'].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
                <tbody>{data.ai.map((g) => <tr key={`${g.feature}-${g.status}`} className="border-b"><th scope="row" className="p-2 font-normal">{g.feature === 'provider_search' ? 'Provider search' : 'Provider suggestions'}</th><td className="p-2">{g.status.replaceAll('_', ' ')}</td><td className="p-2 tabular-nums">{count(g.runs)}</td><td className="p-2 tabular-nums">{count(g.cached)}</td><td className="p-2 tabular-nums">{g.freshLatencyMs == null ? '—' : `${count(g.freshLatencyMs)} ms`}</td></tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No AI runs recorded in this period.</p>}</CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">Aggregates only; no seller answers or raw telemetry payloads are displayed. Browser events sent to Vercel Analytics are separate and are not included. See <Link href="/admin/growth" className="underline">Growth</Link> for acquisition and activation, or <Link href="/admin/abandonment" className="underline">Seller Progress</Link> for completion steps.</p>
    </div>;
}
