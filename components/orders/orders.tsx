'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '@/lib/api/client'
import { money } from '@/lib/api/catalog'
import {
  isOrderId,
  returnReasons,
  returnPayload,
  returnableQuantity,
  type OrderPage,
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

export function OrderHistory() {
  const [page, setPage] = useState(1)
  const { data, error, reload } = useAccountResource<OrderPage>('/v1/orders', {
    page,
    limit: 20,
  })
  return (
    <section className="container-shell max-w-5xl space-y-5 py-10">
      <h1 className="text-3xl font-black">Your orders</h1>
      <Link href="/account" className="text-sm font-bold text-primary">
        Your account
      </Link>
      <p className="text-sm text-muted">
        Owned orders, newest first. Payment and delivery states are separate.
      </p>
      <ErrorMessage text={error} />
      <button className={actionClass} onClick={reload}>
        Refresh orders
      </button>
      {data ? (
        <>
          <div className="space-y-4">
            {data.items.map((row) => (
              <article
                key={row.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <Link
                  className="break-all font-bold text-primary"
                  href={'/account/orders/' + row.id}
                  onMouseEnter={() => prefetchOrder(row.id)}
                  onFocus={() => prefetchOrder(row.id)}
                  onTouchStart={() => prefetchOrder(row.id)}
                >
                  {row.id}
                </Link>
                <p className="text-sm">
                  Order: {row.status} · Shipment:{' '}
                  {row.fulfillment?.status || 'Not started'}
                </p>
                <p className="font-bold">
                  {money(row.totalMinor, row.currency)}
                </p>
                <p className="text-xs text-muted">Created {row.createdAt}</p>
              </article>
            ))}
            {!data.items.length && <p>No orders on this account.</p>}
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>
              {data.total} orders · Page {data.page} of{' '}
              {Math.max(1, data.pages)}
            </span>
            <button
              className={actionClass}
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous orders
            </button>
            <button
              className={actionClass}
              disabled={page >= data.pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Next orders
            </button>
          </div>
        </>
      ) : (
        !error && <p role="status">Loading your orders…</p>
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
      <button
        className={actionClass}
        disabled={resource.busy}
        onClick={() => void resource.refresh()}
      >
        Refresh order
      </button>
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
        !resource.error && <p role="status">Loading order and ledgers…</p>
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
