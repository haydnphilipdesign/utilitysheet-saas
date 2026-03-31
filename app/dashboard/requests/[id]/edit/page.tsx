import { SubmittedSheetEditor } from '@/components/requests/SubmittedSheetEditor';

export default async function EditSubmittedSheetPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return <SubmittedSheetEditor requestId={id} />;
}
