import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getProductUpdates } from '@/lib/neon/queries/updates';

export const dynamic = 'force-dynamic';

function categoryLabel(category: string) {
    if (category === 'bugfix') return 'Bugfix';
    if (category === 'feature') return 'Feature';
    if (category === 'announcement') return 'Announcement';
    return category;
}

function categoryBadgeClass(category: string) {
    if (category === 'bugfix') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    if (category === 'feature') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    if (category === 'announcement') return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    return 'bg-muted text-muted-foreground border-border';
}

export default async function DashboardUpdatesPage() {
    const updates = await getProductUpdates({ limit: 50, includeUnpublished: false });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Updates</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">Bug fixes, feature releases, and announcements.</p>
            </div>

            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle>Changelog</CardTitle>
                    <CardDescription>{updates.length ? `${updates.length} posts` : 'No posts yet'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {updates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No updates yet.</p>
                    ) : (
                        updates.map((u) => (
                            <div key={u.id} className="rounded-lg border border-border p-4 bg-background/40">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-foreground">{u.title}</h3>
                                    <Badge className={categoryBadgeClass(u.category)}>{categoryLabel(u.category)}</Badge>
                                    <span className="text-xs text-muted-foreground">{format(new Date(u.published_at), 'MMM d, yyyy')}</span>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{u.body}</p>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

