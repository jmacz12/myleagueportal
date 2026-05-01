import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const PLANS = {
  basic: {
    name: 'Basic',
    priceId: null,
    price: 0,
    playerLimit: 50,
    seasonLimit: 1,
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    price: 49,
    playerLimit: 150,
    seasonLimit: 3,
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    price: 149,
    playerLimit: 999999,
    seasonLimit: 999999,
  },
}