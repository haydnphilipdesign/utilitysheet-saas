import { logDiagnostic } from '@/lib/telemetry/diagnostics';
import { getResend } from '@/lib/resend';
import { DEFAULT_BRAND_COLOR, DEFAULT_BRAND_SECONDARY_COLOR } from '@/lib/branding/deliverable';
import type { BrandProfile } from '@/types';
import { DEFAULT_MESSAGE_TEMPLATES, escapeHtml, firstNameFromFullName, plainTextToHtml, renderTemplate } from '@/lib/message-templates';
import { createPacketPdfAttachmentForRequest } from '@/lib/pdf/packet-attachment';
import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from '@/lib/feedback/constants';
import type { PdfRenderEvidence } from '@/lib/telemetry/handoff-evidence';
import { REQUEST_NEEDS_ATTENTION_DAYS } from '@/lib/requests/listing';

function getAppBaseUrl(): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        return appUrl.replace(/\/$/, '');
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    return 'http://localhost:3000';
}

function getDemoEmailRecipient(toEmail: string): string {
    const redirectTo = process.env.DEMO_EMAIL_REDIRECT_TO?.trim();
    if (!redirectTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(redirectTo)) {
        return toEmail;
    }

    const normalizedTo = toEmail.trim().toLowerCase();
    const isDemoRecipient =
        normalizedTo === 'demo.tc@utilitysheet.test' ||
        normalizedTo.endsWith('@utilitysheet.test');

    if (!isDemoRecipient) {
        return toEmail;
    }

    logDiagnostic('log', 'email_demo_redirect');
    return redirectTo;
}

interface SendSellerNotificationEmailParams {
    sellerEmail: string;
    sellerName?: string;
    propertyAddress: string;
    closingDate?: string;
    agentName?: string;
    brandProfile?: Pick<
        BrandProfile,
        | 'name'
        | 'logo_url'
        | 'primary_color'
        | 'secondary_color'
        | 'contact_name'
        | 'contact_email'
        | 'contact_phone'
        | 'company_name'
        | 'license_number'
        | 'license_state'
        | 'compliance_line'
        | 'message_templates'
    >;
    sellerToken: string;
}

function safeHexColor(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return trimmed;
    return fallback;
}

function safeExternalUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * The verified profile contact email, usable as a reply-to. Sellers who reply
 * reach the agent directly; the authenticated sending domain
 * (noreply@utilitysheet.com) is unchanged. Returns null for missing/malformed
 * addresses so the send simply omits reply-to.
 */
function safeReplyToEmail(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** Combine a license number and state into one display line, or null. */
function buildLicenseLine(licenseNumber?: string | null, licenseState?: string | null): string | null {
    const num = licenseNumber?.trim();
    const state = licenseState?.trim();
    if (num && state) return `License #${num} · ${state}`;
    if (num) return `License #${num}`;
    if (state) return `Licensed in ${state}`;
    return null;
}

/**
 * Accent for UtilitySheet's own product emails (completion, referral credit,
 * weekly summary, activation reminder): the app's slate-blue primary, same as
 * the default brand color. Emerald is reserved for success states. White text
 * on either color passes 4.5:1. Branded seller emails use the Branding Profile.
 */
const PRODUCT_EMAIL_ACCENT = DEFAULT_BRAND_COLOR;
const PRODUCT_EMAIL_ACCENT_DARK = DEFAULT_BRAND_SECONDARY_COLOR;
/** 10% of the accent on white, for neutral (non-success) badges. */
const PRODUCT_EMAIL_ACCENT_TINT = '#e9eef3';
/**
 * Email header background. The solid color comes first so clients that drop
 * gradients (Outlook desktop) still render one; pair it with a bgcolor
 * attribute on the cell. Callers pass sanitized hex colors only.
 */
function emailHeaderBackground(from: string, to: string, solid: string = from): string {
    return `background-color: ${solid}; background-image: linear-gradient(135deg, ${from} 0%, ${to} 100%);`;
}

const PRODUCT_EMAIL_HEADER_BACKGROUND = emailHeaderBackground(PRODUCT_EMAIL_ACCENT, PRODUCT_EMAIL_ACCENT_DARK);

function renderBulletproofButton(params: {
    href: string;
    label: string;
    backgroundColor: string;
    borderRadius?: number;
    fontSize?: number;
    fontWeight?: number;
    paddingX?: number;
    paddingY?: number;
    minWidth?: number;
    maxWidth?: number;
}): string {
    const borderRadius = params.borderRadius ?? 8;
    const fontSize = params.fontSize ?? 16;
    const fontWeight = params.fontWeight ?? 600;
    const paddingX = params.paddingX ?? 32;
    const paddingY = params.paddingY ?? 14;
    const lineHeight = Math.round(fontSize * 1.25);
    const buttonHeight = Math.round((paddingY * 2) + lineHeight);
    const minWidth = params.minWidth ?? 200;
    const maxWidth = params.maxWidth ?? 420;
    const estimatedWidth = Math.round((params.label.length * (fontSize * 0.62)) + (paddingX * 2));
    const buttonWidth = Math.max(minWidth, Math.min(maxWidth, estimatedWidth));
    const arcsize = `${Math.max(0, Math.min(50, Math.round((borderRadius / buttonHeight) * 100)))}%`;

    return `
                                        <!--[if mso]>
                                        <v:roundrect
                                            xmlns:v="urn:schemas-microsoft-com:vml"
                                            xmlns:w="urn:schemas-microsoft-com:office:word"
                                            href="${params.href}"
                                            style="height:${buttonHeight}px;v-text-anchor:middle;width:${buttonWidth}px;"
                                            arcsize="${arcsize}"
                                            stroke="f"
                                            fillcolor="${params.backgroundColor}"
                                        >
                                            <w:anchorlock/>
                                            <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:${fontSize}px;font-weight:${fontWeight};">
                                                ${params.label}
                                            </center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-- -->
                                        <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                            <tr>
                                                <td bgcolor="${params.backgroundColor}" style="background-color: ${params.backgroundColor}; border-radius: ${borderRadius}px; text-align: center;">
                                                    <a href="${params.href}" style="display: inline-block; padding: ${paddingY}px ${paddingX}px; border-radius: ${borderRadius}px; color: #ffffff !important; text-decoration: none; font-size: ${fontSize}px; font-weight: ${fontWeight}; line-height: ${lineHeight}px; font-family: Arial, sans-serif; background-color: ${params.backgroundColor}; mso-line-height-rule: exactly;">
                                                        ${params.label}
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <!--<![endif]-->
    `.trim();
}

const LEADING_GREETING_PATTERN = /^(hi|hello|hey|dear|greetings|good (morning|afternoon|evening))\b/i;

/**
 * Message templates usually open with their own greeting ("Hi{{...}},"). Use
 * that line in the greeting slot, verbatim, instead of adding a second one;
 * templates without a greeting keep the fallback.
 */
function splitLeadingGreeting(bodyText: string, fallbackGreeting: string): { greeting: string; bodyText: string } {
    const normalized = bodyText.replaceAll('\r\n', '\n').replace(/^\n+/, '');
    const [firstBlock, ...rest] = normalized.split(/\n{2,}/);
    const candidate = firstBlock?.trim() ?? '';
    if (rest.length > 0 && !candidate.includes('\n') && candidate.length <= 60 && LEADING_GREETING_PATTERN.test(candidate)) {
        return { greeting: candidate, bodyText: rest.join('\n\n') };
    }
    return { greeting: fallbackGreeting, bodyText };
}

function generateSellerRequestEmailHtml(params: {
    brandName: string;
    brandLogoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    title: string;
    badgeText: string;
    greeting: string;
    bodyText: string;
    propertyAddress: string;
    formattedClosingDate: string | null;
    ctaUrl: string;
    ctaLabel: string;
    agentName?: string;
    agentEmail?: string | null;
    agentPhone?: string | null;
    agentCompany?: string | null;
    agentLicenseLine?: string | null;
    complianceLine?: string | null;
}): string {
    const safeBrandName = escapeHtml(params.brandName);
    const safeBrandLogoUrl = params.brandLogoUrl ? escapeHtml(params.brandLogoUrl) : null;
    const safeTitle = escapeHtml(params.title);
    const safeBadgeText = escapeHtml(params.badgeText);
    const message = splitLeadingGreeting(params.bodyText, params.greeting);
    const safeGreeting = escapeHtml(message.greeting);
    const safePropertyAddress = escapeHtml(params.propertyAddress);
    const safeClosingDate = params.formattedClosingDate ? escapeHtml(params.formattedClosingDate) : null;
    const safeCtaUrl = escapeHtml(params.ctaUrl);
    const safeCtaLabel = escapeHtml(params.ctaLabel);
    const safeAgentName = params.agentName ? escapeHtml(params.agentName) : null;
    const safeAgentEmail = params.agentEmail ? escapeHtml(params.agentEmail) : null;
    const safeAgentPhone = params.agentPhone ? escapeHtml(params.agentPhone) : null;

    const headerLogoHtml = params.brandLogoUrl
        ? `<img src="${safeBrandLogoUrl}" alt="${safeBrandName}" style="height: 40px; width: auto;" />`
        : `<div style="font-size: 20px; font-weight: 700; color: #ffffff;">${safeBrandName}</div>`;

    const agentContactParts: string[] = [];
    if (safeAgentEmail) agentContactParts.push(`<a href="mailto:${safeAgentEmail}" style="color: ${params.primaryColor}; text-decoration: none;">${safeAgentEmail}</a>`);
    if (safeAgentPhone) agentContactParts.push(`${safeAgentPhone}`);

    const agentContactLine =
        safeAgentName && agentContactParts.length > 0
            ? `<p style="margin: 12px 0 0; color: #6b7280; font-size: 12px; line-height: 1.6;">Questions? Contact ${safeAgentName}${agentContactParts.length > 0 ? `: ${agentContactParts.join(' · ')}` : ''}.</p>`
            : '';

    const safeAgentCompany = params.agentCompany ? escapeHtml(params.agentCompany) : null;
    const safeAgentLicenseLine = params.agentLicenseLine ? escapeHtml(params.agentLicenseLine) : null;
    const safeComplianceLine = params.complianceLine ? escapeHtml(params.complianceLine) : null;
    const identityLines = [safeAgentCompany, safeAgentLicenseLine, safeComplianceLine].filter(Boolean);
    const identityLinesHtml = identityLines.length > 0
        ? `<p style="margin: 8px 0 0; color: #9ca3af; font-size: 11px; line-height: 1.6;">${identityLines.join('<br />')}</p>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td bgcolor="${params.primaryColor}" style="${emailHeaderBackground(params.primaryColor, params.secondaryColor)} padding: 28px 32px; text-align: center;">
                            ${headerLogoHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 32px 0; text-align: center;">
                            <div style="display: inline-block; background-color: #f3f4f6; color: #111827; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;">
                                ${safeBadgeText}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 32px 32px;">
                            <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">${safeGreeting}</p>

                            <div style="background-color: #f9fafb; border-radius: 10px; padding: 18px; margin: 16px 0 20px; border-left: 4px solid ${params.primaryColor};">
                                <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 700;">${safePropertyAddress}</p>
                                ${safeClosingDate ? `<p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;"><strong>Closing:</strong> ${safeClosingDate}</p>` : ''}
                            </div>

                            ${plainTextToHtml(message.bodyText)}

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 8px;">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
        href: safeCtaUrl,
        label: safeCtaLabel,
        backgroundColor: params.secondaryColor,
        borderRadius: 10,
        fontWeight: 700,
        paddingX: 28,
        paddingY: 14,
        minWidth: 220,
    })}
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 20px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                If the button doesn’t work, copy and paste this link into your browser:<br>
                                <a href="${safeCtaUrl}" style="color: ${params.primaryColor}; word-break: break-all;">${safeCtaUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 18px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sent via UtilitySheet.</p>
                            ${agentContactLine}
                            ${identityLinesHtml}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Sends an email notification to the seller when a new utility sheet request is created.
 * The email includes a link to the seller form where they can provide utility information.
 */
export async function sendSellerNotificationEmail({
    sellerEmail,
    sellerName,
    propertyAddress,
    closingDate,
    agentName,
    brandProfile,
    sellerToken,
}: SendSellerNotificationEmailParams): Promise<NotificationSendResult> {
    // Construct the seller form URL
    const baseUrl = getAppBaseUrl();
    const sellerFormUrl = `${baseUrl}/s/${sellerToken}`;

    // Format closing date if provided
    const formattedClosingDate = closingDate
        ? new Date(closingDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : null;

    const brandName = brandProfile?.name || 'UtilitySheet';
    const primaryColor = safeHexColor(brandProfile?.primary_color, DEFAULT_BRAND_COLOR);
    const secondaryColor = safeHexColor(brandProfile?.secondary_color, DEFAULT_BRAND_SECONDARY_COLOR);
    const brandLogoUrl = safeExternalUrl(brandProfile?.logo_url);

    const effectiveAgentName = agentName || brandProfile?.contact_name || 'Your real estate team';
    const variables = {
        seller_name: sellerName || '',
        seller_first_name_with_space: (() => {
            const first = firstNameFromFullName(sellerName);
            return first ? ` ${first}` : '';
        })(),
        agent_name: effectiveAgentName,
        property_address: propertyAddress,
        closing_date: formattedClosingDate || '',
        link: sellerFormUrl,
    };

    const subjectTemplate =
        brandProfile?.message_templates?.seller_request?.email?.subject?.trim()
            ? brandProfile.message_templates.seller_request!.email!.subject!
            : (DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.subject || '');

    const bodyTemplate =
        brandProfile?.message_templates?.seller_request?.email?.body?.trim()
            ? brandProfile.message_templates.seller_request!.email!.body!
            : (DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.body || '');

    const buttonTextTemplate =
        brandProfile?.message_templates?.seller_request?.email?.button_text?.trim()
            ? brandProfile.message_templates.seller_request!.email!.button_text!
            : (DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.button_text || 'Complete');

    const subject = renderTemplate(subjectTemplate, variables);
    const bodyText = renderTemplate(bodyTemplate, variables);
    const ctaLabel = renderTemplate(buttonTextTemplate, variables);

    const greeting = (() => {
        const first = firstNameFromFullName(sellerName);
        return first ? `Hi ${first},` : 'Hello,';
    })();

    const emailHtml = generateSellerRequestEmailHtml({
        brandName,
        brandLogoUrl,
        primaryColor,
        secondaryColor,
        title: 'Utility Information Needed',
        badgeText: 'A quick request',
        greeting,
        bodyText,
        propertyAddress,
        formattedClosingDate,
        ctaUrl: sellerFormUrl,
        ctaLabel,
        agentName: effectiveAgentName,
        agentEmail: brandProfile?.contact_email || null,
        agentPhone: brandProfile?.contact_phone || null,
        agentCompany: brandProfile?.company_name || null,
        agentLicenseLine: buildLicenseLine(brandProfile?.license_number, brandProfile?.license_state),
        complianceLine: brandProfile?.compliance_line || null,
    });

    const replyTo = safeReplyToEmail(brandProfile?.contact_email);

    try {
        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: sellerEmail,
            subject,
            html: emailHtml,
            ...(replyTo ? { replyTo } : {}),
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'seller_notification' }, error);
            return { success: false, error: error.message, errorCode: error.name };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'seller_notification' });
        return { success: true, messageId: data?.id };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'seller_notification' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            threw: true,
        };
    }
}

/**
 * Outcome of one invitation or completion send, with enough to record
 * handoff evidence. A refusal can be returned (not thrown): callers must read
 * `success` rather than rely on catching.
 */
export type NotificationSendResult = {
    success: boolean;
    error?: string;
    /** Provider message ID when the provider accepted the message. */
    messageId?: string;
    /** Provider error name for a returned (not thrown) rejection. */
    errorCode?: string;
    /** True when the request threw before any provider response (timeout, network, configuration). */
    threw?: boolean;
};

export type SellerReminderEmail = {
    from: string;
    to: string;
    subject: string;
    html: string;
    replyTo: string | null;
};

export type SellerReminderSendResult = {
    success: boolean;
    error?: string;
    /** Provider message ID when the provider accepted the message. */
    messageId?: string;
    /** Provider error name for a returned (not thrown) rejection. */
    errorCode?: string;
    /** True when the request threw before any provider response (timeout, network, configuration). */
    threw?: boolean;
};

const SELLER_REMINDER_FROM = 'UtilitySheet <noreply@utilitysheet.com>';

/**
 * Deterministic seller reminder rendering. The Admin preview and every send
 * call this one function, so the reviewed subject, body, branding, sender and
 * reply-to are exactly what is sent.
 */
export function buildSellerReminderEmail({
    sellerEmail,
    sellerName,
    propertyAddress,
    closingDate,
    agentName,
    brandProfile,
    sellerToken,
}: SendSellerNotificationEmailParams): SellerReminderEmail {
    const baseUrl = getAppBaseUrl();
    const sellerFormUrl = `${baseUrl}/s/${sellerToken}`;

    const formattedClosingDate = closingDate
        ? new Date(closingDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : null;

    const brandName = brandProfile?.name || 'UtilitySheet';
    const primaryColor = safeHexColor(brandProfile?.primary_color, DEFAULT_BRAND_COLOR);
    const secondaryColor = safeHexColor(brandProfile?.secondary_color, DEFAULT_BRAND_SECONDARY_COLOR);
    const brandLogoUrl = safeExternalUrl(brandProfile?.logo_url);

    const effectiveAgentName = agentName || brandProfile?.contact_name || 'Your real estate team';
    const variables = {
        seller_name: sellerName || '',
        seller_first_name_with_space: (() => {
            const first = firstNameFromFullName(sellerName);
            return first ? ` ${first}` : '';
        })(),
        agent_name: effectiveAgentName,
        property_address: propertyAddress,
        closing_date: formattedClosingDate || '',
        link: sellerFormUrl,
    };

    const subjectTemplate =
        brandProfile?.message_templates?.seller_reminder?.email?.subject?.trim()
            ? brandProfile.message_templates.seller_reminder!.email!.subject!
            : (DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.subject || '');

    const bodyTemplate =
        brandProfile?.message_templates?.seller_reminder?.email?.body?.trim()
            ? brandProfile.message_templates.seller_reminder!.email!.body!
            : (DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.body || '');

    const buttonTextTemplate =
        brandProfile?.message_templates?.seller_reminder?.email?.button_text?.trim()
            ? brandProfile.message_templates.seller_reminder!.email!.button_text!
            : (DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.button_text || 'Continue');

    const subject = renderTemplate(subjectTemplate, variables);
    const bodyText = renderTemplate(bodyTemplate, variables);
    const ctaLabel = renderTemplate(buttonTextTemplate, variables);

    const greeting = (() => {
        const first = firstNameFromFullName(sellerName);
        return first ? `Hi ${first},` : 'Hello,';
    })();

    const emailHtml = generateSellerRequestEmailHtml({
        brandName,
        brandLogoUrl,
        primaryColor,
        secondaryColor,
        title: 'Utility Information Reminder',
        badgeText: 'Reminder',
        greeting,
        bodyText,
        propertyAddress,
        formattedClosingDate,
        ctaUrl: sellerFormUrl,
        ctaLabel,
        agentName: effectiveAgentName,
        agentEmail: brandProfile?.contact_email || null,
        agentPhone: brandProfile?.contact_phone || null,
        agentCompany: brandProfile?.company_name || null,
        agentLicenseLine: buildLicenseLine(brandProfile?.license_number, brandProfile?.license_state),
        complianceLine: brandProfile?.compliance_line || null,
    });

    return {
        from: SELLER_REMINDER_FROM,
        to: sellerEmail,
        subject,
        html: emailHtml,
        replyTo: safeReplyToEmail(brandProfile?.contact_email),
    };
}

/** Sends an already-built reminder. Retries of one operation must reuse its idempotency key. */
export async function sendBuiltSellerReminderEmail(
    email: SellerReminderEmail,
    options: { idempotencyKey?: string } = {}
): Promise<SellerReminderSendResult> {
    try {
        const { data, error } = await getResend().emails.send(
            {
                from: email.from,
                to: email.to,
                subject: email.subject,
                html: email.html,
                ...(email.replyTo ? { replyTo: email.replyTo } : {}),
            },
            options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined
        );

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'seller_reminder' }, error);
            return { success: false, error: error.message, errorCode: error.name };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'seller_reminder' });
        return { success: true, messageId: data?.id };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'seller_reminder' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            threw: true,
        };
    }
}

/**
 * Sends a reminder email to the seller for an existing utility sheet request.
 */
export async function sendSellerReminderEmail(
    params: SendSellerNotificationEmailParams
): Promise<SellerReminderSendResult> {
    return sendBuiltSellerReminderEmail(buildSellerReminderEmail(params));
}

interface SendOrganizationInviteEmailParams {
    toEmail: string;
    organizationName: string;
    invitedByName?: string;
    inviteUrl: string;
    /** When the link stops working; the email says so when it is given. */
    expiresAt?: Date | string | null;
}

/** The invitation email's subject and HTML. Names are escaped; they are typed by customers. */
export function buildOrganizationInviteEmail({
    toEmail,
    organizationName,
    invitedByName,
    inviteUrl,
    expiresAt,
}: SendOrganizationInviteEmailParams): { subject: string; html: string } {
    const workspace = escapeHtml(organizationName);
    const address = escapeHtml(toEmail);
    const link = escapeHtml(inviteUrl);
    const invitedLine = invitedByName
        ? `${escapeHtml(invitedByName)} invited you to join <strong>${workspace}</strong> on UtilitySheet.`
        : `You’ve been invited to join <strong>${workspace}</strong> on UtilitySheet.`;
    // Days, not a date: the reader's time zone is not known here.
    const expiryTime = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
    const daysLeft = Math.round((expiryTime - Date.now()) / (24 * 60 * 60 * 1000));
    const expiry = Number.isFinite(daysLeft) && daysLeft >= 1
        ? ` The link works for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`
        : '';
    // Header values are not HTML, but must stay on one line.
    const subject = `${invitedByName ? `${invitedByName} invited you` : 'You’re invited'} to join ${organizationName} on UtilitySheet`
        .replace(/[\r\n]+/g, ' ');
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${workspace} on UtilitySheet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td bgcolor="#0f172a" style="${emailHeaderBackground('#0f172a', '#334155')} padding: 28px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">UtilitySheet</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 36px 40px;">
                            <p style="margin: 0 0 16px; color: #111827; font-size: 16px; line-height: 1.6;">
                                ${invitedLine}
                            </p>
                            <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
                                UtilitySheet collects utility and home details from sellers and turns them into a clean sheet to hand off. In this workspace you’ll share your team’s requests and branding.
                            </p>
                            <p style="margin: 0 0 24px; color: #374151; font-size: 15px; line-height: 1.6;">
                                Sign in or create an account with <strong>${address}</strong>. The invitation only works with this address.${expiry}
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
            href: inviteUrl,
            label: 'Accept invitation',
            backgroundColor: '#334155',
            borderRadius: 10,
            fontWeight: 700,
            paddingX: 28,
            paddingY: 14,
            minWidth: 220,
        })}
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                If the button doesn’t work, copy and paste this link into your browser:<br>
                                <a href="${link}" style="color: #0f172a; word-break: break-all;">${link}</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 18px 40px; background-color: #f9fafb; text-align: center;">
                            <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                                If you weren’t expecting this invitation, you can ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

    return { subject, html };
}

export async function sendOrganizationInviteEmail(
    params: SendOrganizationInviteEmailParams
): Promise<{ success: boolean; error?: string }> {
    const { subject, html } = buildOrganizationInviteEmail(params);

    try {
        const { error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: params.toEmail,
            subject,
            html,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'organization_invite' }, error);
            return { success: false, error: error.message };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'organization_invite' });
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'organization_invite' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

interface OrganizationInviteAcceptedEmailParams {
    toEmail: string;
    organizationName: string;
    memberName?: string | null;
    memberEmail: string;
}

/** Tells the person who sent an invitation that it was accepted. Names are escaped. */
export function buildOrganizationInviteAcceptedEmail({
    organizationName,
    memberName,
    memberEmail,
}: OrganizationInviteAcceptedEmailParams): { subject: string; html: string } {
    const displayName = memberName?.trim() || memberEmail;
    const workspace = escapeHtml(organizationName);
    const who = escapeHtml(displayName);
    const address = memberName?.trim() ? ` (${escapeHtml(memberEmail)})` : '';
    const settingsUrl = `${getAppBaseUrl()}/dashboard/settings?tab=workspace`;
    const subject = `${displayName} joined ${organizationName} on UtilitySheet`.replace(/[\r\n]+/g, ' ');
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${who} joined ${workspace}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td bgcolor="#0f172a" style="${emailHeaderBackground('#0f172a', '#334155')} padding: 28px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">UtilitySheet</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 36px 40px;">
                            <p style="margin: 0 0 16px; color: #111827; font-size: 16px; line-height: 1.6;">
                                <strong>${who}</strong>${address} accepted your invitation and is now a member of <strong>${workspace}</strong>.
                            </p>
                            <p style="margin: 0 0 24px; color: #374151; font-size: 15px; line-height: 1.6;">
                                They can see and work on the workspace’s requests and Branding Profiles. You can change their role or remove them in Settings, under Workspace &amp; Team.
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
            href: settingsUrl,
            label: 'Open Workspace &amp; Team',
            backgroundColor: '#334155',
            borderRadius: 10,
            fontWeight: 700,
            paddingX: 28,
            paddingY: 14,
            minWidth: 220,
        })}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

    return { subject, html };
}

export async function sendOrganizationInviteAcceptedEmail(
    params: OrganizationInviteAcceptedEmailParams
): Promise<{ success: boolean; error?: string }> {
    const { subject, html } = buildOrganizationInviteAcceptedEmail(params);

    try {
        const { error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: params.toEmail,
            subject,
            html,
        });
        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'invitation_accepted' }, error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'invitation_accepted' }, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

interface SendFeedbackEmailParams {
    userEmail: string | null;
    message: string;
    userId?: string;
    userName?: string;
    category?: FeedbackCategory;
    pagePath?: string | null;
    /** True when the message is also in the Admin feedback inbox. */
    stored?: boolean;
}

/**
 * Sends a feedback email to the admin/support team.
 * Every customer-controlled value is escaped before it reaches the HTML body.
 */
export async function sendFeedbackEmail({
    userEmail,
    message,
    userId,
    userName,
    category = 'general',
    pagePath,
    stored = false,
}: SendFeedbackEmailParams): Promise<{ success: boolean; error?: string }> {
    try {
        const feedbackEmail = process.env.FEEDBACK_EMAIL;

        if (!feedbackEmail) {
            logDiagnostic('warn', 'email_not_configured', { operation: 'feedback' });
            return { success: false, error: 'Configuration error' };
        }

        const sender = userName || userEmail || 'a customer';
        const safeEmail = userEmail ? escapeHtml(userEmail) : 'No email on file';
        const safeFrom = userName ? `${escapeHtml(userName)} (${safeEmail})` : safeEmail;
        const categoryLabel = FEEDBACK_CATEGORY_LABELS[category];

        const { error } = await getResend().emails.send({
            from: 'UtilitySheet Feedback <feedback@utilitysheet.com>',
            to: feedbackEmail,
            ...(userEmail ? { replyTo: userEmail } : {}),
            subject: `New Feedback (${categoryLabel}) from ${sender}`.replace(/[\r\n]+/g, ' '),
            html: `
                <div>
                    <h2>New Feedback Received</h2>
                    <p><strong>From:</strong> ${safeFrom}</p>
                    ${userId ? `<p><strong>User ID:</strong> ${escapeHtml(userId)}</p>` : ''}
                    <p><strong>Type:</strong> ${escapeHtml(categoryLabel)}</p>
                    ${pagePath ? `<p><strong>Page:</strong> ${escapeHtml(pagePath)}</p>` : ''}
                    <hr />
                    <h3>Message:</h3>
                    <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
                    ${stored ? `<hr /><p><a href="${escapeHtml(getAppBaseUrl())}/admin/feedback">Open the feedback inbox</a></p>` : ''}
                </div>
            `,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'feedback' }, error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'feedback' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

interface SendTCCompletionNotificationEmailParams {
    tcEmail: string;
    tcName?: string;
    propertyAddress: string;
    sellerName?: string;
    requestId: string;
    attachPdf?: boolean;
    /**
     * Renders the "collected with UtilitySheet" referral footer. Only enabled for
     * free-plan workspaces so paid white-label output stays free of UtilitySheet
     * branding when these emails are forwarded across a closing.
     */
    showReferralFooter?: boolean;
    referralCode?: string | null;
    isTestDrive?: boolean;
}

type CompletionAttachmentStatus = 'attached' | 'skipped' | 'failed' | 'disabled';

/**
 * Sends an email notification to the TC when a seller completes their utility form.
 */
export async function sendTCCompletionNotificationEmail({
    tcEmail,
    tcName,
    propertyAddress,
    sellerName,
    requestId,
    attachPdf = false,
    showReferralFooter = false,
    referralCode = null,
    isTestDrive = false,
}: SendTCCompletionNotificationEmailParams): Promise<NotificationSendResult & {
    attachmentStatus: CompletionAttachmentStatus;
    /** What the PDF execution did, when one was attempted for this recipient. */
    pdfEvidence?: PdfRenderEvidence | null;
}> {
    // Construct the dashboard URL to view the completed request
    const baseUrl = getAppBaseUrl();
    const dashboardUrl = `${baseUrl}/dashboard/requests/${requestId}`;

    logDiagnostic('log', 'email_send_started', { operation: 'completion_notification', requestId });

    const emailHtml = generateTCCompletionNotificationHtml({
        tcName,
        propertyAddress,
        sellerName,
        dashboardUrl,
        referralFooterUrl: showReferralFooter
            ? buildCompletionReferralFooterUrl(baseUrl, referralCode)
            : null,
        referralProgramUrl: isTestDrive ? null : `${baseUrl}/dashboard/settings?tab=referrals`,
        isTestDrive,
    });

    // Declared outside the try so a send that throws still reports what
    // really happened to the attachment.
    let attachmentStatus: CompletionAttachmentStatus = attachPdf ? 'skipped' : 'disabled';
    let attachmentResolved = !attachPdf;
    let pdfEvidence: PdfRenderEvidence | null = null;

    try {
        let attachments:
            | Array<{ filename: string; content: Buffer; contentType?: string }>
            | undefined;

        if (attachPdf) {
            logDiagnostic('log', 'email_attachment_attempted', { requestId });
            const attachmentResult = await createPacketPdfAttachmentForRequest(requestId);
            attachmentResolved = true;
            pdfEvidence = attachmentResult.evidence ?? null;

            if (attachmentResult.status === 'attached') {
                attachmentStatus = 'attached';
                const { attachment } = attachmentResult;
                attachments = [{
                    filename: attachment.filename,
                    content: attachment.content,
                    contentType: attachment.contentType,
                }];
                logDiagnostic('log', 'email_attachment_generated', {
                    requestId,
                    bytes: attachment.content.byteLength,
                });
            } else if (attachmentResult.status === 'skipped') {
                attachmentStatus = 'skipped';
                logDiagnostic('log', 'email_attachment_skipped', {
                    requestId,
                    reason: attachmentResult.reason,
                });
            } else {
                attachmentStatus = 'failed';
                logDiagnostic('warn', 'email_attachment_failed', { requestId });
            }
        } else {
            logDiagnostic('log', 'email_attachment_skipped', {
                requestId,
                reason: 'disabled',
            });
        }

        const resend = getResend();
        const { data, error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: getDemoEmailRecipient(tcEmail),
            subject: isTestDrive
                ? `Your test sheet is ready: ${propertyAddress}`
                : `Utility Info Submitted for ${propertyAddress}`,
            html: emailHtml,
            attachments,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'completion_notification' }, error);
            return { success: false, error: error.message, errorCode: error.name, attachmentStatus, pdfEvidence };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'completion_notification' });
        return { success: true, messageId: data?.id, attachmentStatus, pdfEvidence };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'completion_notification' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            threw: true,
            // An attachment step that itself threw has failed; otherwise keep its real outcome.
            attachmentStatus: attachmentResolved ? attachmentStatus : 'failed',
            pdfEvidence,
        };
    }
}

function buildCompletionReferralFooterUrl(baseUrl: string, referralCode: string | null): string {
    const params = new URLSearchParams({
        utm_source: 'utilitysheet_email',
        utm_medium: 'product_referral',
        utm_campaign: 'transaction_exposure',
        utm_content: 'completion-email',
    });
    if (referralCode) {
        params.set('ref', referralCode);
    }
    return `${baseUrl}/from-a-closing?${params.toString()}`;
}

interface GenerateTCCompletionHtmlParams {
    tcName?: string;
    propertyAddress: string;
    sellerName?: string;
    dashboardUrl: string;
    referralFooterUrl?: string | null;
    referralProgramUrl?: string | null;
    isTestDrive?: boolean;
}

function generateTCCompletionNotificationHtml({
    tcName,
    propertyAddress,
    sellerName,
    dashboardUrl,
    referralFooterUrl = null,
    referralProgramUrl = null,
    isTestDrive = false,
}: GenerateTCCompletionHtmlParams): string {
    const greeting = tcName ? `Hi ${tcName},` : 'Hello,';
    const sellerMention = sellerName ? `${sellerName} has` : 'The seller has';
    const referralFooterHtml = referralFooterUrl
        ? `
                            <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; line-height: 1.6;">
                                This utility sheet was collected automatically with UtilitySheet.
                                Coordinating a closing?
                                <a href="${referralFooterUrl}" style="color: #475569; font-weight: 600;">Create your own free seller utility link</a>.
                            </p>`
        : '';
    const referralProgramHtml = referralProgramUrl
        ? `
                            <div style="margin: 28px 0 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
                                    <strong>Give a month of Pro, get a month of Pro.</strong>
                                    Know another TC or agent who still chases utility info?
                                    <a href="${referralProgramUrl}" style="color: #475569; font-weight: 600;">Share your referral link</a>
                                    and you both get a free month when their first seller submission arrives.
                                </p>
                            </div>`
        : '';
    const testDriveIntro = isTestDrive
        ? `
                            <div style="margin: 0 0 20px; padding: 12px 16px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                                <strong>This is your test sheet.</strong> The property and seller details are made up, so you can see exactly what a real one looks like.
                            </div>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Utility Information Submitted</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td bgcolor="${PRODUCT_EMAIL_ACCENT}" style="${PRODUCT_EMAIL_HEADER_BACKGROUND} padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">UtilitySheet</h1>
                        </td>
                    </tr>
                    
                    <!-- Success Badge -->
                    <tr>
                        <td style="padding: 32px 40px 0; text-align: center;">
                            <div style="display: inline-block; background-color: #d1fae5; color: #065f46; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                ${isTestDrive ? '✓ Test Complete' : '✓ Submission Complete'}
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 24px 40px 40px;">
                            ${testDriveIntro}
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${sellerMention} completed the utility information form for:
                            </p>
                            
                            <!-- Property Card -->
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${PRODUCT_EMAIL_ACCENT};">
                                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">
                                    ${propertyAddress}
                                </p>
                            </div>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${isTestDrive
            ? 'You can now review the finished test sheet and download its PDF. When you are ready for a real transaction, add your reusable seller link to your listing email, checklist, or transaction template.'
            : 'You can now review the utility sheet, download the PDF, and share it. On Pro and Teams, you can also correct details from the dashboard without sending the form back to the seller.'}
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
        href: dashboardUrl,
        label: isTestDrive ? 'Review test sheet' : 'Review Submitted Sheet',
        backgroundColor: PRODUCT_EMAIL_ACCENT,
        borderRadius: 8,
        fontWeight: 600,
        paddingX: 32,
        paddingY: 14,
        minWidth: 240,
    })}
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${dashboardUrl}" style="color: ${PRODUCT_EMAIL_ACCENT}; word-break: break-all;">${dashboardUrl}</a>
                            </p>${referralProgramHtml}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">${referralFooterHtml}
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This email was sent by UtilitySheet.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// =============================================================================
// REFERRAL CREDIT EARNED EMAIL
// =============================================================================

export type ReferralCreditEarnedStatus = 'applied' | 'waiting_for_upgrade' | 'saved';

interface SendReferralCreditEarnedEmailParams {
    toEmail: string;
    toName?: string;
    /**
     * applied: credit already landed on the referrer's Stripe balance.
     * waiting_for_upgrade: referrer has no subscription; credit applies once they upgrade.
     * saved: referrer is subscribed but the credit could not be applied yet (it retries automatically).
     */
    creditStatus: ReferralCreditEarnedStatus;
}

/**
 * Tells a referrer their referral just activated and they earned a free month
 * of Pro. Sent at most once per referred account (the award query only returns
 * a credit on first insert).
 */
export async function sendReferralCreditEarnedEmail({
    toEmail,
    toName,
    creditStatus,
}: SendReferralCreditEarnedEmailParams): Promise<{ success: boolean; error?: string }> {
    const baseUrl = getAppBaseUrl();
    const referralSettingsUrl = `${baseUrl}/dashboard/settings?tab=referrals`;
    const emailHtml = generateReferralCreditEarnedHtml({
        toName,
        creditStatus,
        referralSettingsUrl,
    });

    try {
        const resend = getResend();
        const { error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: getDemoEmailRecipient(toEmail),
            subject: 'You earned a free month of Pro',
            html: emailHtml,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'referral_credit' }, error);
            return { success: false, error: error.message };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'referral_credit' });
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'referral_credit' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

function generateReferralCreditEarnedHtml({
    toName,
    creditStatus,
    referralSettingsUrl,
}: {
    toName?: string;
    creditStatus: ReferralCreditEarnedStatus;
    referralSettingsUrl: string;
}): string {
    const greeting = toName ? `Hi ${toName},` : 'Hello,';
    const statusCopy = creditStatus === 'applied'
        ? 'Your credit has been applied to your subscription. You will see it on your next invoice.'
        : creditStatus === 'waiting_for_upgrade'
            ? 'Your free month is saved to your account. Upgrade to Pro and it applies to your bill automatically.'
            : 'Your free month is saved to your account and will be applied to your subscription automatically.';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You earned a free month of Pro</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td bgcolor="${PRODUCT_EMAIL_ACCENT}" style="${PRODUCT_EMAIL_HEADER_BACKGROUND} padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">UtilitySheet</h1>
                        </td>
                    </tr>

                    <!-- Badge -->
                    <tr>
                        <td style="padding: 32px 40px 0; text-align: center;">
                            <div style="display: inline-block; background-color: #d1fae5; color: #065f46; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                Free month earned
                            </div>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 24px 40px 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Someone you referred just received their first real seller submission. That earns you one free month of Pro.
                            </p>

                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${statusCopy}
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
        href: referralSettingsUrl,
        label: 'See your referral credits',
        backgroundColor: PRODUCT_EMAIL_ACCENT,
        borderRadius: 8,
        fontWeight: 600,
        paddingX: 32,
        paddingY: 14,
        minWidth: 240,
    })}
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Keep sharing your referral link to earn more free months, up to 12 a year.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This email was sent by UtilitySheet.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// =============================================================================
// CONTACT RESOLUTION ALERT EMAIL
// =============================================================================

interface SendContactResolutionAlertEmailParams {
    tcEmail: string;
    tcName?: string;
    propertyAddress: string;
    unresolvedEntries: { category: string; displayName?: string }[];
    requestId: string;
}

/**
 * Sends an alert email to the TC when a seller submission contains
 * utility entries that couldn't be resolved to known providers.
 */
export async function sendContactResolutionAlertEmail({
    tcEmail,
    tcName,
    propertyAddress,
    unresolvedEntries,
    requestId,
}: SendContactResolutionAlertEmailParams): Promise<{ success: boolean; error?: string }> {
    const baseUrl = getAppBaseUrl();
    const dashboardUrl = `${baseUrl}/dashboard/requests/${requestId}`;

    const emailHtml = generateContactResolutionAlertHtml({
        tcName,
        propertyAddress,
        unresolvedEntries,
        dashboardUrl,
    });

    try {
        const resend = getResend();
        const { error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: tcEmail,
            subject: `Provider contact details missing for ${propertyAddress}`,
            html: emailHtml,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'contact_resolution_alert' }, error);
            return { success: false, error: error.message };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'contact_resolution_alert' });
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'contact_resolution_alert' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

interface GenerateContactResolutionAlertHtmlParams {
    tcName?: string;
    propertyAddress: string;
    unresolvedEntries: { category: string; displayName?: string }[];
    dashboardUrl: string;
}

function generateContactResolutionAlertHtml({
    tcName,
    propertyAddress,
    unresolvedEntries,
    dashboardUrl,
}: GenerateContactResolutionAlertHtmlParams): string {
    const greeting = tcName ? `Hi ${tcName},` : 'Hello,';

    const entriesList = unresolvedEntries
        .map(e => `<li style="margin: 8px 0; color: #374151;"><strong>${e.category}:</strong> ${e.displayName || 'No name given'}</li>`)
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Provider contact details missing</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td bgcolor="#d97706" style="${emailHeaderBackground('#f59e0b', '#d97706', '#d97706')} padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">UtilitySheet Alert</h1>
                        </td>
                    </tr>
                    
                    <!-- Alert Badge -->
                    <tr>
                        <td style="padding: 32px 40px 0; text-align: center;">
                            <div style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                ⚠️ Needs Attention
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 24px 40px 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                A seller submitted utility details for <strong>${propertyAddress}</strong>, but we couldn’t find a phone number or website for these providers:
                            </p>
                            
                            <!-- Unresolved Entries List -->
                            <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0 0 12px; color: #92400e; font-size: 14px; font-weight: 600;">
                                    Providers without contact details:
                                </p>
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${entriesList}
                                </ul>
                            </div>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                You may need to look these up yourself before you share the sheet.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
        href: dashboardUrl,
        label: 'Review the sheet',
        backgroundColor: '#b45309',
        borderRadius: 8,
        fontWeight: 600,
        paddingX: 32,
        paddingY: 14,
        minWidth: 240,
    })}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This email was sent by UtilitySheet. You can turn these alerts off in Settings, under Notifications.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// =============================================================================
// WEEKLY SUMMARY EMAIL
// =============================================================================

interface WeeklyStats {
    totalRequests: number;
    submitted: number;
    sent: number;
    inProgress: number;
    needsAttention: number;
}

interface SendWeeklySummaryEmailParams {
    tcEmail: string;
    tcName?: string;
    stats: WeeklyStats;
}

/**
 * Sends a weekly summary email to a TC with their activity stats.
 */
export async function sendWeeklySummaryEmail({
    tcEmail,
    tcName,
    stats,
}: SendWeeklySummaryEmailParams): Promise<{ success: boolean; error?: string }> {
    const baseUrl = getAppBaseUrl();
    const dashboardUrl = `${baseUrl}/dashboard`;

    const emailHtml = generateWeeklySummaryHtml({
        tcName,
        stats,
        dashboardUrl,
    });

    try {
        const resend = getResend();
        const { error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: tcEmail,
            subject: `📊 Your Weekly UtilitySheet Summary`,
            html: emailHtml,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'weekly_summary' }, error);
            return { success: false, error: error.message };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'weekly_summary' });
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'weekly_summary' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

interface GenerateWeeklySummaryHtmlParams {
    tcName?: string;
    stats: WeeklyStats;
    dashboardUrl: string;
}

function generateWeeklySummaryHtml({
    tcName,
    stats,
    dashboardUrl,
}: GenerateWeeklySummaryHtmlParams): string {
    const greeting = tcName ? `Hi ${tcName},` : 'Hello,';

    const hasActivity = stats.totalRequests > 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td bgcolor="${PRODUCT_EMAIL_ACCENT}" style="${PRODUCT_EMAIL_HEADER_BACKGROUND} padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Weekly Summary</h1>
                            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Your UtilitySheet activity this week</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${hasActivity
            ? 'Here\'s a summary of your utility request activity this week:'
            : 'You didn\'t have any utility request activity this week. Ready to get started?'
        }
                            </p>
                            
                            ${hasActivity ? `
                            <!-- Stats Grid -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                                <tr>
                                    <td style="padding: 16px; background-color: #f9fafb; border-radius: 8px 0 0 8px; text-align: center; border-right: 1px solid #e5e7eb;">
                                        <p style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">${stats.totalRequests}</p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Total</p>
                                    </td>
                                    <td style="padding: 16px; background-color: #f9fafb; text-align: center; border-right: 1px solid #e5e7eb;">
                                        <p style="margin: 0; color: #047857; font-size: 28px; font-weight: 700;">${stats.submitted}</p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Completed</p>
                                    </td>
                                    <td style="padding: 16px; background-color: #f9fafb; border-radius: 0 8px 8px 0; text-align: center;">
                                        <p style="margin: 0; color: #3b82f6; font-size: 28px; font-weight: 700;">${stats.sent + stats.inProgress}</p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Pending</p>
                                    </td>
                                </tr>
                            </table>
                            
                            ${stats.needsAttention > 0 ? `
                            <!-- Attention Card -->
                            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0; color: #92400e; font-size: 14px;">
                                    <strong>⚠️ ${stats.needsAttention} request${stats.needsAttention > 1 ? 's' : ''}</strong> with no seller activity for ${REQUEST_NEEDS_ATTENTION_DAYS} days. Consider sending the link again or a reminder.
                                </p>
                            </div>
                            ` : ''}
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding-top: 16px;">
                                        ${renderBulletproofButton({
        href: dashboardUrl,
        label: 'Go to Dashboard',
        backgroundColor: PRODUCT_EMAIL_ACCENT,
        borderRadius: 8,
        fontWeight: 600,
        paddingX: 32,
        paddingY: 14,
        minWidth: 220,
    })}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This email was sent by UtilitySheet. You can disable weekly summaries in Settings.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

type ActivationReminderStage = 'after_15m' | 'after_1d';

// Replies to onboarding emails reach a person; noreply@ is only the sender.
const ACTIVATION_REPLY_TO = 'haydn@multimedium.dev';

// Same wording as the dashboard's "Text" share action.
function sellerTextMessage(sellerLinkUrl: string) {
    return `Hi, please use this link to fill in the utility providers for your property. No account is needed: ${sellerLinkUrl}`;
}

interface ActivationReminderContent {
    fullName?: string;
    stage: ActivationReminderStage;
    setupUrl: string;
    dashboardUrl: string;
    newRequestUrl: string;
    sellerLinkUrl: string;
    testDriveCompleted?: boolean;
}

interface SendActivationReminderEmailParams extends ActivationReminderContent {
    toEmail: string;
}

function activationReminderSubject(stage: ActivationReminderStage) {
    return stage === 'after_1d'
        ? 'Send your first seller link'
        : 'Welcome to UtilitySheet: three steps to your first utility sheet';
}

const ACTIVATION_TEXT_STYLE = 'margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;';
const ACTIVATION_SMALL_STYLE = 'margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;';

function renderActivationLinkBox(sellerLinkUrl: string) {
    return `
                            <div style="background-color: #f9fafb; border-radius: 10px; padding: 16px 18px; margin: 12px 0 0; border-left: 4px solid ${PRODUCT_EMAIL_ACCENT};">
                                <p style="margin: 0 0 6px; color: #111827; font-size: 14px; font-weight: 700;">Your seller link</p>
                                <p style="margin: 0; color: ${PRODUCT_EMAIL_ACCENT}; font-size: 14px; line-height: 1.6; word-break: break-all;">${escapeHtml(sellerLinkUrl)}</p>
                            </div>`;
}

function renderActivationStep(index: number, title: string, body: string, done = false) {
    const marker = done
        ? `<div style="width: 28px; height: 28px; border-radius: 14px; background-color: #059669; color: #ffffff; font-size: 14px; font-weight: 700; line-height: 28px; text-align: center;">&#10003;</div>`
        : `<div style="width: 28px; height: 28px; border-radius: 14px; background-color: ${PRODUCT_EMAIL_ACCENT}; color: #ffffff; font-size: 14px; font-weight: 700; line-height: 28px; text-align: center;">${index}</div>`;
    return `
                            <tr>
                                <td valign="top" style="width: 40px; padding: 0 0 20px;">${marker}</td>
                                <td valign="top" style="padding: 2px 0 20px;">
                                    <p style="margin: 0 0 4px; color: #111827; font-size: 16px; font-weight: 700;">${escapeHtml(title)}</p>
                                    ${body}
                                </td>
                            </tr>`;
}

function renderWelcomeBody(params: ActivationReminderContent) {
    const testStep = params.testDriveCompleted
        ? renderActivationStep(1, 'Try it as your seller', `<p style="${ACTIVATION_SMALL_STYLE}">Done. You have already seen the form your sellers use and the sheet it creates.</p>`, true)
        : renderActivationStep(1, 'Try it as your seller', `<p style="${ACTIVATION_SMALL_STYLE}">Start the seller test from your dashboard and fill it in with made-up answers. You see the same short form your sellers use and the finished sheet and PDF it creates. It does not count toward your plan.</p>`);

    return `
                            <p style="${ACTIVATION_TEXT_STYLE}">Thanks for signing up. Here is the quickest way to your first finished utility sheet.</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 8px 0 4px;">
                                ${testStep}
                                ${renderActivationStep(2, 'Send your link to a seller', `<p style="${ACTIVATION_SMALL_STYLE}">Sellers open your link, enter the property address, and answer a short form on their phone. They do not need an account. Use the same link for every property.</p>${renderActivationLinkBox(params.sellerLinkUrl)}`)}
                                ${renderActivationStep(3, 'Get the finished sheet', `<p style="${ACTIVATION_SMALL_STYLE}">When your seller submits, the sheet and PDF are ready for you to review and share with the buyer.</p>`)}
                            </table>`;
}

function renderNextStepBody(params: ActivationReminderContent) {
    const intro = params.testDriveCompleted
        ? 'You have seen what your seller sees. The next step is sending your link to a real seller.'
        : 'Your seller link is ready whenever you have a seller to send it to.';
    const testNudge = params.testDriveCompleted
        ? ''
        : `<p style="${ACTIVATION_SMALL_STYLE} margin-top: 16px;">Not sure what your seller will see? Start the seller test from your dashboard first. It uses made-up answers and does not count toward your plan.</p>`;

    return `
                            <p style="${ACTIVATION_TEXT_STYLE}">${escapeHtml(intro)}</p>
                            ${renderActivationLinkBox(params.sellerLinkUrl)}
                            <p style="margin: 20px 0 8px; color: #111827; font-size: 14px; font-weight: 700;">Copy and paste this to your seller</p>
                            <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px;">
                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; word-break: break-word;">${escapeHtml(sellerTextMessage(params.sellerLinkUrl))}</p>
                            </div>
                            <p style="${ACTIVATION_SMALL_STYLE} margin-top: 16px;">No seller to send it to today? Add the link to your email signature or listing checklist so it is ready for the next one.</p>
                            <p style="${ACTIVATION_SMALL_STYLE} margin-top: 12px;">Working on one property and want to fill in the address yourself? <a href="${escapeHtml(params.newRequestUrl)}" style="color: ${PRODUCT_EMAIL_ACCENT};">Create a request for one property</a>.</p>
                            ${testNudge}`;
}

function generateActivationReminderHtml(params: ActivationReminderContent) {
    const greeting = params.fullName ? `Hi ${firstNameFromFullName(params.fullName) || params.fullName},` : 'Hello,';
    const isWelcome = params.stage === 'after_15m';
    const badgeText = isWelcome ? 'Welcome' : 'Your next step';
    const title = activationReminderSubject(params.stage);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td bgcolor="${PRODUCT_EMAIL_ACCENT}" style="${PRODUCT_EMAIL_HEADER_BACKGROUND} padding: 28px 32px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">UtilitySheet</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 32px 0; text-align: center;">
                            <div style="display: inline-block; background-color: ${PRODUCT_EMAIL_ACCENT_TINT}; color: ${PRODUCT_EMAIL_ACCENT}; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;">
                                ${escapeHtml(badgeText)}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 32px 32px;">
                            <p style="${ACTIVATION_TEXT_STYLE}">${escapeHtml(greeting)}</p>
                            ${isWelcome ? renderWelcomeBody(params) : renderNextStepBody(params)}

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 24px;">
                                <tr>
                                    <td style="text-align: center;">
                                        ${renderBulletproofButton({
        href: escapeHtml(params.dashboardUrl),
        label: 'Open my dashboard',
        backgroundColor: PRODUCT_EMAIL_ACCENT,
        borderRadius: 10,
        fontWeight: 700,
        paddingX: 28,
        paddingY: 14,
        minWidth: 240,
    })}
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">Your dashboard walks you through each step.</p>

                            ${isWelcome ? `<p style="${ACTIVATION_SMALL_STYLE} margin-top: 24px;">Want your name, colors, and contact details on every sheet? <a href="${escapeHtml(params.setupUrl)}" style="color: ${PRODUCT_EMAIL_ACCENT};">Add your branding</a>.</p>` : ''}
                            <p style="${ACTIVATION_SMALL_STYLE} margin-top: 16px;">Questions, or stuck on a step? Reply to this email.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 18px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">You are getting this because you created a UtilitySheet account in the last week.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

export async function sendActivationReminderEmail({
    toEmail,
    ...content
}: SendActivationReminderEmailParams): Promise<{ success: boolean; error?: string }> {
    const subject = activationReminderSubject(content.stage);
    const html = generateActivationReminderHtml(content);

    try {
        const { error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: toEmail,
            replyTo: ACTIVATION_REPLY_TO,
            subject,
            html,
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'activation_reminder' }, error);
            return { success: false, error: error.message };
        }

        logDiagnostic('log', 'email_send_accepted', { operation: 'activation_reminder' });
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'activation_reminder' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// =============================================================================
// ACCOUNT CLOSED EMAIL
// =============================================================================

function generateAccountClosedHtml({ supportEmail }: { supportEmail: string }): string {
    const safeSupportEmail = escapeHtml(supportEmail);
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your UtilitySheet account is closed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
                    <tr>
                        <td style="padding: 32px 40px;">
                            <h1 style="margin: 0 0 20px; color: #111827; font-size: 22px; font-weight: 600;">Your UtilitySheet account is closed</h1>
                            <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
                                We closed your account as you asked. Your sign-in, personal requests, seller links, and Branding Profiles have been deleted, and any subscription on the account was canceled.
                            </p>
                            <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Requests you shared in a team workspace now belong to the admin you chose. We keep billing and security records, without your name or contact details.
                            </p>
                            <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                If you didn't close your account, email <a href="mailto:${safeSupportEmail}" style="color: #2563eb;">${safeSupportEmail}</a> right away.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This is the last email we'll send to this address about this account.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

export async function sendAccountClosedEmail({
    toEmail,
    supportEmail = 'haydn@multimedium.dev',
}: {
    toEmail: string;
    supportEmail?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const resend = getResend();
        const { error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: getDemoEmailRecipient(toEmail),
            subject: 'Your UtilitySheet account is closed',
            html: generateAccountClosedHtml({ supportEmail }),
        });

        if (error) {
            logDiagnostic('error', 'email_send_failed', { operation: 'account_closed' }, error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error) {
        logDiagnostic('error', 'email_send_failed', { operation: 'account_closed' }, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// =============================================================================
// Testing Exports (for unit tests only)
// =============================================================================
export const __testing = {
    generateTCCompletionNotificationHtml,
    generateReferralCreditEarnedHtml,
    generateContactResolutionAlertHtml,
    generateWeeklySummaryHtml,
    generateActivationReminderHtml,
    generateAccountClosedHtml,
};
