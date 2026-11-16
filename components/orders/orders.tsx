'use client'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { PendingButton } from '@/components/ui/pending-button'
import Link from '@/components/ui/app-link'
import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
  type LucideIcon,
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
  type Tracking,
} from '@/lib/api/orders'
import { useAccountResource } from '@/components/account/use-account-resource'
import { prefetchOrder } from '@/components/account/account-preload'
import { useOrderResource } from './resource'
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
export function OrderSnapshot({ order }: { order: OrderDetail }) {
  const a = order.shippingAddress
  return (
    <>
      <p role="status" className="font-bold">
        Order status: {order.status} · Shipment:{' '}
        {order.fulfillment?.status || 'Not started'}
      </p>
      <dl className="space-y-2 rounded-xl bg-slate-50 p-4">
        {[
          ['Merchandise', order.subtotalMinor],
          ['Discount', -order.discountMinor],
          ['Shipping', order.shippingMinor],
          ...(order.taxMinor > 0 ? [['Tax', order.taxMinor]] : []),
          ['Order total', order.totalMinor],
        ].map(([label, value]) => (
          <div className="flex justify-between" key={String(label)}>
            <dt>{label}</dt>
            <dd>{money(Number(value), order.currency)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm">
        {order.deliveryKind || 'Flat delivery'} · Coupon:{' '}
        {order.couponCode || 'None'} · Created {order.createdAt}
      </p>
      <div className="rounded-xl border p-4 text-sm">
        <h3 className="font-bold">Delivery address snapshot</h3>
        <p>
          {a.recipientName} · {a.phone}
        </p>
        <p>
          {[
            a.addressLine1,
            a.addressLine2,
            a.city,
            a.region,
            a.postalCode,
            a.countryCode,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>
      <div className="space-y-3">
        {order.lines.map((line) => (
          <article key={line.id} className="rounded-xl border p-4 text-sm">
            <p className="font-bold">{line.title}</p>
            <p>
              {line.sku || 'No SKU'} · {line.quantity} units ·{' '}
              {money(line.unitPriceMinor, order.currency)} per unit
            </p>
            <p>
              Net line total: {money(line.netLineTotalMinor, order.currency)}
            </p>
          </article>
        ))}
      </div>
    </>
  )
}
export function TrackingTimeline({ tracking }: { tracking: Tracking }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Tracking timeline</h2>
      {tracking.originalShipment && (
        <p className="text-sm">
          {tracking.originalShipment.status} ·{' '}
          {tracking.originalShipment.carrier || 'Carrier pending'} ·{' '}
          {tracking.originalShipment.trackingNumber || 'Tracking pending'}
        </p>
      )}
      <ol className="space-y-2">
        {tracking.events.map((event) => (
          <li key={event.id} className="rounded-xl border p-3 text-sm">
            {event.type} · {event.status} · {event.occurredAt}
          </li>
        ))}
      </ol>
      {!tracking.events.length && <p>No delivery events recorded.</p>}
    </section>
  )
}
export function OrderDetail({ id }: { id: string }) {
  const resource = useOrderResource(id),
    [lineId, setLineId] = useState(''),
    [quantity, setQuantity] = useState('1'),
    [reason, setReason] = useState<string>('OTHER'),
    [formError, setFormError] = useState('')
  const data = resource.data,
    disabled =
      resource.busy || Boolean(resource.pending) || Boolean(resource.error)
  async function requestReturn(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    try {
      if (!data) return
      const line = data.order.lines.find((l) => l.id === lineId)
      if (!line || Number(quantity) > returnableQuantity(line, data.returns))
        throw new Error(
          'Choose an eligible line and remaining return quantity.',
        )
      await resource.act(
        resource.route + '/returns',
        returnPayload(crypto.randomUUID(), lineId, Number(quantity), reason),
      )
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Check return fields.')
    }
  }
  return (
    <section className="container-shell max-w-4xl space-y-5 py-10">
      <h1 className="break-all text-2xl font-black">Order {id}</h1>
      <Link href="/account/orders" className="font-bold text-primary">
        Your orders
      </Link>
      <ErrorMessage text={resource.error || formError} />
      <PendingButton
        busy={resource.loading}
        pendingLabel="Refreshing order…"
        className={actionClass}
        disabled={resource.busy}
        onClick={() => void resource.refresh()}
      >
        Refresh order
      </PendingButton>
      {resource.notice && (
        <p role="status" className="text-sm text-primary">
          {resource.notice}
        </p>
      )}
      {resource.pending && (
        <div className="space-y-3 rounded-xl bg-amber-50 p-4">
          <p>
            The action is unconfirmed. Retry the exact request or read the
            ledgers before discarding it.
          </p>
          <button
            className={actionClass}
            disabled={resource.busy}
            onClick={() => void resource.retry()}
          >
            Retry same order action
          </button>
          <button
            className="ml-3 font-bold text-primary"
            disabled={resource.busy}
            onClick={() => void resource.reconcile()}
          >
            Reconcile order action
          </button>
        </div>
      )}
      {data ? (
        <>
          <OrderSnapshot order={data.order} />
          {data.order.status === 'PENDING_PAYMENT' && (
            <div className="flex flex-wrap gap-4">
              <Link className={actionClass} href={'/checkout?order=' + id}>
                Open TEST payment status
              </Link>
              <button
                className={actionClass}
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      'Cancel this unpaid order? Paid orders require a separate refund process.',
                    )
                  )
                    void resource.act(resource.route + '/cancel')
                }}
              >
                Cancel unpaid order
              </button>
            </div>
          )}
          <TrackingTimeline tracking={data.tracking} />
          <h2 className="text-xl font-bold">Returns</h2>
          <p className="text-sm text-muted">
            A return request does not issue a refund or restock items.
            Quantities and eligibility are checked again by the server.
          </p>
          {data.returns.map((row) => (
            <article
              key={row.id}
              className="space-y-2 rounded-xl border p-4 text-sm"
            >
              <p className="font-bold">Return {row.id}</p>
              <p>
                {data.order.lines.find((l) => l.id === row.orderLineId)
                  ?.title || row.orderLineId}{' '}
                · {row.quantity} units · {row.reason} · {row.status}
              </p>
              {row.status === 'REQUESTED' && (
                <button
                  className={actionClass}
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm('Withdraw this pending return request?'))
                      void resource.act(
                        resource.route + '/returns/' + row.id + '/cancel',
                        {
                          requestId: crypto.randomUUID(),
                        },
                      )
                  }}
                >
                  Withdraw return request
                </button>
              )}
            </article>
          ))}
          {!data.returns.length && (
            <p className="text-sm">No return requests.</p>
          )}
          {data.order.status === 'PAID' &&
            data.order.fulfillment?.status === 'DELIVERED' && (
              <form
                className="space-y-4 rounded-2xl border p-5"
                onSubmit={requestReturn}
              >
                <h3 className="font-bold">Request a return</h3>
                <label className="block text-sm font-bold">
                  Order line
                  <select
                    aria-label="Order line"
                    className={inputClass}
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    required
                    disabled={disabled}
                  >
                    <option value="">Choose an eligible line</option>
                    {data.order.lines
                      .filter((l) => returnableQuantity(l, data.returns) > 0)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title} · {l.sku} ·{' '}
                          {returnableQuantity(l, data.returns)} remaining
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm font-bold">
                  Return quantity
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={
                      data.order.lines.find((l) => l.id === lineId)
                        ? returnableQuantity(
                            data.order.lines.find((l) => l.id === lineId)!,
                            data.returns,
                          )
                        : 1
                    }
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={disabled}
                    required
                  />
                </label>
                <label className="block text-sm font-bold">
                  Return reason
                  <select
                    aria-label="Return reason"
                    className={inputClass}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={disabled}
                  >
                    {returnReasons.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <button className={actionClass} disabled={disabled}>
                  Submit return request
                </button>
              </form>
            )}
          <h2 className="text-xl font-bold">Same-SKU replacements</h2>
          {data.replacements.map((row) => (
            <article key={row.id} className="rounded-xl border p-4 text-sm">
              <p>
                {row.id} · {row.quantity} units · {row.skuSnapshot} ·{' '}
                {row.status}
              </p>
              <p>
                {row.carrier || 'Carrier pending'} ·{' '}
                {row.trackingNumber || 'Tracking pending'}
              </p>
            </article>
          ))}
          {!data.replacements.length && (
            <p className="text-sm">No replacements.</p>
          )}
          <h2 className="text-xl font-bold">Refund history</h2>
          {data.refunds.map((row) => (
            <article key={row.id} className="rounded-xl border p-4 text-sm">
              <p>
                {money(row.amountMinor, row.currency)} · {row.status}
              </p>
              <p>
                {row.status === 'SUCCEEDED'
                  ? 'Refund confirmed by the server.'
                  : 'Request status only; refund is not confirmed.'}{' '}
                Stock return is separate.
              </p>
            </article>
          ))}
          {!data.refunds.length && (
            <p className="text-sm">No refund requests.</p>
          )}
        </>
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
          <p>Order: {tracking.orderStatus}</p>
          <TrackingTimeline tracking={tracking} />
          <h2 className="font-bold">Replacement dispatches</h2>
          {tracking.replacements.map((row) => (
            <p key={row.id} className="text-sm">
              {row.id} · {row.status} · {row.carrier} · {row.trackingNumber}
            </p>
          ))}
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
