import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminAccountPreview } from '@/components/admin/AdminAccountPreview';
import type { UserLatestRequest } from '@/lib/admin';

interface ActivityItem {
    id: string;
    user: {
        id?: string | null;
        name: string;
        email: string;
        avatarDetails?: string;
    };
    action: string; // e.g., "Created a request", "Signed up"
    details: string; // e.g., "123 Main St", "Pro Plan"
    timestamp: string;
    latestRequests?: UserLatestRequest[];
}

interface RecentActivityProps {
    items: ActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
    return (
        <div className="space-y-5">
            {items.map((item) => (
                <div key={item.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>{item.user.avatarDetails || item.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <AdminAccountPreview
                        account={{
                            id: item.user.id || null,
                            name: item.user.name,
                            email: item.user.email,
                        }}
                        latestRequests={item.latestRequests || []}
                        className="ml-4"
                    >
                        <span className="block space-y-1">
                            <span className="block text-sm font-medium leading-none">{item.user.name}</span>
                            <span className="block text-sm text-muted-foreground">
                                {item.action} <span className="text-foreground font-medium">{item.details}</span>
                            </span>
                        </span>
                    </AdminAccountPreview>
                    <div className="ml-auto font-medium text-xs text-muted-foreground">
                        {item.timestamp}
                    </div>
                </div>
            ))}
        </div>
    );
}
