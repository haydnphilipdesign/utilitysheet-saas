'use client';

import { UTILITY_CATEGORIES } from '@/lib/constants';
import { format } from 'date-fns';

interface PacketData {
    request: {
        id: string;
        property_address: string;
        created_at: string;
    };
    brand: {
        name?: string;
        logo_url?: string;
        primary_color?: string;
        contact_email?: string;
        contact_phone?: string;
        contact_website?: string;
    } | null;
    utilities: Array<{
        category: string;
        provider_name: string;
        provider_phone?: string;
        provider_website?: string;
    }>;
}

/**
 * Fetches packet data and generates a PDF download
 */
export async function generatePacketPdf(token: string): Promise<void> {
    // 1. Fetch packet data
    const response = await fetch(`/api/packet/${token}`);
    if (!response.ok) {
        throw new Error('Failed to fetch packet data');
    }
    const data: PacketData = await response.json();

    // 2. Dynamic import for PDF generation
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    // 3. Create a temporary iframe for isolation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1200px'; // Set sufficient height
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // Get the iframe document
    const iframeDoc = iframe.contentWindow?.document;
    const iframeBody = iframeDoc?.body;

    if (!iframeDoc || !iframeBody) {
        document.body.removeChild(iframe);
        throw new Error('Failed to create iframe for PDF generation');
    }

    const { request, brand, utilities } = data;
    const primaryColor = brand?.primary_color || '#10b981';

    // Ensure primary color is a safe hex/rgb value
    const safePrimaryColor = primaryColor.startsWith('oklch') || primaryColor.startsWith('lab') ? '#10b981' : primaryColor;

    // 4. Render the packet content into the iframe
    // We add base styles directly to the iframe body to ensure clean slate
    iframeBody.style.margin = '0';
    iframeBody.style.padding = '0';
    iframeBody.style.backgroundColor = '#18181b';

    iframeBody.innerHTML = `
        <div style="padding: 48px; background: #18181b; color: #ffffff; font-family: Arial, sans-serif, system-ui; min-height: 100%; box-sizing: border-box;">
            <!-- Branding Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 1px solid #27272a; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    ${brand?.logo_url
            ? `<img src="${brand.logo_url}" alt="${brand.name}" style="height: 48px; width: auto;" crossorigin="anonymous" />`
            : `<div style="height: 48px; width: 48px; border-radius: 8px; background: ${safePrimaryColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">
                            ${brand?.name ? brand.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : 'US'}
                        </div>`
        }
                    <div>
                        <h2 style="font-weight: 600; color: #ffffff; margin: 0; font-size: 18px;">${brand?.name || 'Real Estate Group'}</h2>
                        <p style="font-size: 14px; color: #a1a1aa; margin: 4px 0 0 0;">${brand?.contact_phone || ''}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 14px; color: #a1a1aa; margin: 0;">${brand?.contact_email || ''}</p>
                    <p style="font-size: 14px; color: #a1a1aa; margin: 4px 0 0 0;">${brand?.contact_website || ''}</p>
                </div>
            </div>

            <!-- Title Section -->
            <div style="text-align: center; padding: 24px 0;">
                <h1 style="font-size: 28px; font-weight: bold; color: #ffffff; margin: 0 0 16px 0;">
                    Utility Handoff Packet
                </h1>
                <div style="display: inline-flex; align-items: center; gap: 8px; background: #27272a; padding: 8px 16px; border-radius: 8px;">
                    <span style="color: #34d399;">📍</span>
                    <span style="color: #ffffff; font-weight: 500;">${request.property_address}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; font-size: 14px; color: #71717a;">
                    <span>📅</span>
                    <span>Generated ${format(new Date(request.created_at), 'MMMM d, yyyy')}</span>
                </div>
            </div>

            <!-- Utility Table -->
            <div style="background: #27272a; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 16px 0;">Utility Providers</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #3f3f46;">
                            <th style="text-align: left; padding: 12px 8px; color: #a1a1aa; font-weight: 500; font-size: 14px;">Utility</th>
                            <th style="text-align: left; padding: 12px 8px; color: #a1a1aa; font-weight: 500; font-size: 14px;">Provider</th>
                            <th style="text-align: left; padding: 12px 8px; color: #a1a1aa; font-weight: 500; font-size: 14px;">Contact</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${utilities.length === 0
            ? `<tr><td colspan="3" style="text-align: center; padding: 32px; color: #71717a;">No utility information provided yet.</td></tr>`
            : utilities.map((utility) => {
                // Safely extract hostname from URL
                let websiteDisplay = '';
                if (utility.provider_website) {
                    try {
                        websiteDisplay = new URL(utility.provider_website).hostname;
                    } catch {
                        websiteDisplay = utility.provider_website;
                    }
                }
                return `
                                <tr style="border-bottom: 1px solid #3f3f46;">
                                    <td style="padding: 12px 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-size: 20px;">${UTILITY_CATEGORIES.find(c => c.key === utility.category)?.icon || '🏢'}</span>
                                            <span style="font-weight: 500; color: #ffffff; text-transform: capitalize;">${utility.category}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 12px 8px; color: #d4d4d8;">${utility.provider_name}</td>
                                    <td style="padding: 12px 8px;">
                                        ${utility.provider_phone ? `<span style="color: #34d399; font-size: 14px;">${utility.provider_phone}</span>` : ''}
                                        ${utility.provider_phone && websiteDisplay ? '<span style="color: #71717a; margin: 0 8px;">•</span>' : ''}
                                        ${websiteDisplay ? `<span style="color: #60a5fa; font-size: 14px;">${websiteDisplay}</span>` : ''}
                                    </td>
                                </tr>
                            `;
            }).join('')
        }
                    </tbody>
                </table>
            </div>

            <!-- Next Steps -->
            <div style="background: #27272a; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 16px 0;">Buyer Next Steps</h3>
                <ol style="margin: 0; padding: 0; list-style: none;">
                    ${[
            'Contact each utility provider above to set up new service in your name.',
            'Schedule service to begin on your closing date or the following business day.',
            'Have your closing documents handy — providers may ask for verification of ownership.',
            'If transferring internet service, contact your provider at least 1-2 weeks in advance.'
        ].map((step, i) => `
                        <li style="display: flex; gap: 12px; margin-bottom: 12px; color: #d4d4d8;">
                            <span style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 12px; background: #064e3b; color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500;">${i + 1}</span>
                            <span>${step}</span>
                        </li>
                    `).join('')}
                </ol>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #27272a;">
                <p style="font-size: 14px; color: #71717a; margin: 0;">
                    Generated by UtilitySheet ${brand?.contact_email ? `• ${brand.contact_email}` : ''}
                </p>
            </div>
        </div>
    `;

    try {
        console.log('PDF Gen: Waiting for images...');
        // 5. Wait for images to load
        const images = iframeBody.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(
                (img) =>
                    new Promise((resolve) => {
                        if (img.complete) resolve(true);
                        else {
                            img.onload = () => resolve(true);
                            img.onerror = () => {
                                console.warn('PDF Gen: Image failed to load', img.src);
                                resolve(true);
                            };
                        }
                    })
            )
        );

        console.log('PDF Gen: Starting html2canvas...');
        // 6. Generate canvas from the iframe body (specifically the wrapper div)
        const canvas = await html2canvas(iframeBody.firstElementChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#18181b',
            logging: false, // Disable logging for html2canvas
            allowTaint: true, // Allow tainted images (might help if CORS fails)
        });

        console.log('PDF Gen: Canvas created, generating PDF...');
        // 7. Create PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height],
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

        // 8. Download PDF
        const filename = `utility-packet-${request.property_address.split(',')[0].replace(/\s/g, '-')}.pdf`;
        pdf.save(filename);
        console.log('PDF Gen: PDF saved');
    } catch (err) {
        console.error('PDF Gen Error:', err);
        throw err;
    } finally {
        // 9. Clean up
        document.body.removeChild(iframe);
    }
}
