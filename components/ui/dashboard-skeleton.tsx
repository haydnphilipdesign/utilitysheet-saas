import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <Skeleton className="h-9 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="border-border bg-card/50 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Skeleton className="h-4 w-24 mb-2" />
                                    <Skeleton className="h-8 w-12" />
                                </div>
                                <Skeleton className="h-12 w-12 rounded-xl" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table Skeleton */}
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <Skeleton className="h-6 w-32 mb-1" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                        <Skeleton className="h-10 w-72" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                    <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableHead>
                                    <TableHead className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-border">
                                        <TableCell>
                                            <div className="space-y-1">
                                                <Skeleton className="h-5 w-48" />
                                                <Skeleton className="h-4 w-32 md:hidden" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Skeleton className="h-4 w-32" />
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-6 w-20 rounded-full" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-8 ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
