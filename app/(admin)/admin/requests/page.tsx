import { sql } from '@/lib/neon/db';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function getRequests(query?: string) {
    if (!sql) return [];

    if (query) {
        const q = `%${query}%`;
        return sql`
            SELECT * FROM requests 
            WHERE property_address ILIKE ${q} 
            OR seller_name ILIKE ${q} 
            ORDER BY created_at DESC 
            LIMIT 50
        `;
    }

    return sql`
        SELECT * FROM requests 
        ORDER BY created_at DESC 
        LIMIT 50
    `;
}

export default async function RequestsPage({ searchParams }: { searchParams: { q?: string } }) {
    const query = searchParams.q;
    const requests = await getRequests(query);

    async function searchAction(formData: FormData) {
        "use server";
        const q = formData.get('q');
        redirect(`/admin/requests?q=${q}`);
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Request Inspector</h2>
                    <p className="text-muted-foreground">
                        View and manage all utility requests.
                    </p>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <form action={searchAction} className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                        type="search"
                        name="q"
                        placeholder="Search address or seller..."
                        defaultValue={query}
                    />
                    <Button type="submit" size="icon">
                        <Search className="h-4 w-4" />
                    </Button>
                </form>
            </div>

            <RequestsTable requests={requests as any[]} />
        </div>
    );
}
