"use client";

import { Badge } from "@/components/ui/badge";

interface UtilityEntry {
    id: string;
    category: string;
    entry_mode: string;
    display_name: string;
    raw_text: string;
    confidence_score: number;
}

interface UtilityEntriesTableProps {
    entries: UtilityEntry[];
}

export function UtilityEntriesTable({ entries }: UtilityEntriesTableProps) {
    if (entries.length === 0) {
        return <div className="text-muted-foreground py-4">No utility entries found.</div>;
    }

    return (
        <div className="rounded-md border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50 text-left">
                        <th className="p-4 font-medium">Category</th>
                        <th className="p-4 font-medium">Provider</th>
                        <th className="p-4 font-medium">Mode</th>
                        <th className="p-4 font-medium">Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-4 font-medium capitalize">{entry.category}</td>
                            <td className="p-4">
                                <span className="font-medium">{entry.display_name || entry.raw_text || '-'}</span>
                                {entry.raw_text && entry.display_name && entry.raw_text !== entry.display_name && (
                                    <div className="text-xs text-muted-foreground">Raw: {entry.raw_text}</div>
                                )}
                            </td>
                            <td className="p-4">
                                <Badge variant="outline">{entry.entry_mode}</Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">
                                {entry.confidence_score ? `${(entry.confidence_score * 100).toFixed(0)}%` : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
