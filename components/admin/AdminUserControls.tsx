'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Ban, ShieldAlert, User, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserRow, EffectivePlan } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
    banUserAction,
    unbanUserAction,
    updateUserPlanAction,
    updateUserRoleAction,
} from '@/app/(admin)/admin/users/actions';

type ManagedUser = Pick<
    AdminUserRow,
    | 'id'
    | 'email'
    | 'role'
    | 'subscription_status'
    | 'effective_subscription_status'
    | 'active_organization_subscription_status'
>;

type ConfirmableAction =
    | { type: 'demote'; user: ManagedUser }
    | { type: 'ban'; user: ManagedUser }
    | { type: 'unban'; user: ManagedUser }
    | { type: 'setProEntitlement'; user: ManagedUser }
    | { type: 'setFreeEntitlement'; user: ManagedUser };

function getEffectivePlan(user: ManagedUser): EffectivePlan {
    if (user.effective_subscription_status) return user.effective_subscription_status;
    if (user.active_organization_subscription_status === 'team') return 'team';
    return user.subscription_status;
}

function getActionCopy(action: ConfirmableAction['type']) {
    switch (action) {
        case 'demote':
            return { title: 'Demote to User', confirm: 'Demote', tone: 'default' as const };
        case 'ban':
            return { title: 'Ban User', confirm: 'Ban', tone: 'destructive' as const };
        case 'unban':
            return { title: 'Unban User', confirm: 'Unban', tone: 'default' as const };
        case 'setProEntitlement':
            return { title: 'Set Pro entitlement', confirm: 'Apply override', tone: 'default' as const };
        case 'setFreeEntitlement':
            return { title: 'Set Free entitlement', confirm: 'Apply override', tone: 'default' as const };
    }
}

function actionGroups(user: ManagedUser): Array<{ label: string; actions: ConfirmableAction['type'][]; note?: string }> {
    const effectivePlan = getEffectivePlan(user);

    return [
        {
            label: 'Access',
            actions: user.role === 'admin' ? ['demote' as const] : [],
        },
        {
            label: 'Entitlement override',
            actions: effectivePlan === 'team'
                ? []
                : [user.subscription_status === 'pro' ? 'setFreeEntitlement' as const : 'setProEntitlement' as const],
            note: effectivePlan === 'team'
                ? 'This account is managed by an active Team workspace, so an account-level entitlement override is unavailable.'
                : 'Changes UtilitySheet account access only. This does not create, cancel, or modify a Stripe subscription.',
        },
        {
            label: 'Enforcement',
            actions: [user.role === 'banned' ? 'unban' as const : 'ban' as const],
        },
    ].filter((group) => group.actions.length > 0 || Boolean(group.note));
}

function ActionIcon({ type }: { type: ConfirmableAction['type'] }) {
    if (type === 'demote') return <User className="h-4 w-4" />;
    if (type === 'ban') return <Ban className="h-4 w-4" />;
    if (type === 'unban') return <UserCheck className="h-4 w-4" />;
    if (type === 'setFreeEntitlement') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUp className="h-4 w-4" />;
}

export function AdminUserControls({ user, className }: { user: ManagedUser; className?: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [confirmAction, setConfirmAction] = useState<ConfirmableAction | null>(null);
    const [reason, setReason] = useState('');
    const reasonOk = reason.trim().length >= 3;

    const openAction = (type: ConfirmableAction['type']) => {
        setConfirmAction({ type, user });
        setReason('');
    };

    const confirm = () => {
        if (!confirmAction) return;
        const reasonText = reason.trim();

        if (reasonText.length < 3) {
            toast.error('Please add a short reason (min 3 characters).');
            return;
        }

        startTransition(async () => {
            try {
                let result: { success: boolean; error?: string; code?: string } = {
                    success: false,
                    error: 'Unknown action',
                };

                switch (confirmAction.type) {
                    case 'demote':
                        result = await updateUserRoleAction(user.id, 'user', reasonText);
                        break;
                    case 'ban':
                        result = await banUserAction(user.id, reasonText);
                        break;
                    case 'unban':
                        result = await unbanUserAction(user.id, reasonText);
                        break;
                    case 'setProEntitlement':
                        result = await updateUserPlanAction(user.id, 'pro', reasonText);
                        break;
                    case 'setFreeEntitlement':
                        result = await updateUserPlanAction(user.id, 'free', reasonText);
                        break;
                }

                if (!result.success) {
                    toast.error(result.error || 'Action failed');
                    return;
                }

                toast.success(`${getActionCopy(confirmAction.type).title}: ${user.email}`);
                setConfirmAction(null);
                setReason('');
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Action failed');
            }
        });
    };

    return (
        <div className={cn('space-y-5', className)}>
            {actionGroups(user).map((group) => (
                <section key={group.label}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                    <div className="flex flex-wrap gap-2">
                        {group.actions.map((type) => {
                            const copy = getActionCopy(type);
                            return (
                                <Button
                                    key={type}
                                    variant={copy.tone}
                                    size="sm"
                                    onClick={() => openAction(type)}
                                    disabled={isPending}
                                >
                                    <ActionIcon type={type} />
                                    {copy.title}
                                </Button>
                            );
                        })}
                    </div>
                    {group.note ? <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">{group.note}</p> : null}
                </section>
            ))}

            {confirmAction ? (
                <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                    <h3 className="text-sm font-semibold text-foreground">{getActionCopy(confirmAction.type).title}</h3>
                    {(confirmAction.type === 'setProEntitlement' || confirmAction.type === 'setFreeEntitlement') ? (
                        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                This is an internal entitlement override. Stripe billing and subscription state will not be changed.
                            </p>
                        </div>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                        This action is audited. Add a short reason to proceed.
                    </p>
                    <Textarea
                        className="mt-3"
                        aria-label={`Reason for ${getActionCopy(confirmAction.type).title}`}
                        placeholder="Reason (required)..."
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={isPending}
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button
                            variant={getActionCopy(confirmAction.type).tone}
                            size="sm"
                            onClick={confirm}
                            disabled={!reasonOk || isPending}
                        >
                            {getActionCopy(confirmAction.type).confirm}
                        </Button>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
