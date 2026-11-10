import { LiveOrderDetail } from '@/components/orders/orders'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OrderDetailClient } from '@/components/account/order-detail-client'
import { demoOrders, previewOrderById } from '@/lib/account-preview'
import { isPreviewMode } from '@/lib/integration-mode'

export const dynamicParams = true
export function generateStaticParams() {
  return isPreviewMode ? demoOrders.map((order) => ({ orderId: order.id })) : []
}
export const metadata: Metadata = {
  title: 'Order Details',
  robots: { index: false, follow: false },
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  if (!isPreviewMode) return <LiveOrderDetail key={orderId} id={orderId} />
  const order = previewOrderById(orderId)
  if (!order) notFound()
  return <OrderDetailClient order={order} />
}
