import Link from 'next/link';
import { UsageTelemetryReport } from '@/components/admin/UsageTelemetryReport';
import { AdminAuthorizationError } from '@/lib/admin';
import { getAdminTelemetry, telemetryDays } from '@/lib/neon/queries/admin-telemetry';
import { AdminPageHeader, AdminStatStrip } from '@/components/admin/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const AI_FEATURE_LABELS: Record<string, string> = {
    provider_suggestions: 'Provider suggestions',
    provider_search: 'Provider search',
    provider_contact: 'Contact lookup',
};
const AI_SERVED_LABELS: Record<string, string> = {
    ai_primary: 'Fresh AI result, first pass',
    ai_verify: 'Fresh AI result, verified',
    ai_recovery: 'Fresh AI result, recovery pass',
    history_blend: 'Fresh AI result with workspace history',
    unrecorded: 'No recorded suggestion result',
    cache: 'Cached result',
    fallback: 'Generic national list',
};

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
    const aiUsage = data.aiUsage ?? [];
    const aiAcceptance = data.aiAcceptance ?? [];
    const duration = (n: number | null) => n == null ? 'Unknown' : `${Math.round(n).toLocaleString()} ms`;
    const usageCount = (n: number | null) => n == null ? 'Unknown' : n.toLocaleString();
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
            <p className="text-sm text-muted-foreground">Excludes demo and deleted requests. Completion reflects a recorded first submission of this retained request cohort, not submissions received during the period.</p>
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
            <CardHeader><CardTitle>AI suggestions, search and contact lookups</CardTitle><CardDescription>Recorded runs in the last {days} days linked to non-demo, non-deleted customer requests. Unlinked runs are excluded. Fresh latency excludes cache hits and missing/negative timings, grouped by feature, outcome, model and prompt. It measures pipeline work, excluding telemetry persistence and full HTTP/browser time; transport retries are included in time. A contact lookup that found nothing counts as a success.</CardDescription></CardHeader>
            <CardContent>{data.ai.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <caption className="sr-only">AI telemetry by feature and outcome</caption>
                <thead><tr className="border-b">{['Feature', 'Outcome', 'Model / prompt', 'Runs', 'Cache hits', 'Fresh timed samples', 'Average fresh latency', 'Fresh p50', 'Fresh p95'].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
                <tbody>{data.ai.map((g) => <tr key={`${g.feature}-${g.status}-${g.model}-${g.promptVersion}`} className="border-b"><th scope="row" className="p-2 font-normal">{AI_FEATURE_LABELS[g.feature] ?? g.feature}</th><td className="p-2">{g.status.replaceAll('_', ' ')}</td><td className="p-2">{g.model ?? 'Unknown model'} / {g.promptVersion ?? 'Unknown prompt'}</td><td className="p-2 tabular-nums">{count(g.runs)}</td><td className="p-2 tabular-nums">{count(g.cached)}</td><td className="p-2">{count(g.freshSamples)}</td>{[g.freshLatencyMs, g.freshP50Ms, g.freshP95Ms].map((n, i) => <td key={i} className="p-2 tabular-nums">{duration(n)}</td>)}</tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No AI runs recorded in this period.</p>}</CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>AI usage</CardTitle><CardDescription>All recorded fresh runs, including demo, admin and unlinked runs. Each token total shows its reporting sample count; missing usage is unknown. Passes exclude transport retries. Failure columns count runs with a first recorded failure, including runs that recovered. Reported searches are metadata totals, not billed searches. Search coverage is explicit; historical zero rows may reflect missing metadata and cannot be reclassified. Failed calls can still be billed; totals are lower bounds.</CardDescription></CardHeader>
            <CardContent>{aiUsage.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <caption className="sr-only">AI usage by feature for the selected period</caption>
                <thead><tr className="border-b">{['Feature', 'Fresh runs', 'With token metadata', 'AI passes', 'Reported searches', 'Runs with search metadata', 'Reported zero / legacy unknown runs', 'Prompt tokens (runs)', 'Search result tokens (runs)', 'Thinking tokens (runs)', 'Output tokens (runs)', 'Runs with timeout', 'Runs with other failure'].map((label, index) => <th key={label} scope="col" className={`p-2 ${index ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
                <tbody>{aiUsage.map((g) => <tr key={g.feature} className="border-b"><th scope="row" className="p-2 font-normal">{AI_FEATURE_LABELS[g.feature] ?? g.feature}</th>{[g.freshRuns, g.measuredRuns, g.passes, g.searchQueries, g.searchMeasuredRuns, g.searchZeroRuns].map((value, i) => <td key={i} className="p-2 text-right tabular-nums">{usageCount(value)}</td>)}{[[g.promptTokens, g.promptMeasuredRuns], [g.toolPromptTokens, g.toolPromptMeasuredRuns], [g.thinkingTokens, g.thinkingMeasuredRuns], [g.outputTokens, g.outputMeasuredRuns]].map(([value, samples], i) => <td key={`token-${i}`} className="p-2 text-right tabular-nums">{usageCount(value)} ({samples} runs)</td>)}<td className="p-2 text-right">{count(g.timeouts)}</td><td className="p-2 text-right">{count(g.otherFailures)}</td></tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No fresh AI runs recorded in this period.</p>}</CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Submission choices by first recorded suggestion result</CardTitle><CardDescription>Provider entries on customer requests first submitted in the last {days} days, grouped by the first recorded suggestion result before first submission. Generated/served evidence does not prove browser rendering. Current entries can reflect later corrections; missing observations have their own bucket. Accepted means the seller picked a suggested provider; the rest searched or typed a name. Entries answered as unknown or not applicable are left out. Acceptance is a proxy for accuracy, not proof.</CardDescription></CardHeader>
            <CardContent>{aiAcceptance.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <caption className="sr-only">Suggestion acceptance by source for the selected period</caption>
                <thead><tr className="border-b"><th scope="col" className="p-2">Recorded source</th><th scope="col" className="p-2 text-right">Entries</th><th scope="col" className="p-2 text-right">Accepted</th><th scope="col" className="p-2 text-right">Acceptance</th></tr></thead>
                <tbody>{aiAcceptance.map((g) => <tr key={g.served} className="border-b"><th scope="row" className="p-2 font-normal">{AI_SERVED_LABELS[g.served] ?? g.served.replaceAll('_', ' ')}</th><td className="p-2 text-right tabular-nums">{count(g.entries)}</td><td className="p-2 text-right tabular-nums">{count(g.accepted)}</td><td className="p-2 text-right tabular-nums">{g.entries ? `${Math.round(100 * g.accepted / g.entries)}%` : '—'}</td></tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No eligible submitted provider entries in this period.</p>}</CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">Aggregates only; no seller answers or raw telemetry payloads are displayed. Browser events sent to Vercel Analytics are separate and are not included. See <Link href="/admin/growth" className="underline">Growth</Link> for acquisition and activation, or <Link href="/admin/abandonment" className="underline">Seller Progress</Link> for completion steps.</p>
    </div>;
}
