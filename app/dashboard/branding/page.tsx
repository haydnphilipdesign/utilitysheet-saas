'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Palette, Star, MoreHorizontal, Pencil, Trash2, Loader2, RefreshCcw } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BrandProfile } from '@/types';
import { toast } from 'sonner';

export default function BrandingPage() {
    const [brands, setBrands] = useState<BrandProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBrands = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/branding');
            if (response.ok) {
                const data = await response.json();
                setBrands(data);
            } else {
                toast.error('Failed to fetch brand profiles');
            }
        } catch (error) {
            console.error('Error fetching brands:', error);
            toast.error('Error fetching brand profiles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;

        try {
            const response = await fetch(`/api/branding/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Profile deleted successfully');
                fetchBrands();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to delete profile');
            }
        } catch (error) {
            console.error('Error deleting profile:', error);
            toast.error('Error deleting profile');
        }
    };

    const handleSetDefault = async (profile: BrandProfile) => {
        try {
            // We use the update endpoint to set as default
            const response = await fetch(`/api/branding/${profile.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...profile,
                    is_default: true
                }),
            });

            if (response.ok) {
                toast.success('Default profile updated');
                fetchBrands();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to update default profile');
            }
        } catch (error) {
            console.error('Error setting default:', error);
            toast.error('Error setting default profile');
        }
    };

    if (loading && brands.length === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Branding Profiles</h1>
                    <p className="text-zinc-400 mt-1">Customize how your utility packets look</p>
                </div>
                <Link href="/dashboard/branding/new">
                    <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        New Profile
                    </Button>
                </Link>
            </div>

            {/* Brands Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brands.map((brand) => (
                    <Card key={brand.id} className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Brand Color Preview */}
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                                        style={{ backgroundColor: brand.primary_color }}
                                    >
                                        {brand.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <CardTitle className="text-white text-lg flex items-center gap-2">
                                            {brand.name}
                                            {brand.is_default && (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                                                    <Star className="h-3 w-3 mr-1" />
                                                    Default
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="text-zinc-400">
                                            {brand.contact_name || 'No contact name'}
                                        </CardDescription>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                        <Link href={`/dashboard/branding/${brand.id}`}>
                                            <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer">
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                        </Link>
                                        {!brand.is_default && (
                                            <DropdownMenuItem
                                                className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
                                                onClick={() => handleSetDefault(brand)}
                                            >
                                                <Star className="mr-2 h-4 w-4" />
                                                Set as Default
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                                            onClick={() => handleDelete(brand.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Email</span>
                                    <span className="text-zinc-300">{brand.contact_email || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Phone</span>
                                    <span className="text-zinc-300">{brand.contact_phone || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">Colors</span>
                                    <div className="flex gap-1">
                                        <div
                                            className="w-6 h-6 rounded border border-zinc-700"
                                            style={{ backgroundColor: brand.primary_color }}
                                        />
                                        <div
                                            className="w-6 h-6 rounded border border-zinc-700"
                                            style={{ backgroundColor: brand.secondary_color }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-zinc-800">
                                <Link href={`/dashboard/branding/${brand.id}`}>
                                    <Button
                                        variant="outline"
                                        className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                    >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Profile
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Add New Card */}
                <Link href="/dashboard/branding/new">
                    <Card className="border-zinc-800 border-dashed bg-transparent hover:bg-zinc-900/30 transition-colors cursor-pointer h-full min-h-[280px] flex items-center justify-center">
                        <CardContent className="text-center">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-zinc-800/50 flex items-center justify-center">
                                <Plus className="h-6 w-6 text-zinc-500" />
                            </div>
                            <p className="text-zinc-400 font-medium">Create New Profile</p>
                            <p className="text-sm text-zinc-500 mt-1">Add another branding style</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
