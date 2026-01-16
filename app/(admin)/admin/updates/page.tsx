import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getProductUpdates } from '@/lib/neon/queries/updates';
import { createProductUpdateAdminAction, deleteProductUpdateAdminAction } from './actions';

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

export default async function AdminUpdatesPage() {
    const updates = await getProductUpdates({ limit: 50, includeUnpublished: true });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Product Updates</h2>
                    <p className="text-muted-foreground">Post changelog entries that show on the user dashboard.</p>
                </div>
                <Link href="/dashboard">
                    <Button variant="secondary">Back to App</Button>
                </Link>
            </div>

            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle>New update</CardTitle>
                    <CardDescription>Write a short note. Plain text is fine (new lines are preserved).</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={createProductUpdateAdminAction} className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground" htmlFor="title">Title</label>
                                <Input id="title" name="title" placeholder="e.g., Branding fixes for packets + PDFs" required />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground" htmlFor="category">Category</label>
                                    <select
                                        id="category"
                                        name="category"
                                        defaultValue="announcement"
                                        className="h-7 w-full rounded-md border border-input bg-input/20 dark:bg-input/30 px-2 text-sm text-foreground outline-none"
                                    >
                                        <option value="announcement">Announcement</option>
                                        <option value="feature">Feature</option>
                                        <option value="bugfix">Bugfix</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Publish</label>
                                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <input type="checkbox" name="is_published" defaultChecked className="h-4 w-4 accent-red-500" />
                                        Visible to users
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground" htmlFor="body">Body</label>
                            <Textarea
                                id="body"
                                name="body"
                                placeholder={`- Bugfix: Saved branding preferences now apply to packets (generation date + next steps)\n- Bugfix: PDFs always fit 1 page (US Letter)\n- Feature: Branding logo uploads`}
                                rows={7}
                                required
                                className="text-sm"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">
                                Post update
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle>Recent updates</CardTitle>
                    <CardDescription>{updates.length} total</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {updates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No updates yet.</p>
                    ) : (
                        updates.map((u) => {
                            const deleteAction = deleteProductUpdateAdminAction.bind(null, u.id);
                            return (
                                <div key={u.id} className="rounded-lg border border-border p-4 bg-background/40">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-semibold text-foreground truncate">{u.title}</h3>
                                                <Badge className={categoryBadgeClass(u.category)}>{categoryLabel(u.category)}</Badge>
                                                {u.is_published ? (
                                                    <Badge variant="secondary">Published</Badge>
                                                ) : (
                                                    <Badge variant="outline">Draft</Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(u.published_at), 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{u.body}</p>
                                        </div>

                                        <form action={deleteAction} className="shrink-0">
                                            <Button type="submit" variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                                                Delete
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

