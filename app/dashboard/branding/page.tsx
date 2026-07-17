'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Plus, Star, MoreHorizontal, Pencil, Trash2, Loader2, Lock, Copy, Link2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { BrandProfileWithUsage } from '@/types';
import { toast } from 'sonner';

export default function BrandingPage() {
    const [brands, setBrands] = useState<BrandProfileWithUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<BrandProfileWithUsage | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [isPro, setIsPro] = useState(false);
    const [organizationName, setOrganizationName] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [brandsResponse, accountResponse] = await Promise.all([
                fetch('/api/branding'),
                fetch('/api/account')
            ]);

            if (brandsResponse.ok) {
                const data = await brandsResponse.json();
                setBrands(data);
            } else {
                toast.error('Failed to fetch brand profiles');
            }

            if (accountResponse.ok) {
                const data = await accountResponse.json();
                setIsPro(data.account.subscription_status === 'pro' || data.activeOrganization?.subscription_status === 'team');
                setOrganizationName(data.activeOrganization?.name || null);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error loading branding page');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        setDeleting(true);
        try {
            const response = await fetch(`/api/branding/${deleteTarget.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Profile deleted successfully');
                setDeleteTarget(null);
                fetchData();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to delete profile');
            }
        } catch (error) {
            console.error('Error deleting profile:', error);
            toast.error('Error deleting profile');
        } finally {
            setDeleting(false);
        }
    };

    const handleDuplicate = async (profile: BrandProfileWithUsage) => {
        if (!isPro) {
            toast.error('Upgrade to Pro to manage branding profiles');
            return;
        }

        setDuplicatingId(profile.id);
        try {
            const response = await fetch(`/api/branding/${profile.id}/duplicate`, {
                method: 'POST',
            });

            if (response.ok) {
                toast.success(`Duplicated "${profile.name}"`);
                fetchData();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to duplicate profile');
            }
        } catch (error) {
            console.error('Error duplicating profile:', error);
            toast.error('Error duplicating profile');
        } finally {
            setDuplicatingId(null);
        }
    };

    const handleSetDefault = async (profile: BrandProfileWithUsage) => {
        if (!isPro) {
            toast.error('Upgrade to Pro to manage branding profiles');
            return;
        }

        try {
            // Partial update: only flip the default flag. Sending the whole
            // profile would rewrite every field with the list snapshot.
            const response = await fetch(`/api/branding/${profile.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_default: true }),
            });

            if (response.ok) {
                toast.success('Default profile updated');
                fetchData();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to update default profile');
            }
        } catch (error) {
            console.error('Error setting default:', error);
            toast.error('Error setting default profile');
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <PageHeader
                title="Branding Profiles"
                description={
                    organizationName
                        ? `Brand your PDFs, seller forms, and emails. Profiles are shared with everyone in ${organizationName}.`
                        : 'Brand your PDFs, seller forms, and emails. The default profile is used for new requests.'
                }
                actions={
                    isPro ? (
                        <Link href="/dashboard/branding/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                New Profile
                            </Button>
                        </Link>
                    ) : (
                        <Button disabled variant="secondary">
                            <Lock className="mr-2 h-4 w-4" />
                            Upgrade to Create Profile
                        </Button>
                    )
                }
            />

            {brands.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-border rounded-3xl bg-card/30 backdrop-blur-sm">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                        <img
                            src="/branding_empty_state_illustration_1766440299963.png"
                            alt="Branding"
                            className="relative w-48 h-48 object-contain"
                        />
                    </div>

                    {isPro ? (
                        <div className="text-center max-w-sm">
                            <h3 className="text-xl font-bold text-foreground mb-2">No branding profiles yet</h3>
                            <p className="text-muted-foreground mb-6">Create your first profile to customize your utility sheets with your own logo and colors.</p>
                            <Link href="/dashboard/branding/new">
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create First Profile
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="text-center max-w-md">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium mb-4">
                                <Star className="h-3 w-3 fill-primary" />
                                Pro Feature
                            </div>
                            <h3 className="text-2xl font-bold text-foreground mb-2">Unlock Custom Branding</h3>
                            <p className="text-muted-foreground mb-8">
                                Stand out from the competition. Pro users can create unlimited branding profiles with custom logos, colors, and contact information.
                            </p>
                            <Link href="/dashboard/settings?tab=billing">
                                <Button className="font-semibold px-8">
                                    Upgrade to Pro
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Brands Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brands.map((brand) => (
                    <Card key={brand.id} className="border-border bg-card/50 hover:bg-card/70 transition-colors">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Brand Color Preview */}
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                                        style={{ backgroundColor: brand.primary_color }}
                                    >
                                        {brand.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-foreground text-lg flex items-center gap-2 min-w-0">
                                            <span className="truncate">{brand.name}</span>
                                            {brand.is_default && (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                                                    <Star className="h-3 w-3 mr-1" />
                                                    Default
                                                </Badge>
                                            )}
                                            {brand.is_intake_default && (
                                                <Badge variant="outline" className="text-xs">
                                                    <Link2 className="h-3 w-3 mr-1" />
                                                    Seller form
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="text-muted-foreground truncate">
                                            {brand.contact_name || 'No contact name'}
                                        </CardDescription>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        aria-label={`Actions for ${brand.name}`}
                                        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                                    >
                                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <Link href={`/dashboard/branding/${brand.id}`}>
                                            <DropdownMenuItem className="cursor-pointer">
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                        </Link>

                                        {isPro ? (
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                disabled={duplicatingId === brand.id}
                                                onClick={() => handleDuplicate(brand)}
                                            >
                                                <Copy className="mr-2 h-4 w-4" />
                                                Duplicate
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                                                <Lock className="mr-2 h-4 w-4" />
                                                Duplicate (Pro Only)
                                            </DropdownMenuItem>
                                        )}

                                        {!brand.is_default && (
                                            isPro ? (
                                                <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() => handleSetDefault(brand)}
                                                >
                                                    <Star className="mr-2 h-4 w-4" />
                                                    Set as Default
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                                                    <Lock className="mr-2 h-4 w-4" />
                                                    Set Default (Pro Only)
                                                </DropdownMenuItem>
                                            )
                                        )}

                                        {isPro ? (
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive cursor-pointer"
                                                onClick={() => setDeleteTarget(brand)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                                                <Lock className="mr-2 h-4 w-4" />
                                                Delete (Pro Only)
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <span className="text-muted-foreground">Email</span>
                                    <span className="text-secondary-foreground break-all sm:break-normal sm:text-right sm:max-w-[60%]">
                                        {brand.contact_email || '-'}
                                    </span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <span className="text-muted-foreground">Phone</span>
                                    <span className="text-secondary-foreground break-all sm:break-normal sm:text-right sm:max-w-[60%]">
                                        {brand.contact_phone || '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Accent color</span>
                                    <div
                                        className="w-6 h-6 rounded border border-border"
                                        style={{ backgroundColor: brand.primary_color }}
                                        title={brand.primary_color}
                                    />
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    {[
                                        brand.request_count === 1 ? 'Used by 1 request' : `Used by ${brand.request_count} requests`,
                                        brand.is_default ? 'preselected for new requests' : null,
                                        brand.is_intake_default ? 'used by your reusable seller form' : null,
                                    ].filter(Boolean).join(' · ')}
                                </p>
                                <Link href={`/dashboard/branding/${brand.id}`}>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Profile
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Add New Card - Only show if Pro, otherwise header button handles it or the banner above */}
                {isPro && (
                    <Link href="/dashboard/branding/new">
                        <Card className="border-border border-dashed bg-transparent hover:bg-card/30 transition-colors cursor-pointer h-full min-h-[280px] flex items-center justify-center">
                            <CardContent className="text-center">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-secondary/50 flex items-center justify-center">
                                    <Plus className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-muted-foreground font-medium">Create New Profile</p>
                                <p className="text-sm text-muted-foreground/70 mt-1">Add another branding style</p>
                            </CardContent>
                        </Card>
                    </Link>
                )}
            </div>

            {/* Delete confirmation with real fallback behavior */}
            <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</DialogTitle>
                        <DialogDescription>
                            This permanently removes the profile. It cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTarget && (
                        <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
                            {deleteTarget.request_count > 0 && (
                                <li>
                                    {deleteTarget.request_count === 1
                                        ? '1 request uses this profile. Its'
                                        : `${deleteTarget.request_count} requests use this profile. Their`}{' '}
                                    future PDFs and packet pages will use your default profile instead.
                                </li>
                            )}
                            {deleteTarget.is_intake_default && (
                                <li>Your reusable seller form uses this profile and will switch to your default profile.</li>
                            )}
                            {deleteTarget.is_default && brands.length > 1 && (
                                <li>This is your default profile. Your oldest remaining profile will take over as the fallback until you pick a new default.</li>
                            )}
                            {brands.length === 1 && (
                                <li>This is your only profile. A basic profile will be recreated automatically from your account details.</li>
                            )}
                            {deleteTarget.request_count === 0 && !deleteTarget.is_intake_default && !deleteTarget.is_default && (
                                <li>Nothing currently uses this profile.</li>
                            )}
                        </ul>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete profile
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
