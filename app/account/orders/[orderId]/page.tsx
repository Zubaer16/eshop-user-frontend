import type { Metadata } from 'next'
import { OrderDetail } from '@/components/orders/orders'
export const metadata: Metadata = {
  title: 'Order Details',
  robots: { index: false, follow: false },
}
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return <OrderDetail key={orderId} id={orderId} />
}
