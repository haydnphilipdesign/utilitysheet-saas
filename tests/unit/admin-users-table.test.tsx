import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUserRow } from '@/types';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/app/(admin)/admin/users/actions', () => ({
    updateUserRoleAction: vi.fn(),
    banUserAction: vi.fn(),
    unbanUserAction: vi.fn(),
    updateUserPlanAction: vi.fn(),
}));

import { UsersTable } from '@/app/(admin)/admin/users/users-table';

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

describe('UsersTable admin access controls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render a promote-to-admin action for standard users', () => {
        render(
            <UsersTable
                users={[buildUser()]}
                sortBy="created"
                sortDir="desc"
                sortHrefs={{
                    name: '/admin/users?sort=name',
                    email: '/admin/users?sort=email',
                    created: '/admin/users?sort=created',
                }}
                latestActions={{}}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /manage/i }));

        expect(screen.getByText('Latest Admin Activity')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /promote to admin/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /upgrade plan to pro/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ban user/i })).toBeInTheDocument();
    });
});
