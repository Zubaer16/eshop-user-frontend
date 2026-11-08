import type { Metadata } from 'next'
import { CheckoutClient } from '@/components/checkout/checkout-client'

export const metadata: Metadata = {
  title: 'Checkout Preview',
  description:
    'Preview eShop delivery address, delivery options and order review. No live checkout is available.',
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return <CheckoutClient />
}
