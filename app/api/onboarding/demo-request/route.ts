import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { getOrCreateAccount, getDefaultBrandProfile } from '@/lib/neon/queries';
import { sql, generateToken } from '@/lib/neon/db';

// Sample addresses for demo requests
const SAMPLE_ADDRESSES = [
    '123 Maple Street, Anytown, PA 18301',
    '456 Oak Avenue, Springfield, PA 18401',
    '789 Pine Lane, Riverside, PA 18501',
    '321 Cedar Court, Lakewood, PA 18601',
    '654 Birch Road, Hillside, PA 18701',
];

export async function POST() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        if (!sql) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
        }

        // Get the default brand profile for this account/organization
        const brandProfile = await getDefaultBrandProfile(
            account.id,
            account.active_organization_id || undefined
        );

        // Generate unique tokens
        const publicToken = generateToken();
        const sellerToken = generateToken();

        // Pick a random sample address
        const randomAddress = SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)];

        // Create a demo request with sample data
        const result = await sql`
            INSERT INTO requests (
                account_id,
                organization_id,
                brand_profile_id,
                property_address,
                seller_name,
                seller_email,
                seller_phone,
                utility_categories,
                public_token,
                seller_token,
                status,
                is_demo
            ) VALUES (
                ${account.id},
                ${account.active_organization_id || null},
                ${brandProfile?.id || null},
                ${randomAddress},
                ${'Jane Demo Seller'},
                ${'demo@example.com'},
                ${'(555) 123-4567'},
                ${['electric', 'gas', 'water', 'sewer', 'trash']},
                ${publicToken},
                ${sellerToken},
                'submitted',
                ${true}
            )
            RETURNING *
        `;

        const request = result[0];
        if (!request) {
            return NextResponse.json({ error: 'Failed to create demo request' }, { status: 500 });
        }

        // Add sample utility entries to make the demo feel complete
        await sql`
            INSERT INTO utility_entries (request_id, category, entry_mode, display_name, contact_phone)
            VALUES 
                (${request.id}, 'electric', 'suggested_confirmed', 'Demo Electric Company', '1-800-555-0101'),
                (${request.id}, 'gas', 'suggested_confirmed', 'Demo Gas Utility', '1-800-555-0102'),
                (${request.id}, 'water', 'suggested_confirmed', 'Demo Water Authority', '1-800-555-0103'),
                (${request.id}, 'sewer', 'suggested_confirmed', 'Demo Sewer District', '1-800-555-0104'),
                (${request.id}, 'trash', 'suggested_confirmed', 'Demo Waste Services', '1-800-555-0105')
        `;

        return NextResponse.json({
            request,
            message: 'Demo request created successfully! This request does not count against your monthly limit.'
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating demo request:', error);
        return NextResponse.json({ error: 'Failed to create demo request' }, { status: 500 });
    }
}
