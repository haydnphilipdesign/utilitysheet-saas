import { buildUtilitySheetTemplatePdf, utilitySheetTemplateFileName } from '@/lib/templates/utility-sheet-template';

// Built once at deploy time and served as a static file. The only valid
// path is /templates/utility-info-sheet.pdf; anything else is a 404.
export const dynamic = 'force-static';
export const dynamicParams = false;

const publicFileName = 'utility-info-sheet.pdf';

export function generateStaticParams() {
  return [{ file: publicFileName }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file !== publicFileName) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(buildUtilitySheetTemplatePdf(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${utilitySheetTemplateFileName}"`,
    },
  });
}
