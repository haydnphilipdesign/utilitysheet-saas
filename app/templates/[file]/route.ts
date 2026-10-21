import {
  buildUtilitySheetSamplePdf,
  buildUtilitySheetTemplatePdf,
  utilitySheetSampleFileName,
  utilitySheetTemplateFileName,
} from '@/lib/templates/utility-sheet-template';

// Built once at deploy time and served as static files. The only valid
// paths are the ones below; anything else is a 404.
export const dynamic = 'force-static';
export const dynamicParams = false;

const files: Record<string, { build: () => ArrayBuffer; downloadName: string }> = {
  'utility-info-sheet.pdf': { build: buildUtilitySheetTemplatePdf, downloadName: utilitySheetTemplateFileName },
  'utility-info-sheet-sample.pdf': { build: buildUtilitySheetSamplePdf, downloadName: utilitySheetSampleFileName },
};

export function generateStaticParams() {
  return Object.keys(files).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entry = Object.hasOwn(files, file) ? files[file] : undefined;
  if (!entry) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(entry.build(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${entry.downloadName}"`,
    },
  });
}
