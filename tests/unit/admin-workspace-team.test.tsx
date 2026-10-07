import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkspaceInvitations } from '@/components/admin/WorkspaceInvitations';
import {
    countAdminInvitations,
    getAdminInvitationStatus,
    summarizeWorkspaceSeats,
    type AdminWorkspaceInvitation,
} from '@/lib/admin/workspace-team';

const now = new Date('2026-10-07T12:00:00.000Z');

function invitation(overrides: Partial<AdminWorkspaceInvitation> = {}): AdminWorkspaceInvitation {
    return {
        id: 'inv_1',
        email: 'pat@example.com',
        role: 'member',
        created_at: '2026-10-01T12:00:00.000Z',
        expires_at: '2026-10-31T12:00:00.000Z',
        accepted_at: null,
        inviter_name: 'Jordan Rivera',
        inviter_email: 'jordan@example.com',
        ...overrides,
    };
}

const accepted = invitation({ id: 'inv_2', email: 'sam@example.com', accepted_at: '2026-10-02T15:00:00.000Z' });
const expired = invitation({ id: 'inv_3', email: 'lee@example.com', expires_at: '2026-03-10T12:00:00.000Z', created_at: '2026-03-03T12:00:00.000Z' });

describe('admin invitation status', () => {
    it('reads accepted, pending and expired from the stored dates', () => {
        expect(getAdminInvitationStatus(invitation(), now)).toBe('pending');
        expect(getAdminInvitationStatus(expired, now)).toBe('expired');
        expect(getAdminInvitationStatus(accepted, now)).toBe('accepted');
        // Accepted stays accepted after the link's own expiry date has passed.
        expect(getAdminInvitationStatus({ ...accepted, expires_at: '2026-10-03T00:00:00.000Z' }, now)).toBe('accepted');
        expect(countAdminInvitations([invitation(), accepted, expired, expired], now)).toEqual({ accepted: 1, pending: 1, expired: 2 });
    });
});

describe('admin seat summary', () => {
    it('counts members and pending invitations, as the customer’s Billing page does', () => {
        expect(summarizeWorkspaceSeats({ entitlement: 'team', seatQuantity: 4, memberCount: 1, pendingInvitations: 2 })).toEqual({
            seats: 4,
            inUse: 3,
            detail: '1 member and 2 pending invitations',
            membersOverSeats: false,
        });
    });

    it('flags a Team workspace with more members than seats, and only a Team workspace', () => {
        expect(summarizeWorkspaceSeats({ entitlement: 'team', seatQuantity: 3, memberCount: 4, pendingInvitations: 1 }))
            .toMatchObject({ inUse: 5, detail: '4 members and 1 pending invitation', membersOverSeats: true });
        expect(summarizeWorkspaceSeats({ entitlement: 'team', seatQuantity: 3, memberCount: 3, pendingInvitations: 0 }).membersOverSeats).toBe(false);
        expect(summarizeWorkspaceSeats({ entitlement: 'free', seatQuantity: 0, memberCount: 2, pendingInvitations: 0 }).membersOverSeats).toBe(false);
        expect(summarizeWorkspaceSeats({ entitlement: null, seatQuantity: null, memberCount: 1, pendingInvitations: 0 }).seats).toBe(0);
    });
});

describe('WorkspaceInvitations', () => {
    it('lists every invitation with what happened to it and who sent it', () => {
        render(<WorkspaceInvitations invitations={[invitation(), accepted, { ...expired, inviter_name: null, inviter_email: null }]} now={now} />);

        expect(screen.getByRole('heading', { name: 'Invitations (3)' })).toBeInTheDocument();
        expect(screen.getByText('1 accepted, 1 pending, 1 expired. Only pending invitations hold a seat.')).toBeInTheDocument();

        const pendingRow = screen.getByText('pat@example.com').closest('tr')!;
        expect(within(pendingRow).getByText('Pending')).toBeInTheDocument();
        expect(within(pendingRow).getByText('Expires 10/31/2026')).toBeInTheDocument();
        expect(within(pendingRow).getByText('Jordan Rivera')).toBeInTheDocument();

        const acceptedRow = screen.getByText('sam@example.com').closest('tr')!;
        expect(within(acceptedRow).getByText('Accepted')).toBeInTheDocument();
        expect(within(acceptedRow).getByText('Joined 10/2/2026')).toBeInTheDocument();

        const expiredRow = screen.getByText('lee@example.com').closest('tr')!;
        expect(within(expiredRow).getByText('Expired')).toBeInTheDocument();
        expect(within(expiredRow).getByText('Expired 3/10/2026')).toBeInTheDocument();
        expect(within(expiredRow).getByText('No longer on record')).toBeInTheDocument();
    });

    it('says so when a workspace has never invited anyone', () => {
        render(<WorkspaceInvitations invitations={[]} now={now} />);

        expect(screen.getByText('This workspace has not invited anyone.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});

describe('the Admin workspace page', () => {
    const source = readFileSync(join(process.cwd(), 'app/(admin)/admin/organizations/[id]/page.tsx'), 'utf8');

    it('reads invitations without the token that lets someone join', () => {
        const query = source.slice(source.indexOf('FROM organization_invitations') - 400, source.indexOf('FROM organization_invitations'));
        expect(query).toContain('SELECT i.id, i.email, i.role, i.created_at, i.expires_at, i.accepted_at');
        expect(query).not.toMatch(/i\.\*|i\.token/);
    });

    it('shows seats in use, the over-seats warning and the plan end', () => {
        expect(source).toContain('Seats in use');
        expect(source).toContain('seats.membersOverSeats');
        expect(source).toContain('org.subscription_cancel_at');
        expect(source).toContain('<WorkspaceInvitations');
    });
});
