'use client';

import { UTILITY_CATEGORIES } from '@/lib/constants';
import { format } from 'date-fns';
import type { WizardState } from '@/components/seller-form/SellerWizard';

interface DemoPdfData {
    address: string;
    state: WizardState;
}

/**
 * Generates a demo PDF with watermark - does not require authentication
 */
export async function generateDemoPdf({ address, state }: DemoPdfData): Promise<void> {
    // Dynamic import for PDF generation
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    // Create a temporary iframe for isolation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    const iframeBody = iframeDoc?.body;

    if (!iframeDoc || !iframeBody) {
        document.body.removeChild(iframe);
        throw new Error('Failed to create iframe for PDF generation');
    }

    // Build utilities list from wizard state
    const utilities = Object.entries(state.utilities)
        .filter(([_, value]) => value?.display_name && value.entry_mode !== null)
        .map(([category, value]) => ({
            category,
            provider_name: value.display_name || 'Not provided',
            provider_phone: value.contact_phone,
            provider_website: value.contact_url,
        }));

    // Set up base styles
    iframeBody.style.margin = '0';
    iframeBody.style.padding = '0';
    iframeBody.style.backgroundColor = '#ffffff';

    iframeBody.innerHTML = `
        <div style="padding: 48px; background: #ffffff; color: #09090b; font-family: Arial, sans-serif, system-ui; min-height: 100%; box-sizing: border-box; position: relative;">
            <!-- DEMO Watermark -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; font-weight: bold; color: rgba(239, 68, 68, 0.15); white-space: nowrap; pointer-events: none; z-index: 1000;">
                DEMO
            </div>
            
            <!-- Demo Banner -->
            <div style="background: linear-gradient(to right, #fef3c7, #fde68a); color: #92400e; padding: 12px 20px; border-radius: 8px; margin-bottom: 24px; text-align: center; font-weight: 600; border: 2px solid #f59e0b;">
                🎯 DEMO PREVIEW - This is a sample Utility Info Sheet
            </div>
            
            <!-- Branding Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 2px solid #e4e4e7; margin-bottom: 32px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="height: 48px; width: 48px; border-radius: 8px; background: #475569; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">
                        US
                    </div>
                    <div>
                        <h2 style="font-weight: 700; color: #09090b; margin: 0; font-size: 20px;">UtilitySheet</h2>
                        <p style="font-size: 14px; color: #71717a; margin: 4px 0 0 0;">Demo Preview</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 14px; color: #71717a; margin: 0;">utilitrysheet.com</p>
                </div>
            </div>

            <!-- Title Section -->
            <div style="text-align: center; padding: 24px 0 48px 0;">
                <h1 style="font-size: 32px; font-weight: 800; color: #09090b; margin: 0 0 16px 0; letter-spacing: -0.02em;">
                    Utility Info Sheet
                </h1>
                <div style="background: #f4f4f5; padding: 12px 24px; border-radius: 12px; border: 1px solid #e4e4e7; display: inline-block; margin: 0 auto;">
                    <span style="color: #059669; margin-right: 8px; font-size: 18px; vertical-align: middle;">📍</span>
                    <span style="color: #09090b; font-weight: 600; font-size: 18px; vertical-align: middle;">${address}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font-size: 14px; color: #52525b;">
                    <span>📅</span>
                    <span>Generated on ${format(new Date(), 'MMMM d, yyyy')}</span>
                </div>
            </div>

            <!-- Utility Table -->
            <div style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 0; margin-bottom: 32px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <div style="background: #f9fafb; padding: 16px 24px; border-bottom: 1px solid #e4e4e7;">
                    <h3 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0;">Utility Providers</h3>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #e4e4e7; background: #ffffff;">
                            <th style="text-align: left; padding: 16px 24px; color: #52525b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Utility</th>
                            <th style="text-align: left; padding: 16px 24px; color: #52525b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Provider</th>
                            <th style="text-align: left; padding: 16px 24px; color: #52525b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Contact</th>
                        </tr>
                    </thead>
                    <tbody style="background: #ffffff;">
                        ${utilities.length === 0
            ? `<tr><td colspan="3" style="text-align: center; padding: 48px; color: #71717a;">No utility information provided yet.</td></tr>`
            : utilities.map((utility) => {
                let websiteDisplay = '';
                if (utility.provider_website) {
                    try {
                        websiteDisplay = new URL(utility.provider_website).hostname;
                    } catch {
                        websiteDisplay = utility.provider_website;
                    }
                }
                return `
                                <tr style="border-bottom: 1px solid #e4e4e7;">
                                    <td style="padding: 16px 24px;">
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            <span style="font-size: 20px; color: #09090b;">${UTILITY_CATEGORIES.find(c => c.key === utility.category)?.icon || '🏢'}</span>
                                            <span style="font-weight: 600; color: #09090b; text-transform: capitalize;">${utility.category}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 16px 24px; color: #3f3f46; font-weight: 500;">${utility.provider_name}</td>
                                    <td style="padding: 16px 24px;">
                                        ${utility.provider_phone ? `<span style="color: #059669; font-size: 14px; font-weight: 500;">${utility.provider_phone}</span>` : ''}
                                        ${utility.provider_phone && websiteDisplay ? '<span style="color: #d4d4d8; margin: 0 8px;">|</span>' : ''}
                                        ${websiteDisplay ? `<span style="color: #2563eb; font-size: 14px;">${websiteDisplay}</span>` : ''}
                                    </td>
                                </tr>
                            `;
            }).join('')
        }
                    </tbody>
                </table>
            </div>

            <!-- CTA Section -->
            <div style="background: linear-gradient(to right, #475569, #334155); color: white; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
                <h3 style="font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Ready to create sheets like this for your clients?</h3>
                <p style="font-size: 14px; opacity: 0.9; margin: 0 0 20px 0;">Sign up free at utilitysheet.com</p>
                <div style="background: white; color: #475569; font-weight: 600; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                    utilitysheet.com/auth/signup
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e4e4e7;">
                <p style="font-size: 13px; color: #71717a; margin: 0;">
                    Demo generated by UtilitySheet • This is a sample preview
                </p>
            </div>
        </div>
    `;

    try {
        // Wait for images to load
        const images = iframeBody.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(
                (img) =>
                    new Promise((resolve) => {
                        if (img.complete) resolve(true);
                        else {
                            img.onload = () => resolve(true);
                            img.onerror = () => resolve(true);
                        }
                    })
            )
        );

        // Generate canvas from the iframe body
        const canvas = await html2canvas(iframeBody.firstElementChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
        });

        // Create PDF with standard US Letter size
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'letter',
        });

        const pageWidth = 8.5;
        const pageHeight = 11;
        const margin = 0.5;
        const contentWidth = pageWidth - (margin * 2);
        const contentHeight = pageHeight - (margin * 2);

        const canvasAspectRatio = canvas.width / canvas.height;
        const contentAspectRatio = contentWidth / contentHeight;

        let imgWidth: number;
        let imgHeight: number;

        if (canvasAspectRatio > contentAspectRatio) {
            imgWidth = contentWidth;
            imgHeight = contentWidth / canvasAspectRatio;
        } else {
            imgHeight = contentHeight;
            imgWidth = contentHeight * canvasAspectRatio;
        }

        const xOffset = margin + (contentWidth - imgWidth) / 2;
        const yOffset = margin;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);

        // Download PDF
        const filename = `DEMO-utility-info-sheet-${address.split(',')[0].replace(/\s/g, '-')}.pdf`;
        pdf.save(filename);
    } catch (err) {
        console.error('Demo PDF Gen Error:', err);
        throw err;
    } finally {
        document.body.removeChild(iframe);
    }
}
