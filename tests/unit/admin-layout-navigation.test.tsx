import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/organizations',
}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

vi.mock('@/components/ui/theme-toggle', () => ({
    ThemeToggle: () => <button type="button">Theme</button>,
}));

import { AdminLayoutContent } from '@/app/(admin)/layout-content';

describe('AdminLayoutContent', () => {
    it('groups stable admin routes and names the active workspace destination', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        expect(screen.getByText('Operations')).toBeInTheDocument();
        expect(screen.getByText('Customers')).toBeInTheDocument();
        expect(screen.getByText('Growth & Content')).toBeInTheDocument();
        expect(screen.getByText('Security')).toBeInTheDocument();

        expect(screen.getByRole('link', { name: /seller progress/i })).toHaveAttribute('href', '/admin/abandonment');
        expect(screen.getByRole('link', { name: /workspaces/i })).toHaveAttribute('href', '/admin/organizations');
        expect(screen.getByRole('link', { name: /customer outreach/i })).toHaveAttribute('href', '/admin/testimonial-candidates');
        expect(screen.queryByRole('link', { name: /top users/i })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /workspaces/i })).toHaveAttribute('aria-current', 'page');
    });

    it('gives the compact back control an accessible name', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        expect(screen.getAllByRole('link', { name: /back to utilitysheet app/i }).length).toBeGreaterThan(0);
    });
});
