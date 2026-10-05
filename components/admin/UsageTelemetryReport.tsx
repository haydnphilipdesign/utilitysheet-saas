import type { ReactNode } from 'react';
import type { UsageTelemetry } from '@/lib/neon/queries/admin-telemetry';
import { ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import { AdminStatStrip } from '@/components/admin/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function share(part: number, total: number) {
    return total ? `${Math.round(100 * part / total)}%` : '—';
}

function Report({ title, note, children }: { title: string; note: string; children: ReactNode }) {
    return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{note}</CardDescription></CardHeader>
        <CardContent className="space-y-4">{children}</CardContent></Card>;
}

export function UsageTelemetryReport({ data: u, days }: { data: UsageTelemetry; days: number }) {
    const n = (value: number) => value.toLocaleString();
    const stat = (label: string, value: number, hint: string) => ({ label, value: n(value), hint });
    const mix = (value: number, total: number) => `${n(value)} (${share(value, total)})`;
    return <div className="space-y-6">
        <Report title="Seller completion" note={`Real customer requests created in the last ${days} days. Outcomes are measured as of now; demo and deleted requests are excluded throughout these reports.`}>
            <AdminStatStrip stats={[
                stat('Created', u.created, 'All requests in this cohort'),
                stat('Recorded opens', u.opened, `${share(u.opened, u.created)} of created requests; repeat opens count once`),
                stat('Submitted', u.completed, `${share(u.completed, u.created)} of created requests; first submission recorded`),
                { label: 'Median open-to-submit', value: u.medianHours == null ? '—' : `${u.medianHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`, hint: `${n(u.timedCompletions)} matched completions; elapsed time includes time away` },
            ]} />
            <p className="text-sm text-muted-foreground">{n(u.completedWithoutOpen)} completed requests have no recorded open. Opens reflect seller endpoint access, not verified human views. Recent cohorts have had less time to finish.</p>
        </Report>
        <Report title="Workflow preferences" note={`The same ${days}-day creation cohort. Creation channels come from the earliest recorded creation event; modes and enabled sections reflect current request configuration.`}>
            <AdminStatStrip stats={[
                stat('Reusable intake link', u.intake, `${share(u.intake, u.created)} of created requests`),
                stat('Agent-created', u.agent, `${share(u.agent, u.created)} of created requests`),
                stat('Utility Sheet', u.simple, `${share(u.simple, u.created)} of created requests`),
                stat('Handoff Packet', u.advanced, `${share(u.advanced, u.created)} of created requests`),
            ]} />
            <p className="text-sm text-muted-foreground">{n(u.unknownSource)} requests have an unknown creation channel. A saved form can be used in either channel.</p>
            <h3 className="text-sm font-semibold">Enabled handoff sections</h3>
            {u.modules.length ? <ul className="space-y-2 text-sm">{u.modules.map((m) => <li key={m.module} className="flex justify-between gap-4 border-b pb-2">
                <span>{ADVANCED_MODULE_LABELS[m.module as keyof typeof ADVANCED_MODULE_LABELS] || m.module.replaceAll('_', ' ')}</span>
                <span className="shrink-0 tabular-nums">{mix(m.requests, u.advanced)}</span>
            </li>)}</ul> : <p className="text-sm text-muted-foreground">No enabled handoff sections in this cohort.</p>}
            <p className="text-xs text-muted-foreground">Share of Handoff Packet requests, not proof sellers answered those sections. Requests can include multiple sections.</p>
        </Report>
        <Report title="Provider assistance outcomes" note={`Current utility entries on real requests first submitted in the last ${days} days, including requests created earlier. Each percentage uses all entries in its category; subsequent edits may change these outcomes.`}>
            {u.providers.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <caption className="sr-only">Provider entry methods by utility category</caption>
                <thead><tr className="border-b">{['Category', 'Entries', 'Suggested', 'Search selected', 'Manual', 'Unknown', 'Unclassified', 'Not applicable'].map((label) => <th key={label} scope="col" className="whitespace-nowrap p-2">{label}</th>)}</tr></thead>
                <tbody>{u.providers.map((p) => <tr key={p.category} className="border-b">
                    <th scope="row" className="p-2 font-normal capitalize">{p.category.replaceAll('_', ' ')}</th><td className="p-2 tabular-nums">{n(p.total)}</td>
                    {[p.suggested, p.searched, p.manual, p.unknown, p.unclassified, p.notApplicable].map((value, i) => <td key={i} className="whitespace-nowrap p-2 tabular-nums">{mix(value, p.total)}</td>)}
                </tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No submitted provider entries in this period.</p>}
            <p className="text-xs text-muted-foreground">Suggested and search-selected describe the final entry method, not the percentage of displayed AI suggestions accepted. Unclassified means no method was recorded.</p>
        </Report>
        <Report title="Repeat usage" note={`Compares accounts creating real requests in the last ${days} days with the immediately preceding ${days} days. Activity here means request creation, not sign-ins.`}>
            <AdminStatStrip stats={[
                stat('Current-period accounts', u.currentAccounts, 'At least one real request created'),
                stat('Previous-period accounts', u.previousAccounts, 'At least one real request in the preceding window'),
                stat('Returning accounts', u.returningAccounts, `${share(u.returningAccounts, u.previousAccounts)} of previous-period accounts also created requests in the current period`),
            ]} />
        </Report>
        <Report title="Follow-up and corrections" note={`Distinct requests from the ${days}-day creation cohort, using their recorded history through now. Repeated actions count once per request.`}>
            <AdminStatStrip stats={[
                stat('Reminder sent', u.reminded, `${share(u.reminded, u.created)} of created requests`),
                stat('Submitted after reminder', u.completedAfterReminder, `${share(u.completedAfterReminder, u.reminded)} of reminded requests; sequence does not prove causation`),
                stat('Return link sent', u.returnLinks, `${share(u.returnLinks, u.created)} of created requests; seller emailed themselves a link`),
                stat('Edited after submission', u.edited, `${share(u.edited, u.completed)} of submitted requests`),
            ]} />
        </Report>
        <Report title="Test drive to real submission" note={`Customer accounts whose first recorded self-serve test-drive completion was in the last ${days} days. This section intentionally includes explicitly marked test drives; other demos are excluded.`}>
            <AdminStatStrip stats={[
                stat('Completed test drive', u.testDriveAccounts, 'Distinct customer accounts'),
                stat('Later real submission', u.convertedTestDriveAccounts, `${share(u.convertedTestDriveAccounts, u.testDriveAccounts)} received a real submission after completing the test drive`),
            ]} />
            <p className="text-xs text-muted-foreground">Measured through now, with unequal follow-up time for recent accounts. This association does not establish that the test drive caused conversion.</p>
        </Report>
    </div>;
}
