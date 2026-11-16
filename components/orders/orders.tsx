'use client'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { PendingButton } from '@/components/ui/pending-button'
import Link from '@/components/ui/app-link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { money } from '@/lib/api/catalog'
import {
  isOrderId,
  returnReasons,
  returnPayload,
  returnableQuantity,
  type OrderPage,
  type OrderSummary,
  type OrderDetail,
  type ReturnRow,
  type ReplacementRow,
  type RefundRow,
  type Tracking,
} from '@/lib/api/orders'
import { useAccountResource } from '@/components/account/use-account-resource'
import { prefetchOrder } from '@/components/account/account-preload'
import { useOrderResource } from './resource'
import {
  orderDate,
  orderDateTime,
  orderReference,
  readableReason,
  readableStatus,
  trackingEventTitle,
  uniqueTrackingEvents,
} from '@/lib/order-presentation'
import {
  actionClass,
  inputClass,
  ErrorMessage,
} from '@/components/shopping/cart'

type StatusPresentation = {
  label: string
  className: string
  Icon: LucideIcon
}

function paymentPresentation(
  status: OrderSummary['status'],
): StatusPresentation {
  switch (status) {
    case 'PAID':
      return {
        label: 'Paid',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        Icon: CheckCircle2,
      }
    case 'PENDING_PAYMENT':
      return {
        label: 'Payment pending',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        Icon: Clock3,
      }
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        Icon: XCircle,
      }
    case 'EXPIRED':
      return {
        label: 'Expired',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
        Icon: Clock3,
      }
    default:
      return {
        label: 'Status unavailable',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
        Icon: Clock3,
      }
  }
}

function shipmentPresentation(
  shipment: OrderSummary['fulfillment'],
): StatusPresentation {
  if (!shipment)
    return {
      label: 'Not started',
      className: 'border-slate-200 bg-slate-100 text-slate-600',
      Icon: Clock3,
    }

  switch (shipment.status) {
    case 'PROCESSING':
      return {
        label: 'Processing',
        className: 'border-blue-200 bg-blue-50 text-blue-700',
        Icon: Package,
      }
    case 'SHIPPED':
      return {
        label: 'Shipped',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        Icon: Truck,
      }
    case 'DELIVERED':
      return {
        label: 'Delivered',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        Icon: CheckCircle2,
      }
    default:
      return {
        label: 'Status unavailable',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
        Icon: Clock3,
      }
  }
}

function StatusPill({ status }: { status: StatusPresentation }) {
  const Icon = status.Icon
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold leading-none ${status.className}`}
    >
      <Icon aria-hidden="true" size={13} strokeWidth={2.25} />
      {status.label}
    </span>
  )
}

function formatOrderDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  const locale =
    typeof document === 'undefined'
      ? 'en-US'
      : document.documentElement.dataset.storeLocale || 'en-US'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function OrderCard({ order }: { order: OrderSummary }) {
  const payment = paymentPresentation(order.status)
  const shipment = shipmentPresentation(order.fulfillment)
  const detailsHref = '/account/orders/' + order.id
  const prefetch = () => prefetchOrder(order.id)

  return (
    <article
      data-testid="order-card"
      className="group rounded-2xl border border-border bg-white p-4 shadow-[0_2px_10px_rgba(21,32,57,0.025)] transition duration-200 hover:border-[#d5def0] hover:shadow-[0_12px_30px_rgba(21,32,57,0.07)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-muted">
            Order reference
          </p>
          <Link
            href={detailsHref}
            aria-label={order.id}
            title={`Order ID ${order.id}`}
            onMouseEnter={prefetch}
            onFocus={prefetch}
            onTouchStart={prefetch}
            className="inline-flex max-w-full items-center gap-2 rounded-md font-mono text-sm font-bold tracking-[.015em] text-primary transition hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <span>#{order.id.slice(0, 8).toUpperCase()}</span>
            <span className="sr-only">{order.id}</span>
          </Link>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted">
            Payment
          </span>
          <StatusPill status={payment} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-y border-border py-4 sm:grid-cols-3 sm:gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f6ff] text-primary">
            <CalendarDays aria-hidden="true" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">Order date</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {formatOrderDate(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f6ff] text-primary">
            <Truck aria-hidden="true" size={16} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted">Shipment</p>
            <StatusPill status={shipment} />
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
          <p className="text-xs font-medium text-muted">Order total</p>
          <p className="text-xl font-extrabold leading-none tracking-tight text-ink tabular-nums">
            {money(order.totalMinor, order.currency)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={detailsHref}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          onTouchStart={prefetch}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dce5fb] bg-[#f7f9ff] px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/30 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View order details
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  )
}

export function OrderHistory() {
  const [page, setPage] = useState(1)
  const { data, error, reload, loading } = useAccountResource<OrderPage>(
    '/v1/orders',
    {
      page,
      limit: 20,
    },
  )

  return (
    <section className="container-shell w-full max-w-5xl space-y-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-primary">
            Order history
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-[2rem]">
            Your orders
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Review your purchases and keep track of payment and delivery
            progress.
          </p>
        </div>
        <PendingButton
          type="button"
          aria-label="Refresh orders"
          title="Refresh orders"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-bold text-ink shadow-sm transition hover:border-primary/30 hover:bg-[#f7f9ff] disabled:cursor-wait disabled:opacity-70"
          busy={loading}
          pendingLabel="Refreshing…"
          onClick={reload}
        >
          <RefreshCw aria-hidden="true" size={16} />
          <span>Refresh</span>
        </PendingButton>
      </div>

      <ErrorMessage text={error} />

      {data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f9fc] px-3.5 py-3 sm:px-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                <Package aria-hidden="true" size={16} />
              </span>
              <span>
                {data.total} {data.total === 1 ? 'order' : 'orders'}
              </span>
            </div>
            <span className="text-xs font-medium text-muted">
              Sorted by newest first
            </span>
          </div>

          {data.items.length ? (
            <div className="space-y-3.5 sm:space-y-4">
              {data.items.map((row) => (
                <OrderCard key={row.id} order={row} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8e0ee] bg-white px-5 py-10 text-center sm:px-8 sm:py-12">
              <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-[#f2f6ff] text-primary">
                <ShoppingBag aria-hidden="true" size={25} />
              </span>
              <h2 className="mt-4 text-lg font-extrabold tracking-tight text-ink">
                No orders yet
              </h2>
              <p className="mt-1 text-sm text-muted">
                No orders on this account.
              </p>
              <Link
                href="/shop"
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover"
              >
                Explore the shop
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          )}

          {data.pages > 1 && (
            <nav
              aria-label="Order history pagination"
              className="flex flex-col gap-3 rounded-2xl border border-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-muted">
                Page <span className="font-bold text-ink">{data.page}</span> of{' '}
                <span className="font-bold text-ink">{data.pages}</span>
                <span className="mx-1.5 text-border" aria-hidden="true">
                  ·
                </span>
                {data.total} {data.total === 1 ? 'order' : 'orders'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-ink transition hover:border-primary/30 hover:bg-[#f7f9ff] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                  Previous
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-ink transition hover:border-primary/30 hover:bg-[#f7f9ff] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                  disabled={page >= data.pages || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </div>
            </nav>
          )}
        </>
      ) : (
        !error && <ContentSkeleton variant="list" label="Loading your orders" />
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = [
    'PAID',
    'DELIVERED',
    'SUCCEEDED',
    'RESTOCKED',
    'RECEIVED_RESTOCKABLE',
  ].includes(status)
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : ['REJECTED', 'FAILED'].includes(status)
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : [
            'PENDING_PAYMENT',
            'REQUESTED',
            'REQUIRES_REVIEW',
            'RECEIVED_DAMAGED',
          ].includes(status)
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : ['PROCESSING', 'SHIPPED', 'APPROVED', 'AUTHORIZED'].includes(status)
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-slate-200 bg-slate-50 text-slate-700'
  return (
    <span
      className={
        'inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-bold ' +
        tone
      }
    >
      {readableStatus(status)}
    </span>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  aside,
  children,
}: {
  title: string
  description?: string
  icon: LucideIcon
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-[0_8px_28px_rgba(21,32,57,0.035)] sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary">
            <Icon size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-ink sm:text-lg">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">
                {description}
              </p>
            )}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
        <Icon size={19} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
        {description}
      </p>
    </div>
  )
}

export function OrderSnapshot({ order }: { order: OrderDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={order.status} />
      <StatusBadge status={order.fulfillment?.status || 'NOT_STARTED'} />
    </div>
  )
}

export function TrackingTimeline({ tracking }: { tracking: Tracking }) {
  const events = uniqueTrackingEvents(tracking.events)
  const shipment = tracking.originalShipment
  return (
    <SectionCard
      title="Tracking & delivery"
      description="Order and delivery updates recorded by the store."
      icon={Truck}
      aside={
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      }
    >
      <div className="mb-4 rounded-xl bg-slate-50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Shipment status
            </p>
            <p className="mt-1 text-sm font-bold text-ink">
              {shipment ? readableStatus(shipment.status) : 'Not started'}
            </p>
          </div>
          <StatusBadge status={shipment?.status || 'NOT_STARTED'} />
        </div>
        {shipment && (
          <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Carrier</p>
              <p className="mt-0.5 font-semibold text-ink">
                {shipment.carrier || 'Not assigned yet'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Tracking number</p>
              <p className="mt-0.5 break-all font-semibold text-ink">
                {shipment.trackingNumber || 'Not available yet'}
              </p>
            </div>
            {shipment.shippedAt && (
              <div>
                <p className="text-xs text-muted">Shipped</p>
                <p className="mt-0.5 font-semibold text-ink">
                  {orderDateTime(shipment.shippedAt)}
                </p>
              </div>
            )}
            {shipment.deliveredAt && (
              <div>
                <p className="text-xs text-muted">Delivered</p>
                <p className="mt-0.5 font-semibold text-ink">
                  {orderDateTime(shipment.deliveredAt)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {events.length ? (
        <ol aria-label="Order and delivery event history" className="space-y-0">
          {events.map((event, index) => (
            <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
              <span className="relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-primary">
                {event.type === 'ORDER' ? (
                  <ClipboardList size={14} aria-hidden="true" />
                ) : event.type === 'SHIPMENT' ? (
                  <Truck size={14} aria-hidden="true" />
                ) : event.type === 'RETURN' ? (
                  <RotateCcw size={14} aria-hidden="true" />
                ) : (
                  <PackageCheck size={14} aria-hidden="true" />
                )}
              </span>
              {index < events.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[13px] top-7 w-px bg-slate-200"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  {trackingEventTitle(event)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {orderDateTime(event.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={Clock3}
          title="No tracking events yet"
          description="New order and delivery updates will appear here when they are recorded."
        />
      )}
    </SectionCard>
  )
}

function OrderItemsCard({ order }: { order: OrderDetail }) {
  return (
    <SectionCard
      title="Order items"
      description={`${order.lines.length} ${order.lines.length === 1 ? 'item' : 'items'} in this order`}
      icon={Package}
    >
      {order.lines.length ? (
        <div className="divide-y divide-slate-100">
          {order.lines.map((line) => (
            <article
              key={line.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-5 text-ink">
                  {line.title}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  SKU: {line.sku || 'Not provided'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Quantity: {line.quantity} ·{' '}
                  {money(line.unitPriceMinor, order.currency)} per unit
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                {line.discountMinor > 0 && (
                  <p className="text-xs text-muted line-through">
                    {money(line.lineTotalMinor, order.currency)}
                  </p>
                )}
                <p className="text-sm font-extrabold tabular-nums text-ink">
                  {money(line.netLineTotalMinor, order.currency)}
                </p>
                {line.discountMinor > 0 && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Saved {money(line.discountMinor, order.currency)}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No item details available"
          description="The server did not return any line items for this order."
        />
      )}
    </SectionCard>
  )
}

function OrderSummaryCard({ order }: { order: OrderDetail }) {
  return (
    <SectionCard title="Order summary" icon={Wallet}>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Merchandise</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {money(order.subtotalMinor, order.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Discount</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {order.discountMinor > 0
              ? '−' + money(order.discountMinor, order.currency)
              : money(0, order.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Shipping</dt>
          <dd className="font-semibold text-ink">
            {order.shippingMinor > 0
              ? money(order.shippingMinor, order.currency)
              : 'Free'}
          </dd>
        </div>
        {order.taxMinor > 0 && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Tax</dt>
            <dd className="font-semibold tabular-nums text-ink">
              {money(order.taxMinor, order.currency)}
            </dd>
          </div>
        )}
        <div className="border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-bold text-ink">Order total</dt>
            <dd className="text-xl font-black tabular-nums tracking-tight text-ink">
              {money(order.totalMinor, order.currency)}
            </dd>
          </div>
        </div>
      </dl>
      {(order.couponCode || order.deliveryKind) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.couponCode && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary">
              Coupon: {order.couponCode}
            </span>
          )}
          {order.deliveryKind && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {readableStatus(order.deliveryKind)}
            </span>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function PaymentDetailsCard({
  order,
  id,
  disabled,
  onCancel,
}: {
  order: OrderDetail
  id: string
  disabled: boolean
  onCancel: () => void
}) {
  return (
    <SectionCard title="Payment details" icon={CreditCard}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">Order status</span>
        <StatusBadge status={order.status} />
      </div>
      {order.paidAt ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-muted">Payment confirmed</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {orderDateTime(order.paidAt)}
          </p>
        </div>
      ) : order.status === 'PAID' ? (
        <p className="mt-3 text-xs leading-5 text-muted">
          The server has confirmed payment. A confirmation timestamp is not
          available.
        </p>
      ) : null}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock3 size={15} aria-hidden="true" />
            <p className="text-xs font-bold">Payment deadline</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-amber-900">
            {orderDateTime(order.paymentDeadlineAt)}
          </p>
        </div>
      )}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="mt-4 flex flex-col gap-2">
          <Link
            className={actionClass + ' w-full'}
            href={'/checkout?order=' + id}
          >
            Continue to payment
          </Link>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel unpaid order
          </button>
        </div>
      )}
    </SectionCard>
  )
}

function DeliveryAddressCard({ order }: { order: OrderDetail }) {
  const address = order.shippingAddress
  const lines = [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.region,
    address.postalCode,
    address.countryCode,
  ].filter(Boolean)
  return (
    <SectionCard
      title="Delivery address"
      description="Address saved with this order"
      icon={MapPin}
    >
      <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
        <p className="text-sm font-bold text-ink">{address.recipientName}</p>
        <p className="mt-1 text-sm text-muted">{address.phone}</p>
        <p className="mt-3 text-sm leading-6 text-ink">{lines.join(', ')}</p>
      </div>
    </SectionCard>
  )
}

function ReturnsCard({
  order,
  returns,
  disabled,
  onWithdraw,
  onRequest,
  lineId,
  setLineId,
  quantity,
  setQuantity,
  reason,
  setReason,
}: {
  order: OrderDetail
  returns: ReturnRow[]
  disabled: boolean
  onWithdraw: (returnId: string) => void
  onRequest: (event: FormEvent) => void
  lineId: string
  setLineId: (value: string) => void
  quantity: string
  setQuantity: (value: string) => void
  reason: string
  setReason: (value: string) => void
}) {
  const eligibleLines = order.lines.filter(
    (line) => returnableQuantity(line, returns) > 0,
  )
  const canRequest =
    order.status === 'PAID' && order.fulfillment?.status === 'DELIVERED'
  return (
    <SectionCard
      title="Returns"
      description="Review return requests and their latest status."
      icon={RotateCcw}
      aside={
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {returns.length} {returns.length === 1 ? 'request' : 'requests'}
        </span>
      }
    >
      <p className="mb-4 text-xs leading-5 text-muted">
        A return request does not issue a refund or restock items. Eligibility
        and quantities are checked again by the server.
      </p>
      {returns.length ? (
        <div className="space-y-3">
          {returns.map((row) => {
            const line = order.lines.find((item) => item.id === row.orderLineId)
            return (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">
                      Return {orderReference(row.id)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-ink">
                      {line?.title || 'Order item'}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                  <p>Quantity: {row.quantity}</p>
                  <p>Reason: {readableReason(row.reason)}</p>
                  <p>Requested: {orderDate(row.createdAt)}</p>
                  <p>Updated: {orderDateTime(row.updatedAt)}</p>
                </div>
                {row.status === 'REQUESTED' && (
                  <button
                    type="button"
                    className="mt-3 min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => onWithdraw(row.id)}
                  >
                    Withdraw pending request
                  </button>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No return requests"
          description="If this order becomes eligible for a return, the request option will be available here."
        />
      )}
      {canRequest && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 sm:p-4">
          <h3 className="text-sm font-bold text-ink">Request a return</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            Choose an eligible item and quantity. The server makes the final
            eligibility decision.
          </p>
          {eligibleLines.length ? (
            <form className="mt-4 space-y-3" onSubmit={onRequest}>
              <label className="block text-xs font-bold text-ink">
                Order item
                <select
                  aria-label="Order line"
                  className={inputClass}
                  value={lineId}
                  onChange={(event) => setLineId(event.target.value)}
                  required
                  disabled={disabled}
                >
                  <option value="">Choose an eligible item</option>
                  {eligibleLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.title} · {returnableQuantity(line, returns)}{' '}
                      remaining
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-ink">
                Quantity
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={
                    order.lines.find((line) => line.id === lineId)
                      ? returnableQuantity(
                          order.lines.find((line) => line.id === lineId)!,
                          returns,
                        )
                      : 1
                  }
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={disabled}
                  required
                />
              </label>
              <label className="block text-xs font-bold text-ink">
                Return reason
                <select
                  aria-label="Return reason"
                  className={inputClass}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={disabled}
                >
                  {returnReasons.map((item) => (
                    <option key={item} value={item}>
                      {readableReason(item)}
                    </option>
                  ))}
                </select>
              </label>
              <button className={actionClass} disabled={disabled}>
                Submit return request
              </button>
            </form>
          ) : (
            <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-5 text-muted">
              No remaining quantities are available to request for return.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function ReplacementsCard({
  replacements,
}: {
  replacements: ReplacementRow[]
}) {
  return (
    <SectionCard
      title="Replacements"
      description="Same-SKU replacement activity for this order."
      icon={PackageCheck}
      aside={
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {replacements.length}{' '}
          {replacements.length === 1 ? 'replacement' : 'replacements'}
        </span>
      }
    >
      {replacements.length ? (
        <div className="space-y-3">
          {replacements.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-slate-200 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    Replacement {orderReference(row.id)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink">
                    {row.skuSnapshot || 'Original SKU'}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                <p>Quantity: {row.quantity}</p>
                <p>Related return: {orderReference(row.returnId)}</p>
                <p>Carrier: {row.carrier || 'Not assigned yet'}</p>
                <p>Tracking: {row.trackingNumber || 'Not available yet'}</p>
                {row.shippedAt && (
                  <p>Shipped: {orderDateTime(row.shippedAt)}</p>
                )}
                {row.deliveredAt && (
                  <p>Delivered: {orderDateTime(row.deliveredAt)}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PackageCheck}
          title="No replacements issued"
          description="If a replacement is authorized for this order, its dispatch and delivery details will appear here."
        />
      )}
    </SectionCard>
  )
}

function RefundHistoryCard({ refunds }: { refunds: RefundRow[] }) {
  return (
    <SectionCard
      title="Refund history"
      description="Refund requests and provider-confirmed outcomes."
      icon={Wallet}
      aside={
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {refunds.length} {refunds.length === 1 ? 'record' : 'records'}
        </span>
      }
    >
      {refunds.length ? (
        <div className="space-y-3">
          {refunds.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-slate-200 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    Refund {orderReference(row.id)}
                  </p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-ink">
                    {money(row.amountMinor, row.currency)}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <p className="mt-2 text-xs text-muted">
                Reason: {readableReason(row.reason)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-muted">
                <p>
                  Provider refund ID:{' '}
                  {row.providerRefundSubmitted ? 'Recorded' : 'Not recorded'}
                </p>
                <p>Stock return: Separate operation</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                {row.status === 'SUCCEEDED'
                  ? 'The server has recorded this refund as succeeded.'
                  : 'This record is not confirmation that a refund has succeeded.'}{' '}
                Refund processing and inventory return are separate operations.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No refund requests"
          description="Refund records will appear here if a refund request is created for this order."
        />
      )}
    </SectionCard>
  )
}

export function OrderDetail({ id }: { id: string }) {
  const resource = useOrderResource(id),
    [lineId, setLineId] = useState(''),
    [quantity, setQuantity] = useState('1'),
    [reason, setReason] = useState<string>('OTHER'),
    [formError, setFormError] = useState(''),
    [copied, setCopied] = useState(false)
  const data = resource.data,
    disabled =
      resource.busy || Boolean(resource.pending) || Boolean(resource.error)
  async function requestReturn(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    try {
      if (!data) return
      const line = data.order.lines.find((item) => item.id === lineId)
      if (!line || Number(quantity) > returnableQuantity(line, data.returns))
        throw new Error(
          'Choose an eligible line and remaining return quantity.',
        )
      await resource.act(
        resource.route + '/returns',
        returnPayload(crypto.randomUUID(), lineId, Number(quantity), reason),
      )
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Check return fields.',
      )
    }
  }
  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
    } catch {
      setFormError('Clipboard access was unavailable. Full order ID: ' + id)
    }
  }
  function withdrawReturn(returnId: string) {
    if (window.confirm('Withdraw this pending return request?'))
      void resource.act(resource.route + '/returns/' + returnId + '/cancel', {
        requestId: crypto.randomUUID(),
      })
  }
  function cancelOrder() {
    if (
      window.confirm(
        'Cancel this unpaid order? Paid orders require a separate refund process.',
      )
    )
      void resource.act(resource.route + '/cancel')
  }
  return (
    <section className="w-full min-w-0 space-y-6 pb-6">
      <header className="space-y-4">
        <Link
          href="/account/orders"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to your orders
        </Link>
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[.15em] text-primary">
              YOUR PURCHASE
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Order details
            </h1>
            {data && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-bold text-ink">
                  {orderReference(data.order.id)}
                </span>
                <OrderSnapshot order={data.order} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <button
                type="button"
                onClick={() => void copyOrderId()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:border-primary/30 hover:bg-blue-50 hover:text-primary"
              >
                {copied ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Copy size={16} aria-hidden="true" />
                )}
                {copied ? 'Copied full ID' : 'Copy full order ID'}
              </button>
            )}
            <PendingButton
              busy={resource.loading}
              pendingLabel="Refreshing…"
              className={actionClass + ' gap-2'}
              disabled={resource.busy}
              onClick={() => void resource.refresh()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh order
            </PendingButton>
          </div>
        </div>
        {data && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <CalendarDays size={14} aria-hidden="true" />
            Placed on {orderDateTime(data.order.createdAt)}
          </p>
        )}
      </header>
      <ErrorMessage text={resource.error || formError} />
      {copied && (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          Full order ID copied to clipboard.
        </p>
      )}
      {resource.notice && (
        <p
          role="status"
          className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-primary"
        >
          {resource.notice}
        </p>
      )}
      {resource.pending && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">
            This action is not yet confirmed. Retry the exact request or refresh
            the order ledgers before discarding the local pending action.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionClass}
              disabled={resource.busy}
              onClick={() => void resource.retry()}
            >
              Retry same order action
            </button>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-950"
              disabled={resource.busy}
              onClick={() => void resource.reconcile()}
            >
              Reconcile order action
            </button>
          </div>
        </div>
      )}
      {data ? (
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
          <div className="order-2 min-w-0 space-y-5 xl:order-1">
            <OrderItemsCard order={data.order} />
            <TrackingTimeline tracking={data.tracking} />
            <ReturnsCard
              order={data.order}
              returns={data.returns}
              disabled={disabled}
              onWithdraw={withdrawReturn}
              onRequest={requestReturn}
              lineId={lineId}
              setLineId={setLineId}
              quantity={quantity}
              setQuantity={setQuantity}
              reason={reason}
              setReason={setReason}
            />
            <ReplacementsCard replacements={data.replacements} />
            <RefundHistoryCard refunds={data.refunds} />
          </div>
          <aside className="order-1 min-w-0 space-y-5 xl:sticky xl:top-28 xl:order-2">
            <OrderSummaryCard order={data.order} />
            <PaymentDetailsCard
              order={data.order}
              id={id}
              disabled={disabled}
              onCancel={cancelOrder}
            />
            <DeliveryAddressCard order={data.order} />
          </aside>
        </div>
      ) : (
        !resource.error && (
          <ContentSkeleton variant="list" label="Loading order and ledgers" />
        )
      )}
    </section>
  )
}

export function OrderTracking() {
  const [draft, setDraft] = useState(''),
    [id, setId] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('order')
    if (value && isOrderId(value)) {
      setDraft(value)
      setId(value)
    }
  }, [])
  return (
    <section className="container-shell max-w-4xl space-y-5 py-10">
      <h1 className="text-3xl font-black">Track your order</h1>
      <p className="text-sm text-muted">
        Sign-in required. Enter your own order UUID; public email/order-number
        tracking is unavailable.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const value = draft.trim()
          if (!isOrderId(value)) {
            setError('Enter a canonical order UUID.')
            return
          }
          setError('')
          setId(value)
          window.history.replaceState(null, '', '/track?order=' + value)
        }}
      >
        <label className="grow text-sm font-bold">
          Order UUID
          <input
            className={inputClass}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            required
          />
        </label>
        <button className={actionClass}>Track owned order</button>
      </form>
      <ErrorMessage text={error} />
      {id && <OwnedTracking key={id} id={id} />}
    </section>
  )
}
function OwnedTracking({ id }: { id: string }) {
  const [tracking, setTracking] = useState<Tracking | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setTracking(null)
    setError('')
    const controller = new AbortController()
    void api
      .request<Tracking>('/v1/orders/' + id + '/tracking', {
        signal: controller.signal,
      })
      .then((value) => {
        if (active) setTracking(value)
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Tracking unavailable.')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [id, revision])
  return (
    <div className="space-y-4">
      <ErrorMessage text={error} />
      <button className={actionClass} onClick={() => setRevision((v) => v + 1)}>
        Refresh tracking
      </button>
      {tracking ? (
        <>
          <p className="text-sm">
            Order status: <StatusBadge status={tracking.orderStatus} />
          </p>
          <TrackingTimeline tracking={tracking} />
          <SectionCard
            title="Replacement dispatches"
            description="Delivery information for any replacement linked to this order."
            icon={PackageCheck}
          >
            {tracking.replacements.length ? (
              <div className="space-y-3">
                {tracking.replacements.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-ink">
                        Replacement {orderReference(row.id)}
                      </p>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Quantity: {row.quantity} · Carrier:{' '}
                      {row.carrier || 'Not assigned yet'}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted">
                      Tracking: {row.trackingNumber || 'Not available yet'}
                    </p>
                    {row.shippedAt && (
                      <p className="mt-1 text-xs text-muted">
                        Shipped: {orderDateTime(row.shippedAt)}
                      </p>
                    )}
                    {row.deliveredAt && (
                      <p className="mt-1 text-xs text-muted">
                        Delivered: {orderDateTime(row.deliveredAt)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={PackageCheck}
                title="No replacement dispatches"
                description="Replacement shipment information will appear here when available."
              />
            )}
          </SectionCard>
          <Link
            href={'/account/orders/' + id}
            className="font-bold text-primary"
          >
            Open order details
          </Link>
        </>
      ) : (
        !error && <p role="status">Loading owned tracking…</p>
      )}
    </div>
  )
}
