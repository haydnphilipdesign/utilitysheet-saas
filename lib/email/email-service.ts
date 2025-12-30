import { getResend } from '@/lib/resend';

interface SendSellerNotificationEmailParams {
    sellerEmail: string;
    sellerName?: string;
    propertyAddress: string;
    closingDate?: string;
    agentName?: string;
    publicToken: string;
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
    publicToken,
}: SendSellerNotificationEmailParams): Promise<{ success: boolean; error?: string }> {
    // Construct the seller form URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
    const sellerFormUrl = `${baseUrl}/s/${publicToken}`;

    // Format closing date if provided
    const formattedClosingDate = closingDate
        ? new Date(closingDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : null;

    const emailHtml = generateSellerNotificationHtml({
        sellerName,
        propertyAddress,
        formattedClosingDate,
        agentName,
        sellerFormUrl,
    });

    try {
        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: sellerEmail,
            subject: `Action Required: Utility Information Needed for ${propertyAddress}`,
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
    publicToken,
}: SendSellerNotificationEmailParams): Promise<{ success: boolean; error?: string }> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
    const sellerFormUrl = `${baseUrl}/s/${publicToken}`;

    const formattedClosingDate = closingDate
        ? new Date(closingDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : null;

    const emailHtml = generateSellerReminderHtml({
        sellerName,
        propertyAddress,
        formattedClosingDate,
        agentName,
        sellerFormUrl,
    });

    try {
        const { data, error } = await getResend().emails.send({
            from: 'UtilitySheet <noreply@utilitysheet.com>',
            to: sellerEmail,
            subject: `Reminder: Utility Information Needed for ${propertyAddress}`,
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const dashboardUrl = `${baseUrl}/dashboard/requests/${requestId}`;

    console.log('sendTCCompletionNotificationEmail called:', { tcEmail, propertyAddress, dashboardUrl });

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
