import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

import { OrgTable } from '@/components/admin/OrgTable';
import { RequestsTable } from '@/components/admin/RequestsTable';

describe('admin row inspection actions', () => {
    it('names icon-only request inspection links', () => {
        render(<RequestsTable requests={[{
            id: 'request-1',
            property_address: '123 Main Street',
            status: 'submitted',
            created_at: '2026-07-17T12:00:00.000Z',
        }]} />);

        expect(screen.getByRole('link', { name: /inspect request for 123 main street/i }))
            .toHaveAttribute('href', '/admin/requests/request-1');
    });

    it('names icon-only workspace inspection links', () => {
        render(<OrgTable orgs={[{
            id: 'workspace-1',
            name: 'North Star TC',
            slug: 'north-star-tc',
            logo_url: null,
            subscription_status: 'team',
            seat_quantity: 3,
            created_at: '2026-07-17T12:00:00.000Z',
            member_count: 2,
            admin_names: ['Morgan Lee'],
            admin_count: 1,
            workspace_kind: 'team_organization',
        }]} />);

        expect(screen.getByRole('link', { name: /inspect workspace north star tc/i }))
            .toHaveAttribute('href', '/admin/organizations/workspace-1');
    });
});
