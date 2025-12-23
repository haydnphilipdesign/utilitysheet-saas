import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ActivityItem {
    id: string;
    user: {
        name: string;
        email: string;
        avatarDetails?: string;
    };
    action: string; // e.g., "Created a request", "Signed up"
    details: string; // e.g., "123 Main St", "Pro Plan"
    timestamp: string;
}

interface RecentActivityProps {
    items: ActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
    return (
        <div className="space-y-8">
            {items.map((item) => (
                <div key={item.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>{item.user.avatarDetails || item.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{item.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                            {item.action} <span className="text-foreground font-medium">{item.details}</span>
                        </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground">
                        {item.timestamp}
                    </div>
                </div>
            ))}
        </div>
    );
}
