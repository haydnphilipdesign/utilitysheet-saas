import { renderOgImage } from '@/lib/seo/og-image';
import { ogPages, type OgPageSlug } from '@/lib/seo/og-pages';

// Rendered once at build time and served as static PNGs.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ogPages).map((page) => ({ page }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const entry = ogPages[page as OgPageSlug];
  if (!entry) {
    return new Response('Not found', { status: 404 });
  }
  return renderOgImage({ eyebrow: entry.eyebrow, title: entry.title });
}
