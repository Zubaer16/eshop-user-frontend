'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { api, ApiRequestError } from '@/lib/api/client'
import { money } from '@/lib/api/catalog'
import type { Address } from '@/lib/api/shopping'
import {
  canonicalId,
  checkoutSelection,
  shippingSnapshot,
  readTotals,
  readReservation,
  readOrder,
  paymentEligible,
  type Estimate,
  type Reservation,
  type Order,
  type Payment,
  type Recovery,
  type DeliveryOptions,
  type Selection,
  type ShippingAddress,
  type Totals,
} from '@/lib/api/checkout'
import { shoppingLock } from '@/lib/api/guest-cart-client'
import { useCommerce } from './commerce-provider'
import { actionClass, inputClass, ErrorMessage } from './cart'

type Intent =
  | { kind: 'reserve'; body: Selection & { requestId: string } }
  | {
      kind: 'order'
      body: {
        requestId: string
        reservationId: string
        shippingAddress: ShippingAddress
      }
    }
function TotalsView({ data, total }: { data: Totals; total: number }) {
  return (
    <dl className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      {[
        ['Merchandise', data.subtotalMinor],
        ['Discount', -data.discountMinor],
        ['Shipping', data.shippingMinor],
        ['Tax', data.taxMinor],
        ['Total', total],
      ].map(([label, value]) => (
        <div key={String(label)} className="flex justify-between gap-4">
          <dt>{label}</dt>
          <dd className="font-bold">{money(Number(value), data.currency)}</dd>
        </div>
      ))}
    </dl>
  )
}
export function LiveCheckout() {
  const shopping = useCommerce()
  const [addresses, setAddresses] = useState<Address[]>([]),
    [addressId, setAddressId] = useState(''),
    [coupon, setCoupon] = useState(''),
    [kind, setKind] = useState(''),
    [options, setOptions] = useState<DeliveryOptions | null>(null),
    [estimate, setEstimate] = useState<Estimate | null>(null),
    [hold, setHold] = useState<Reservation | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [payment, setPayment] = useState<Payment | null>(null),
    [intent, setIntent] = useState<Intent | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [now, setNow] = useState(Date.now())
  const mounted = useRef(true),
    writing = useRef(false),
    owner = useRef(api.getSnapshot())
  const address = addresses.find((a) => a.id === addressId)
  const cartBlocked =
    shopping.loading ||
    shopping.busy ||
    Boolean(
      shopping.pending || shopping.cartError || shopping.guest?.items.length,
    )
  function guard() {
    const current = api.getSnapshot()
    if (
      !mounted.current ||
      current.epoch !== owner.current.epoch ||
      current.user?.id !== owner.current.user?.id ||
      current.status !== 'authenticated'
    )
      throw new Error('The account changed. Reopen checkout.')
  }
  async function loadOrder(id: string) {
    const row = readOrder(await api.request<Order>('/v1/orders/' + id))
    const p = await api.request<Payment | null>('/v1/payments/orders/' + id)
    guard()
    setOrder(row)
    setPayment(p)
    window.history.replaceState(null, '', '/checkout?order=' + row.id)
    return row
  }
  async function recover() {
    const result = await api.request<Recovery>('/v1/checkout/recovery')
    guard()
    setHold(result.reservation ? readReservation(result.reservation) : null)
    const query = new URLSearchParams(window.location.search).get('order')
    if (query && !canonicalId(query))
      throw new Error('Invalid order identifier.')
    const id =
      query || (result.reservation?.status === 'ACTIVE' ? null : result.orderId)
    if (id) await loadOrder(id)
    return result
  }
  useEffect(() => {
    mounted.current = true
    void (async () => {
      try {
        const { items: rows } = await api.request<{ items: Address[] }>(
          '/v1/account/addresses',
        )
        guard()
        setAddresses(rows)
        setAddressId(rows.find((a) => a.isDefault)?.id || rows[0]?.id || '')
        await recover()
      } catch (e) {
        if (mounted.current)
          setError(
            e instanceof Error ? e.message : 'Could not restore checkout.',
          )
      } finally {
        if (mounted.current) setLoading(false)
      }
    })()
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      mounted.current = false
      clearInterval(clock)
    }
    // The authenticated boundary remounts this component on owner/epoch changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!intent) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [intent])
  async function run(work: () => Promise<void>) {
    if (writing.current) return
    writing.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await shoppingLock(async () => {
        guard()
        await work()
        guard()
      })
    } catch (e) {
      if (mounted.current)
        setError(
          (e instanceof Error ? e.message : 'The request was not confirmed.') +
            (e instanceof ApiRequestError && e.retryAfterSeconds
              ? ` Retry after ${e.retryAfterSeconds} seconds.`
              : ''),
        )
    } finally {
      writing.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function invalidate() {
    setEstimate(null)
    setOptions(null)
  }
  async function send(value: Intent) {
    guard()
    if (value.kind === 'reserve') {
      const row = readReservation(
        await api.request<Reservation>('/v1/checkout/reservations', {
          method: 'POST',
          body: value.body,
        }),
      )
      guard()
      setHold(row)
    } else {
      const row = readOrder(
        await api.request<Order>('/v1/orders', {
          method: 'POST',
          body: value.body,
        }),
      )
      guard()
      setOrder(row)
      setPayment(null)
      setHold(null)
      window.history.replaceState(null, '', '/checkout?order=' + row.id)
    }
    setIntent(null)
    shopping.reload()
  }
  const active = hold?.status === 'ACTIVE',
    expired = Boolean(hold && Date.parse(hold.expiresAt) <= now)
  return (
    <section className="container-shell max-w-4xl space-y-6 py-10">
      <h1 className="text-3xl font-black">Checkout</h1>
      <p className="text-sm text-muted">
        TEST checkout. No live card details are collected. Orders use their
        UUID.
      </p>
      <Link href="/cart" className="font-bold text-primary">
        Review your cart
      </Link>
      <ErrorMessage text={error} />
      {notice && (
        <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Restoring checkout…</p>
      ) : (
        <>
          <button
            className="text-sm font-bold text-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await recover()
                shopping.reload()
                setNotice('Current server checkout state refreshed.')
              })
            }
          >
            Refresh checkout status
          </button>
          {intent && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p>
                The {intent.kind === 'reserve' ? 'reservation' : 'order'}{' '}
                request is unconfirmed. Retry the exact request; do not create
                another request.
              </p>
              <button
                className={actionClass}
                disabled={busy}
                onClick={() => void run(() => send(intent))}
              >
                Retry same request
              </button>
              <p className="text-xs">
                After a reload, Refresh checkout status discovers the server
                hold or unpaid order. No delivery address is stored in browser
                storage.
              </p>
            </div>
          )}
          {order ? (
            <section className="space-y-5 rounded-2xl border border-slate-200 p-5">
              <h2 className="text-xl font-black">Order {order.id}</h2>
              <Link
                href={'/account/orders/' + order.id}
                className="text-sm font-bold text-primary"
              >
                Open order details and tracking
              </Link>
              <p role="status">
                Order status: <strong>{order.status}</strong>
              </p>
              <TotalsView data={order} total={order.totalMinor} />
              {order.lines.map((line) => (
                <p key={line.id} className="text-sm">
                  {line.title} · {line.sku || 'No SKU'} · {line.quantity} units
                  · {money(line.netLineTotalMinor, order.currency)}
                </p>
              ))}
              <p className="text-sm">
                Payment deadline: {order.paymentDeadlineAt}
              </p>
              {order.status === 'PAID' ? (
                <p className="font-bold text-green-800">
                  Payment confirmed by the server.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    Payment preparation:{' '}
                    {payment?.preparationStatus || 'Not prepared'}. Payment
                    completion requests still require signed webhook settlement.
                  </p>
                  {order.status === 'PENDING_PAYMENT' &&
                    Date.parse(order.paymentDeadlineAt) > now && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          className={actionClass}
                          disabled={
                            busy ||
                            Boolean(intent) ||
                            Boolean(
                              payment &&
                              !['CREATING', 'READY'].includes(
                                payment.preparationStatus,
                              ),
                            )
                          }
                          onClick={() =>
                            void run(async () => {
                              await loadOrder(order.id)
                              const p = await api.request<Payment>(
                                '/v1/payments/orders/' + order.id + '/prepare',
                                { method: 'POST' },
                              )
                              guard()
                              setPayment(p)
                              setNotice(
                                'TEST preparation returned. This does not confirm payment.',
                              )
                            })
                          }
                        >
                          Prepare TEST payment
                        </button>
                        <button
                          className={actionClass}
                          disabled={
                            busy || !paymentEligible(order, payment, now)
                          }
                          onClick={() => {
                            if (
                              window.confirm(
                                'Run the explicitly enabled TEST card simulation? No real card details are accepted.',
                              )
                            )
                              void run(async () => {
                                const fresh = await loadOrder(order.id)
                                if (fresh.status !== 'PENDING_PAYMENT') return
                                await api.request(
                                  '/v1/payments/orders/' +
                                    order.id +
                                    '/test-complete',
                                  { method: 'POST' },
                                )
                                guard()
                                setNotice(
                                  'TEST completion requested. Refresh status to check server settlement.',
                                )
                                await loadOrder(order.id)
                              })
                          }}
                        >
                          Simulate TEST payment
                        </button>
                      </div>
                    )}
                  {order.status === 'PENDING_PAYMENT' && (
                    <button
                      className="text-sm font-bold text-red-700"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this unpaid order? Payment cancellation may require server reconciliation.',
                          )
                        )
                          void run(async () => {
                            const row = readOrder(
                              await api.request<Order>(
                                '/v1/orders/' + order.id + '/cancel',
                                {
                                  method: 'POST',
                                },
                              ),
                            )
                            guard()
                            setOrder(row)
                            shopping.reload()
                          })
                      }}
                    >
                      Cancel unpaid order
                    </button>
                  )}
                </>
              )}
              {order.status !== 'PENDING_PAYMENT' && (
                <button
                  className={actionClass}
                  disabled={busy}
                  onClick={() => {
                    setOrder(null)
                    setPayment(null)
                    setHold(null)
                    setEstimate(null)
                    setOptions(null)
                    setIntent(null)
                    window.history.replaceState(null, '', '/checkout')
                    shopping.reload()
                  }}
                >
                  Start a new checkout
                </button>
              )}
            </section>
          ) : (
            <>
              {cartBlocked && (
                <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm">
                  Resolve guest items, unconfirmed changes or cart errors in
                  your cart before starting checkout.
                </p>
              )}
              {!addresses.length && (
                <Link href="/account/addresses" className={actionClass}>
                  Add a saved delivery address
                </Link>
              )}
              <label className="block text-sm font-bold">
                Delivery address
                <select
                  className={inputClass}
                  value={addressId}
                  disabled={busy || active || Boolean(intent)}
                  onChange={(e) => {
                    setAddressId(e.target.value)
                    setKind('')
                    invalidate()
                  }}
                >
                  <option value="">Select your address</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}: {a.recipientName}, {a.addressLine1}, {a.city},{' '}
                      {a.countryCode}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                href="/account/addresses"
                className="text-sm font-bold text-primary"
              >
                Manage saved addresses
              </Link>
              <label className="block text-sm font-bold">
                Coupon code (optional)
                <input
                  className={inputClass}
                  maxLength={24}
                  value={coupon}
                  disabled={busy || active || Boolean(intent)}
                  onChange={(e) => {
                    setCoupon(e.target.value)
                    invalidate()
                  }}
                />
              </label>
              {!active && !intent && (
                <button
                  className={actionClass}
                  disabled={
                    busy ||
                    cartBlocked ||
                    !address ||
                    !shopping.cart?.checkoutReady
                  }
                  onClick={() =>
                    void run(async () => {
                      if (!address) return
                      invalidate()
                      const selection = checkoutSelection(
                        address.countryCode,
                        '',
                        coupon,
                      )
                      const result = await api.request<DeliveryOptions>(
                        '/v1/checkout/delivery-options',
                        { query: selection },
                      )
                      guard()
                      setOptions(result)
                      setKind(result.options[0]?.kind || '')
                    })
                  }
                >
                  Load delivery options
                </button>
              )}
              {options && !active && (
                <label className="block text-sm font-bold">
                  Delivery service
                  <select
                    className={inputClass}
                    value={kind}
                    disabled={busy || Boolean(intent)}
                    onChange={(e) => {
                      setKind(e.target.value)
                      setEstimate(null)
                    }}
                  >
                    {options.options.map((o) => (
                      <option key={o.kind || 'flat'} value={o.kind || ''}>
                        {o.label} · {money(o.shippingMinor, options.currency)} ·{' '}
                        {o.etaNote}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {options && !active && !intent && (
                <button
                  className={actionClass}
                  disabled={busy || cartBlocked || !address}
                  onClick={() =>
                    void run(async () => {
                      if (!address) return
                      setEstimate(null)
                      const result = await api.request<Estimate>(
                        '/v1/checkout/estimate',
                        {
                          method: 'POST',
                          body: checkoutSelection(
                            address.countryCode,
                            kind,
                            coupon,
                          ),
                        },
                      )
                      guard()
                      readTotals(result, result.estimatedTotalMinor)
                      setEstimate(result)
                    })
                  }
                >
                  Calculate current estimate
                </button>
              )}
              {estimate && !active && (
                <div className="space-y-4">
                  <TotalsView
                    data={estimate}
                    total={estimate.estimatedTotalMinor}
                  />
                  <p className="text-sm">
                    Estimate only · {estimate.quotedAt} ·{' '}
                    {estimate.deliveryEtaNote}. Stock is not held yet.
                  </p>
                  <button
                    className={actionClass}
                    disabled={
                      busy || cartBlocked || Boolean(intent) || !address
                    }
                    onClick={() =>
                      void run(async () => {
                        if (!address) return
                        const value: Intent = {
                          kind: 'reserve',
                          body: {
                            ...checkoutSelection(
                              address.countryCode,
                              kind,
                              coupon,
                            ),
                            requestId: crypto.randomUUID(),
                          },
                        }
                        setIntent(value)
                        await send(value)
                      })
                    }
                  >
                    Reserve current stock for 10 minutes
                  </button>
                </div>
              )}
              {hold && (
                <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                  <h2 className="text-xl font-black">
                    Stock hold: {hold.status}
                  </h2>
                  <p className="text-sm">
                    {hold.id} · expires {hold.expiresAt}
                    {expired ? ' · Refresh status: hold deadline passed' : ''}
                  </p>
                  <TotalsView data={hold} total={hold.estimatedTotalMinor} />
                  <p className="text-sm">
                    Review the reserved totals. They can differ from the earlier
                    estimate.
                  </p>
                  {active && (
                    <>
                      <button
                        className={actionClass}
                        disabled={
                          busy ||
                          expired ||
                          Boolean(intent) ||
                          cartBlocked ||
                          !address ||
                          address.countryCode !== hold.countryCode
                        }
                        onClick={() =>
                          void run(async () => {
                            if (!address) return
                            const fresh = readReservation(
                              await api.request<Reservation>(
                                '/v1/checkout/reservations/' + hold.id,
                              ),
                            )
                            guard()
                            setHold(fresh)
                            if (
                              fresh.status !== 'ACTIVE' ||
                              Date.parse(fresh.expiresAt) <= Date.now()
                            )
                              throw new Error(
                                'Stock hold has expired. Release/refresh and start again.',
                              )
                            const value: Intent = {
                              kind: 'order',
                              body: {
                                requestId: crypto.randomUUID(),
                                reservationId: hold.id,
                                shippingAddress: shippingSnapshot(address),
                              },
                            }
                            setIntent(value)
                            await send(value)
                          })
                        }
                      >
                        Create unpaid order
                      </button>
                      <button
                        className="ml-4 text-sm font-bold text-red-700"
                        disabled={busy || Boolean(intent)}
                        onClick={() =>
                          void run(async () => {
                            const row = readReservation(
                              await api.request<Reservation>(
                                '/v1/checkout/reservations/' + hold.id,
                                { method: 'DELETE' },
                              ),
                            )
                            guard()
                            setHold(row)
                            setEstimate(null)
                            shopping.reload()
                          })
                        }
                      >
                        Release stock hold
                      </button>
                      {address?.countryCode !== hold.countryCode && (
                        <p className="text-sm text-amber-800">
                          Choose a saved address in {hold.countryCode}, or
                          release the hold to change destination.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
