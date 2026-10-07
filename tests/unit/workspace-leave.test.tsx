import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceTeam } from '@/components/settings/workspace-team';
import type { OrganizationMemberRow } from '@/components/settings/types';

const me: OrganizationMemberRow = { account_id: 'acc_me', email: 'me@example.com', full_name: 'Jordan Rivera', member_role: 'member' };
const pat: OrganizationMemberRow = { account_id: 'acc_pat', email: 'pat@example.com', full_name: 'Pat Lee', member_role: 'admin' };
const sam: OrganizationMemberRow = { account_id: 'acc_sam', email: 'sam@example.com', full_name: 'Sam Okafor', member_role: 'member' };

function renderTeam(options: { role: 'admin' | 'member'; members: OrganizationMemberRow[]; onRefresh?: () => Promise<void> }) {
    return render(
        <WorkspaceTeam
            accountState="ready"
            onRetryAccount={() => undefined}
            accountId="acc_me"
            organization={{ id: 'org_1', name: 'Riverbend Transaction Services', role: options.role, subscription_status: 'team', seat_quantity: 4 }}
            isTeam
            isAdmin={options.role === 'admin'}
            workspaceName="Riverbend Transaction Services"
            onWorkspaceNameChange={() => undefined}
            onOrganizationUpdated={() => undefined}
            notifyAdmins={false}
            onNotifyAdminsChange={() => undefined}
            teamState="ready"
            members={options.members}
            seatUsage={{ used: options.members.length, pendingInvites: 0 }}
            invites={[]}
            onRefresh={options.onRefresh || (async () => undefined)}
            inviteLink={null}
            onInviteLink={() => undefined}
            onOpenBilling={() => undefined}
        />,
    );
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('leaving a workspace', () => {
    const assign = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('location', { ...window.location, assign });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('lets a member leave after saying what happens to their work', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: true, left: true, requestsMoved: 2, profilesMoved: 0 })));
        renderTeam({ role: 'member', members: [{ ...me }, pat, sam] });

        expect(screen.getByText(/The requests and Branding Profiles you created here stay with the workspace and are handed\s+to an admin, and so are the seller forms you shared with it, whose links keep working\./)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }));

        const dialog = await screen.findByRole('dialog', { name: 'Leave Riverbend Transaction Services?' });
        expect(dialog).toHaveTextContent('You lose access right away.');
        expect(dialog).toHaveTextContent('the seller forms you shared with the workspace, are handed to an admin');
        expect(dialog).toHaveTextContent('The links of your own seller forms for this workspace stop working');
        expect(fetch).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Leave workspace' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/organization/members/acc_me', { method: 'DELETE' }));
        await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'));
    });

    it('keeps the person on the page with the reason when leaving is refused', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'No admin can take over', message: 'Nothing was changed.' }, 400)));
        renderTeam({ role: 'member', members: [{ ...me }, pat] });

        fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }));
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave workspace' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was changed.');
        expect(assign).not.toHaveBeenCalled();
    });

    it('tells the only admin to make someone else an admin first', () => {
        renderTeam({ role: 'admin', members: [{ ...me, member_role: 'admin' }, sam] });

        expect(screen.getByText('You’re the only admin of this workspace. Make someone else an admin above, then you can leave.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Leave workspace' })).not.toBeInTheDocument();
    });

    it('lets an admin leave when another admin stays', () => {
        renderTeam({ role: 'admin', members: [{ ...me, member_role: 'admin' }, pat] });

        expect(screen.getByRole('button', { name: 'Leave workspace' })).toBeEnabled();
    });

    it('offers nothing to leave in a workspace of one', () => {
        renderTeam({ role: 'admin', members: [{ ...me, member_role: 'admin' }] });

        expect(screen.queryByRole('heading', { name: 'Leave this workspace' })).not.toBeInTheDocument();
        expect(screen.queryByText(/aren’t available yet/)).not.toBeInTheDocument();
    });
});

describe('removing a member', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('says where the person’s work goes before removing, and what moved afterwards', async () => {
        const onRefresh = vi.fn(async () => undefined);
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
            success: true, left: false, requestsMoved: 3, profilesMoved: 1, recipientAccountId: 'acc_me',
        })));
        renderTeam({ role: 'admin', members: [{ ...me, member_role: 'admin' }, pat, sam], onRefresh });

        fireEvent.click(screen.getByRole('button', { name: 'Remove Sam Okafor' }));
        const dialog = await screen.findByRole('dialog', { name: 'Remove Sam Okafor?' });
        expect(dialog).toHaveTextContent('The requests and Branding Profiles they created stay here and become yours, and so do the seller forms they shared with the workspace, whose links keep working.');
        expect(dialog).toHaveTextContent('The links of their own seller forms for this workspace stop working.');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Remove member' }));

        expect(await screen.findByText('Sam Okafor was removed from this workspace. Their 3 requests and 1 Branding Profile now belong to you.')).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledWith('/api/organization/members/acc_sam', { method: 'DELETE' });
        expect(onRefresh).toHaveBeenCalled();
    });

    it('says nothing about a hand-over when the person had created nothing', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: true, requestsMoved: 0, profilesMoved: 0, recipientAccountId: null })));
        renderTeam({ role: 'admin', members: [{ ...me, member_role: 'admin' }, sam] });

        fireEvent.click(screen.getByRole('button', { name: 'Remove Sam Okafor' }));
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove member' }));

        expect(await screen.findByText('Sam Okafor was removed from this workspace.')).toBeInTheDocument();
    });
});
