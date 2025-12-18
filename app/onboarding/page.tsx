'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Building2, Palette, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { createOrganization, createBrandProfile, getOrCreateAccount } from '@/lib/neon/queries';

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [account, setAccount] = useState<any>(null);

    // Form states
    const [orgName, setOrgName] = useState('');
    const [brandName, setBrandName] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#10b981');

    useEffect(() => {
        const supabase = createClient();
        if (!supabase) {
            // Demo mode
            setUser({ email: 'demo@utilitysheet.com' });
            return;
        }

        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) {
                router.push('/auth/login');
                return;
            }
            setUser(user);

            // Sync/Get account
            const acc = await getOrCreateAccount(user.id, user.email || '', user.user_metadata?.full_name);
            setAccount(acc);

            // If already has organization, skip onboarding
            if (acc?.active_organization_id) {
                router.push('/dashboard');
            }
        });
    }, [router]);

    const handleCreateOrg = async () => {
        if (!orgName) return;
        setLoading(true);
        try {
            const org = await createOrganization(orgName, account.id);
            setBrandName(orgName); // Default brand name to org name
            setStep(2);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBrand = async () => {
        setLoading(true);
        try {
            await createBrandProfile({
                accountId: account.id,
                name: brandName || orgName,
                primaryColor: primaryColor,
                isDefault: true,
                // In a real app we'd also link to the organization_id here
                // but for now let's just finish
            });
            setStep(3);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        router.push('/dashboard');
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0
        })
    };

    if (!user && !account && step !== 1) {
        return <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>;
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-xl">
                {/* Header */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <Zap className="h-6 w-6 text-emerald-500" />
                    <span className="text-xl font-bold text-white">UtilitySheet Onboarding</span>
                </div>

                {/* Progress Bar */}
                <div className="flex gap-2 mb-8 px-4">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-emerald-500' : 'bg-zinc-800'
                                }`}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait" custom={step}>
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                                        <Building2 className="h-6 w-6 text-emerald-400" />
                                    </div>
                                    <CardTitle className="text-2xl text-white">Let's set up your business</CardTitle>
                                    <CardDescription className="text-zinc-400">
                                        What's the name of your team or brokerage? This will be used for your organization slug.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="orgName" className="text-zinc-300">Organization Name</Label>
                                        <Input
                                            id="orgName"
                                            placeholder="e.g. The Evergreen Group"
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        onClick={handleCreateOrg}
                                        disabled={!orgName || loading}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                                        <Palette className="h-6 w-6 text-emerald-400" />
                                    </div>
                                    <CardTitle className="text-2xl text-white">Branding basics</CardTitle>
                                    <CardDescription className="text-zinc-400">
                                        Set up your first branding profile. You can change this later.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="brandName" className="text-zinc-300">Brand Display Name</Label>
                                        <Input
                                            id="brandName"
                                            value={brandName}
                                            onChange={(e) => setBrandName(e.target.value)}
                                            className="bg-zinc-800/50 border-zinc-700 text-white h-12"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-zinc-300">Primary Brand Color</Label>
                                        <div className="flex gap-3">
                                            {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'].map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setPrimaryColor(color)}
                                                    className={`w-10 h-10 rounded-full border-2 transition-all ${primaryColor === color ? 'border-white scale-110' : 'border-transparent'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                            <input
                                                type="color"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="w-10 h-10 rounded-full bg-zinc-800 border-none cursor-pointer p-0"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep(3)}
                                        className="flex-1 text-zinc-400 hover:text-white"
                                    >
                                        Skip for now
                                    </Button>
                                    <Button
                                        onClick={handleCreateBrand}
                                        disabled={loading}
                                        className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Next <ArrowRight className="ml-2 h-4 w-4" /></>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl text-center">
                                <CardHeader>
                                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                                    </div>
                                    <CardTitle className="text-3xl text-white">You're all set!</CardTitle>
                                    <CardDescription className="text-zinc-400 text-lg">
                                        Welcome to UtilitySheet. Your organization is ready.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-zinc-500">
                                        You can now start creating your first utility sheet request.
                                        We'll help you collect provider info from your sellers automatically.
                                    </p>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        onClick={handleFinish}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-14 text-lg font-bold shadow-lg shadow-emerald-500/20"
                                    >
                                        Go to Dashboard
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
