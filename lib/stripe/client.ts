import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY not set - billing features will not work');
}

export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-12-15.clover',
    })
    : null;

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
