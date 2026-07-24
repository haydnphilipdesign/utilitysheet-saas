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
    it('renders grouped navigation in a single labelled sidebar landmark', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        const nav = screen.getByRole('navigation', { name: /admin navigation/i });
        expect(nav).toBeInTheDocument();

        expect(screen.getByRole('heading', { name: 'Operations' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Growth & Content' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    });

    it('labels each navigation group with a resolvable id reference', () => {
        const { container } = render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        const lists = Array.from(container.querySelectorAll('nav ul[aria-labelledby]'));
        expect(lists).toHaveLength(4);

        for (const list of lists) {
            const ref = list.getAttribute('aria-labelledby') ?? '';
            // aria-labelledby is a whitespace-separated ID list, so a group name such as
            // "Growth & Content" must never be used verbatim as the id.
            expect(ref).not.toMatch(/\s/);
            expect(container.querySelector(`#${CSS.escape(ref)}`)).not.toBeNull();
        }
    });

    it('keeps stable admin routes behind their operational labels', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute('href', '/admin');
        expect(screen.getByRole('link', { name: /seller progress/i })).toHaveAttribute('href', '/admin/abandonment');
        expect(screen.getByRole('link', { name: /workspaces/i })).toHaveAttribute('href', '/admin/organizations');
        expect(screen.getByRole('link', { name: /customer outreach/i })).toHaveAttribute('href', '/admin/testimonial-candidates');
        expect(screen.queryByRole('link', { name: /top users/i })).not.toBeInTheDocument();
    });

    it('marks only the active destination', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        expect(screen.getByRole('link', { name: /workspaces/i })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: /^dashboard$/i })).not.toHaveAttribute('aria-current');
    });

    it('renders each navigation link exactly once so the sidebar is not duplicated for mobile', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        expect(screen.getAllByRole('link', { name: /^users$/i })).toHaveLength(1);
        expect(screen.getAllByRole('link', { name: /audit logs/i })).toHaveLength(1);
    });

    it('exposes exactly one back-to-app control', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        const backLinks = screen.getAllByRole('link', { name: /back to app/i });
        expect(backLinks).toHaveLength(1);
        expect(backLinks[0]).toHaveAttribute('href', '/dashboard');
    });

    it('provides an accessible collapsed navigation toggle', () => {
        render(<AdminLayoutContent><div>Admin page</div></AdminLayoutContent>);

        const toggle = screen.getByRole('button', { name: /open admin navigation/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveAttribute('aria-controls', screen.getByRole('navigation', { name: /admin navigation/i }).parentElement?.id ?? '');
    });
});
