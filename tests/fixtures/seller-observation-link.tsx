import React from 'react';

// Only used by the isolated seller-observation harness, never the Next application.
export default function Link({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
}
