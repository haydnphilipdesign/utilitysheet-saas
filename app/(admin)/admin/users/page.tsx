import { getAllUsers } from '@/lib/admin';
import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const { users, total } = await getAllUsers(100, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">User Management</h1>
                    <p className="text-muted-foreground mt-1">
                        View and manage all {total} registered users
                    </p>
                </div>
            </div>

            <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm">
                <UsersTable users={users} />
            </div>
        </div>
    );
}
