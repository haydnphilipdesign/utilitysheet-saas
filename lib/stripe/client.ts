import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY not set - billing features will not work');
}

export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-08-26.dahlia',
    })
    : null;

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
export const STRIPE_TEAMS_PRICE_ID = process.env.STRIPE_TEAMS_PRICE_ID || '';
