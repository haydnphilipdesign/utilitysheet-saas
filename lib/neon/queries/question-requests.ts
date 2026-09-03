import { sql } from '@/lib/neon/db';

export type QuestionRequestContext = 'settings' | 'request_creation';
export type QuestionRequestPacketMode = 'simple' | 'advanced';

export async function createQuestionRequest(params: {
    accountId: string;
    organizationId: string | null;
    requestedText: string;
    context: QuestionRequestContext;
    packetMode?: QuestionRequestPacketMode;
}) {
    if (!sql) return;

    await sql`
        INSERT INTO question_requests (
            account_id,
            organization_id,
            requested_text,
            context,
            packet_mode
        ) VALUES (
            ${params.accountId},
            ${params.organizationId},
            ${params.requestedText},
            ${params.context},
            ${params.packetMode || null}
        )
    `;
}
