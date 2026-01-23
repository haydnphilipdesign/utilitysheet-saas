import { getResend } from '@/lib/resend';
import type { BrandProfile } from '@/types';
import { DEFAULT_MESSAGE_TEMPLATES, escapeHtml, firstNameFromFullName, plainTextToHtml, renderTemplate } from '@/lib/message-templates';

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
}): string {
    const safeBrandName = escapeHtml(params.brandName);
    const safeBrandLogoUrl = params.brandLogoUrl ? escapeHtml(params.brandLogoUrl) : null;
    const safeTitle = escapeHtml(params.title);
    const safeBadgeText = escapeHtml(params.badgeText);
    const safeGreeting = escapeHtml(params.greeting);
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
            ? `<p style="margin: 12px 0 0; color: #6b7280; font-size: 12px; line-height: 1.6;">Questions? Contact ${safeAgentName}${agentContactParts.length > 0 ? ` — ${agentContactParts.join(' · ')}` : ''}.</p>`
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
                        <td style="background: linear-gradient(135deg, ${params.primaryColor} 0%, ${params.secondaryColor} 100%); padding: 28px 32px; text-align: center;">
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

                            ${plainTextToHtml(params.bodyText)}

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 8px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${safeCtaUrl}" style="display: inline-block; background: linear-gradient(135deg, ${params.primaryColor} 0%, ${params.secondaryColor} 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 16px; font-weight: 700;">
                                            ${safeCtaLabel}
                                        </a>
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
}: SendSellerNotificationEmailParams): Promise<{ success: boolean; error?: string }> {
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
    const primaryColor = safeHexColor(brandProfile?.primary_color, '#10b981');
    const secondaryColor = safeHexColor(brandProfile?.secondary_color, '#059669');
    const brandLogoUrl = safeExternalUrl(brandProfile?.logo_url);

    const effectiveAgentName = agentName || brandProfile?.contact_name || 'Your agent';
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
        badgeText: 'Action required',
        greeting,
        bodyText,
        propertyAddress,
        formattedClosingDate,
        ctaUrl: sellerFormUrl,
        ctaLabel,
        agentName: effectiveAgentName,
        agentEmail: brandProfile?.contact_email || null,
        agentPhone: brandProfile?.contact_phone || null,
    });

    try {
        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: sellerEmail,
            subject,
            html: emailHtml,
        });

        if (error) {
            console.error('Failed to send seller notification email:', error);
            return { success: false, error: error.message };
        }

        console.log('Seller notification email sent successfully:', data?.id);
        return { success: true };
    } catch (error) {
        console.error('Error sending seller notification email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Sends a reminder email to the seller for an existing utility sheet request.
 */
export async function sendSellerReminderEmail({
    sellerEmail,
    sellerName,
    propertyAddress,
    closingDate,
    agentName,
    brandProfile,
    sellerToken,
}: SendSellerNotificationEmailParams): Promise<{ success: boolean; error?: string }> {
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
    const primaryColor = safeHexColor(brandProfile?.primary_color, '#10b981');
    const secondaryColor = safeHexColor(brandProfile?.secondary_color, '#059669');
    const brandLogoUrl = safeExternalUrl(brandProfile?.logo_url);

    const effectiveAgentName = agentName || brandProfile?.contact_name || 'Your agent';
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
    });

    try {
        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: sellerEmail,
            subject,
            html: emailHtml,
        });

        if (error) {
            console.error('Failed to send seller reminder email:', error);
            return { success: false, error: error.message };
        }

        console.log('Seller reminder email sent successfully:', data?.id);
        return { success: true };
    } catch (error) {
        console.error('Error sending seller reminder email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

interface SendOrganizationInviteEmailParams {
    toEmail: string;
    organizationName: string;
    invitedByName?: string;
    inviteUrl: string;
}

export async function sendOrganizationInviteEmail({
    toEmail,
    organizationName,
    invitedByName,
    inviteUrl,
}: SendOrganizationInviteEmailParams): Promise<{ success: boolean; error?: string }> {
    const inviter = invitedByName ? ` by ${invitedByName}` : '';
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to UtilitySheet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0f172a 0%, #334155 100%); padding: 28px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">UtilitySheet</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 36px 40px;">
                            <p style="margin: 0 0 16px; color: #111827; font-size: 16px; line-height: 1.6;">
                                You’ve been invited${inviter} to join <strong>${organizationName}</strong>.
                            </p>
                            <p style="margin: 0 0 24px; color: #374151; font-size: 15px; line-height: 1.6;">
                                Accept the invite to access your team's requests and branding in one shared workspace.
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f172a 0%, #334155 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 16px; font-weight: 700;">
                                            Accept Invite
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                If the button doesn’t work, copy and paste this link into your browser:<br>
                                <a href="${inviteUrl}" style="color: #0f172a; word-break: break-all;">${inviteUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 18px 40px; background-color: #f9fafb; text-align: center;">
                            <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                                If you weren’t expecting this invite, you can ignore this email.
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

    try {
        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: toEmail,
            subject: `You’re invited to join ${organizationName} on UtilitySheet`,
            html: emailHtml,
        });

        if (error) {
            console.error('Failed to send organization invite email:', error);
            return { success: false, error: error.message };
        }

        console.log('Organization invite email sent successfully:', data?.id);
        return { success: true };
    } catch (error) {
        console.error('Error sending organization invite email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

interface GenerateEmailHtmlParams {
    sellerName?: string;
    propertyAddress: string;
    formattedClosingDate: string | null;
    agentName?: string;
    sellerFormUrl: string;
}

function generateSellerNotificationHtml({
    sellerName,
    propertyAddress,
    formattedClosingDate,
    agentName,
    sellerFormUrl,
}: GenerateEmailHtmlParams): string {
    const greeting = sellerName ? `Hi ${sellerName},` : 'Hello,';
    const agentMention = agentName ? ` from ${agentName}` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Utility Information Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">UtilitySheet</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                You've received a request${agentMention} to provide utility information for the following property:
                            </p>
                            
                            <!-- Property Card -->
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #10b981;">
                                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">
                                    ${propertyAddress}
                                </p>
                                ${formattedClosingDate ? `
                                <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
                                    <strong>Closing Date:</strong> ${formattedClosingDate}
                                </p>
                                ` : ''}
                            </div>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Please click the button below to provide information about the utility providers for this property. This typically takes 2-3 minutes.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${sellerFormUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                                            Provide Utility Information
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${sellerFormUrl}" style="color: #10b981; word-break: break-all;">${sellerFormUrl}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This email was sent by UtilitySheet. If you received this in error, you can safely ignore it.
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

function generateSellerReminderHtml({
    sellerName,
    propertyAddress,
    formattedClosingDate,
    agentName,
    sellerFormUrl,
}: GenerateEmailHtmlParams): string {
    const greeting = sellerName ? `Hi ${sellerName},` : 'Hello,';
    const agentMention = agentName ? ` from ${agentName}` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reminder: Utility Information Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">UtilitySheet Reminder</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Just a friendly reminder to complete the utility information request${agentMention} for the following property:
                            </p>
                            
                            <!-- Property Card -->
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #10b981;">
                                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">
                                    ${propertyAddress}
                                </p>
                                ${formattedClosingDate ? `
                                <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
                                    <strong>Closing Date:</strong> ${formattedClosingDate}
                                </p>
                                ` : ''}
                            </div>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                This information will help the buyers ensure all utilities are properly transferred and helps make for a smooth closing.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${sellerFormUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                                            Complete Utility Info
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                If you've already completed this, please disregard this message.
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

interface SendFeedbackEmailParams {
    userEmail: string;
    message: string;
    userId?: string;
    userName?: string;
}

/**
 * Sends a feedback email to the admin/support team.
 */
export async function sendFeedbackEmail({
    userEmail,
    message,
    userId,
    userName,
}: SendFeedbackEmailParams): Promise<{ success: boolean; error?: string }> {
    try {
        const feedbackEmail = process.env.FEEDBACK_EMAIL;

        if (!feedbackEmail) {
            console.warn('FEEDBACK_EMAIL environment variable is not set. Feedback email will not be sent.');
            return { success: false, error: 'Configuration error' };
        }

        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet Feedback <feedback@utilitysheet.com>',
            to: feedbackEmail,
            replyTo: userEmail,
            subject: `New Feedback from ${userName || userEmail}`,
            html: `
                <div>
                    <h2>New Feedback Received</h2>
                    <p><strong>From:</strong> ${userName ? `${userName} (${userEmail})` : userEmail}</p>
                    ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
                    <hr />
                    <h3>Message:</h3>
                    <p style="white-space: pre-wrap;">${message}</p>
                </div>
            `,
        });

        if (error) {
            console.error('Failed to send feedback email:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Error sending feedback email:', error);
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
}

/**
 * Sends an email notification to the TC when a seller completes their utility form.
 */
export async function sendTCCompletionNotificationEmail({
    tcEmail,
    tcName,
    propertyAddress,
    sellerName,
    requestId,
}: SendTCCompletionNotificationEmailParams): Promise<{ success: boolean; error?: string }> {
    // Construct the dashboard URL to view the completed request
    const baseUrl = getAppBaseUrl();
    const dashboardUrl = `${baseUrl}/dashboard/requests/${requestId}`;

    console.log('sendTCCompletionNotificationEmail called:', { tcEmail, requestId });

    const emailHtml = generateTCCompletionNotificationHtml({
        tcName,
        propertyAddress,
        sellerName,
        dashboardUrl,
    });

    try {
        console.log('Calling Resend API for TC notification...');
        const resend = getResend();
        const { data, error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: tcEmail,
            subject: `Utility Info Submitted for ${propertyAddress}`,
            html: emailHtml,
        });

        if (error) {
            console.error('Resend API returned error:', JSON.stringify(error));
            return { success: false, error: error.message };
        }

        console.log('TC completion notification email sent successfully:', data?.id);
        return { success: true };
    } catch (error) {
        console.error('Exception in sendTCCompletionNotificationEmail:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

interface GenerateTCCompletionHtmlParams {
    tcName?: string;
    propertyAddress: string;
    sellerName?: string;
    dashboardUrl: string;
}

function generateTCCompletionNotificationHtml({
    tcName,
    propertyAddress,
    sellerName,
    dashboardUrl,
}: GenerateTCCompletionHtmlParams): string {
    const greeting = tcName ? `Hi ${tcName},` : 'Hello,';
    const sellerMention = sellerName ? `${sellerName} has` : 'The seller has';

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
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">UtilitySheet</h1>
                        </td>
                    </tr>
                    
                    <!-- Success Badge -->
                    <tr>
                        <td style="padding: 32px 40px 0; text-align: center;">
                            <div style="display: inline-block; background-color: #d1fae5; color: #065f46; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                ✓ Submission Complete
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
                                ${sellerMention} completed the utility information form for:
                            </p>
                            
                            <!-- Property Card -->
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #10b981;">
                                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">
                                    ${propertyAddress}
                                </p>
                            </div>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                You can now view the complete utility details and generate the utility packet for this property.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                                            View Utility Details
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${dashboardUrl}" style="color: #10b981; word-break: break-all;">${dashboardUrl}</a>
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
        const { data, error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: tcEmail,
            subject: `⚠️ Unresolved Contacts for ${propertyAddress}`,
            html: emailHtml,
        });

        if (error) {
            console.error('Failed to send contact resolution alert:', error);
            return { success: false, error: error.message };
        }

        console.log('Contact resolution alert email sent successfully:', data?.id);
        return { success: true };
    } catch (error) {
        console.error('Error sending contact resolution alert:', error);
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
        .map(e => `<li style="margin: 8px 0; color: #374151;"><strong>${e.category}:</strong> ${e.displayName || 'No name provided'}</li>`)
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unresolved Utility Contacts</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 40px; text-align: center;">
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
                                A seller has submitted utility information for <strong>${propertyAddress}</strong>, but some entries couldn't be matched to known utility providers:
                            </p>
                            
                            <!-- Unresolved Entries List -->
                            <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0 0 12px; color: #92400e; font-size: 14px; font-weight: 600;">
                                    Unresolved Utility Providers:
                                </p>
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${entriesList}
                                </ul>
                            </div>
                            
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                You may need to manually look up contact information for these providers.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                                            Review Utility Details
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                This email was sent by UtilitySheet. You can disable these alerts in Settings.
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
        const { data, error } = await resend.emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: tcEmail,
            subject: `📊 Your Weekly UtilitySheet Summary`,
            html: emailHtml,
        });

        if (error) {
            console.error('Failed to send weekly summary email:', error);
            return { success: false, error: error.message };
        }

        console.log('Weekly summary email sent successfully:', data?.id);
        return { success: true };
    } catch (error) {
        console.error('Error sending weekly summary email:', error);
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
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; text-align: center;">
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
                                        <p style="margin: 0; color: #10b981; font-size: 28px; font-weight: 700;">${stats.submitted}</p>
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
                                    <strong>⚠️ ${stats.needsAttention} request${stats.needsAttention > 1 ? 's' : ''}</strong> sent more than 3 days ago with no response. Consider sending a reminder.
                                </p>
                            </div>
                            ` : ''}
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding-top: 16px;">
                                        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                                            Go to Dashboard
                                        </a>
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

// =============================================================================
// Testing Exports (for unit tests only)
// =============================================================================
export const __testing = {
    generateSellerNotificationHtml,
    generateSellerReminderHtml,
    generateTCCompletionNotificationHtml,
    generateContactResolutionAlertHtml,
    generateWeeklySummaryHtml,
};
