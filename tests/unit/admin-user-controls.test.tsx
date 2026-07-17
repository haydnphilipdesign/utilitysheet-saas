import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserRow } from '@/types';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/app/(admin)/admin/users/actions', () => ({
    updateUserRoleAction: vi.fn(),
    banUserAction: vi.fn(),
    unbanUserAction: vi.fn(),
    updateUserPlanAction: vi.fn(),
}));

import { AdminUserControls } from '@/components/admin/AdminUserControls';

function buildUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
    return {
        id: 'db4d40de-15fb-4576-ade1-7178af4150f9',
        auth_user_id: 'auth_123',
        email: 'marisa@example.com',
        full_name: 'Marisa Cirrincione',
        company_name: null,
        phone: null,
        active_organization_id: null,
        role: 'user',
        subscription_status: 'free',
        created_at: '2026-04-20T10:00:00.000Z',
        updated_at: '2026-04-20T10:00:00.000Z',
        ...overrides,
    };
}

describe('AdminUserControls', () => {
    beforeEach(() => vi.clearAllMocks());

    it('labels account plan writes as entitlement overrides and separates them from Stripe', () => {
        render(<AdminUserControls user={buildUser()} />);

        expect(screen.getByText('Entitlement override')).toBeInTheDocument();
        expect(screen.getByText(/does not create, cancel, or modify a stripe subscription/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /set pro entitlement/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /upgrade plan/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /set pro entitlement/i }));

        expect(screen.getByText(/internal entitlement override/i)).toBeInTheDocument();
        expect(screen.getByText(/stripe billing and subscription state will not be changed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /apply override/i })).toBeDisabled();
    });

    it('blocks account-level overrides in the UI for Team-managed accounts', () => {
        render(<AdminUserControls user={buildUser({ effective_subscription_status: 'team' })} />);

        expect(screen.getByText(/managed by an active team workspace/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /entitlement/i })).not.toBeInTheDocument();
    });
});
