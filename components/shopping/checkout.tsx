'use client'
import Link from 'next/link'
import { ChevronRight, LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, ApiRequestError } from '@/lib/api/client'
import { money } from '@/lib/api/catalog'
import type { Address } from '@/lib/api/shopping'
import {
  canonicalId,
  checkoutSelection,
  shippingSnapshot,
  readOrder,
  readReservation,
  hostedCheckout,
  stockShortages,
  type StockShortage,
  type Payment,
  type Order,
  type DeliveryOptions,
  type Recovery,
  type Reservation,
  type Selection,
  type ShippingAddress,
} from '@/lib/api/checkout'
import { useAccountResource } from '@/components/account/use-account-resource'
import { shoppingLock } from '@/lib/api/shopping-lock'
import { checkoutItems } from '@/lib/stores/local-cart'
import { useCommerce } from './commerce-provider'
import { actionClass, inputClass, ErrorMessage } from './cart'

type CheckoutIntent = Selection & {
  requestId: string
  items: ReturnType<typeof checkoutItems>
  shippingAddress: ShippingAddress
}

export function Checkout() {
  const shopping = useCommerce()
  const addressResource = useAccountResource<{ items: Address[] }>(
    '/v1/account/addresses',
  )
  const addresses = addressResource.data?.items ?? []
  const [addressId, setAddressId] = useState(
    () => addresses.find((row) => row.isDefault)?.id || addresses[0]?.id || '',
  )
  const [coupon, setCoupon] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [kind, setKind] = useState('')
  const [options, setOptions] = useState<DeliveryOptions | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [hold, setHold] = useState<Reservation | null>(null)
  const [intent, setIntent] = useState<CheckoutIntent | null>(null)
  const [shortages, setShortages] = useState<StockShortage[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [error, setError] = useState('')
  const [deliveryError, setDeliveryError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)
  const writing = useRef(false)
  const redirecting = useRef(false)
  const owner = useRef(api.getSnapshot())
  const address = addresses.find((row) => row.id === addressId)
  const activeHold = hold?.status === 'ACTIVE'
  const cartBlocked =
    shopping.loading ||
    shopping.busy ||
    Boolean(shopping.cartError || shopping.guestMergeError)
  const cartVersion =
    shopping.cart?.items
      .map((line) => [line.id, line.quantity, line.unitPriceMinor].join(':'))
      .join('|') || ''
  const selectedDelivery = options?.options.find(
    (option) => (option.kind || '') === kind,
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
    let current = readOrder(await api.request<Order>('/v1/orders/' + id))
    const prepared = await api.request<Payment | null>(
      '/v1/payments/orders/' + id,
    )
    guard()
    if (current.status === 'PENDING_PAYMENT' && prepared?.checkoutStarted) {
      current = readOrder(
        await api.request<Order>('/v1/checkout/orders/' + id + '/reconcile', {
          method: 'POST',
          timeoutMs: 45000,
        }),
      )
      guard()
    }
    if (current.status === 'PAID')
      await shopping.completeCheckout(current.requestId)
    guard()
    setOrder(current)
    setPayment(prepared)
    return { order: current, payment: prepared }
  }
  async function recover() {
    const result = await api.request<Recovery>('/v1/checkout/recovery')
    guard()
    const reservation = result.reservation
      ? readReservation(result.reservation)
      : null
    setHold(reservation)
    const query = new URLSearchParams(window.location.search)
    const id = query.get('order') || result.orderId
    if (id && !canonicalId(id)) throw new Error('Invalid order identifier.')
    if (id) {
      if (query.get('result') === 'cancel') {
        await api.request('/v1/checkout/orders/' + id + '/cancel', {
          method: 'POST',
          timeoutMs: 45000,
        })
        guard()
        window.history.replaceState(null, '', '/checkout?order=' + id)
      }
      return { reservation, checkout: await loadOrder(id) }
    }
    return { reservation, checkout: null }
  }
  useEffect(() => {
    mounted.current = true
    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search)
        if (query.has('order')) {
          setLoading(true)
          await recover()
        }
      } catch (failure) {
        if (mounted.current)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not restore checkout.',
          )
      } finally {
        if (mounted.current) setLoading(false)
      }
    })()
    return () => {
      mounted.current = false
    }
    // The authenticated boundary remounts this component when the account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const saved = addressResource.data?.items
    if (!saved) return
    setAddressId((previous) =>
      saved.some((row) => row.id === previous)
        ? previous
        : saved.find((row) => row.isDefault)?.id || saved[0]?.id || '',
    )
  }, [addressResource.data])
  useEffect(() => {
    if (!cartVersion) {
      setOptions(null)
      setDeliveryLoading(false)
      return
    }
    if (loading || cartBlocked || order || activeHold || intent || !address)
      return
    const controller = new AbortController()
    let active = true
    setDeliveryLoading(true)
    setOptions(null)
    void api
      .request<DeliveryOptions>('/v1/checkout/delivery-options', {
        method: 'POST',
        body: {
          ...checkoutSelection(address.countryCode, '', appliedCoupon),
          items: checkoutItems(shopping.cart),
        },
        signal: controller.signal,
      })
      .then((result) => {
        guard()
        if (!active) return
        setOptions(result)
        setKind((previous) =>
          result.options.some((option) => (option.kind || '') === previous)
            ? previous
            : result.options[0]?.kind || '',
        )
        setDeliveryError('')
      })
      .catch((failure) => {
        if (active && mounted.current)
          setDeliveryError(
            failure instanceof Error
              ? failure.message
              : 'Delivery options could not be loaded.',
          )
      })
      .finally(() => {
        if (active) setDeliveryLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
    // A saved cart/address/coupon change refreshes delivery charges without reading inventory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    cartBlocked,
    order?.id,
    activeHold,
    intent,
    addressId,
    address?.countryCode,
    appliedCoupon,
    cartVersion,
  ])
  useEffect(() => {
    if (!intent) return
    const warn = (event: BeforeUnloadEvent) => {
      if (!redirecting.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [intent])
  useEffect(() => {
    if (
      order?.status !== 'PENDING_PAYMENT' ||
      !payment?.checkoutStarted ||
      new URLSearchParams(window.location.search).get('result') !== 'success'
    )
      return
    let attempts = 0
    const timer = window.setInterval(() => {
      if (++attempts >= 12) window.clearInterval(timer)
      if (!writing.current)
        void run(async () => {
          await loadOrder(order.id)
        })
    }, 5000)
    return () => window.clearInterval(timer)
    // Payment success comes from server reconciliation after the Stripe return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status, payment?.checkoutStarted])

  async function run(work: () => Promise<void>, lockCart = true) {
    if (writing.current) return
    writing.current = true
    let finishCheckout = () => {}
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (lockCart) finishCheckout = shopping.beginCheckout()
      const guarded = async () => {
        guard()
        await work()
        guard()
      }
      if (lockCart) await shoppingLock(guarded)
      else await guarded()
    } catch (failure) {
      if (!mounted.current) return
      const stock =
        failure instanceof ApiRequestError
          ? stockShortages(failure.details)
          : []
      if (stock.length) {
        setShortages(stock)
        setIntent(null)
      } else {
        if (
          failure instanceof ApiRequestError &&
          [400, 401, 403, 404, 409, 422, 429].includes(failure.status)
        )
          setIntent(null)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Checkout could not be confirmed.',
        )
      }
    } finally {
      writing.current = false
      finishCheckout()
      if (mounted.current) setBusy(false)
    }
  }
  async function resumeOrder(id: string) {
    const result = hostedCheckout(
      await api.request('/v1/checkout/orders/' + id + '/session', {
        method: 'POST',
        timeoutMs: 45000,
      }),
    )
    guard()
    redirecting.current = true
    window.location.assign(result.url)
  }
  async function start(value: CheckoutIntent) {
    await shopping.rememberCheckout(value.requestId, value.items)
    guard()
    const result = hostedCheckout(
      await api.request('/v1/checkout/start', {
        method: 'POST',
        body: value,
        timeoutMs: 45000,
      }),
    )
    guard()
    redirecting.current = true
    window.location.assign(result.url)
  }
  async function resolveStock(line: StockShortage, remove: boolean) {
    const confirmed = remove
      ? await shopping.remove(line.itemId)
      : await shopping.setQuantity({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.availableQuantity,
        })
    guard()
    if (confirmed)
      setShortages((previous) =>
        previous.filter((row) => row.itemId !== line.itemId),
      )
  }
  return (
    <section className="container-shell pb-20 pt-9">
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/">Home</Link>
        <ChevronRight size={14} />
        <Link href="/cart">Cart</Link>
        <ChevronRight size={14} />
        <span className="font-bold text-ink">Checkout</span>
      </nav>
      <h1 className="mb-7 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Checkout
      </h1>
      <ol
        aria-label="Checkout progress"
        className="mb-7 grid grid-cols-3 gap-2"
      >
        {['Address', 'Delivery', 'Payment'].map((label, index) => {
          const current = order || intent ? 2 : options ? 1 : 0
          return (
            <li
              key={label}
              aria-current={current === index ? 'step' : undefined}
              className={
                'flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold sm:text-sm ' +
                (current === index
                  ? 'border-primary bg-blue-50 text-primary'
                  : 'border-border text-muted')
              }
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current">
                {index + 1}
              </span>
              {label}
            </li>
          )
        })}
      </ol>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6 rounded-[22px] border border-border bg-white p-5 sm:p-7">
          <ErrorMessage
            text={error || deliveryError || addressResource.error}
          />
          {notice && (
            <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm">
              {notice}
            </p>
          )}
          {loading ? (
            <p role="status">Loading checkout…</p>
          ) : order ? (
            <section className="space-y-5">
              <h2 className="break-all text-xl font-bold">Order {order.id}</h2>
              <p role="status">
                Order status: <strong>{order.status}</strong>
              </p>
              <p className="text-xl font-extrabold">
                {money(order.totalMinor, order.currency)}
              </p>
              {order.status === 'PAID' ? (
                <p className="font-bold text-green-800">
                  Payment confirmed. Your order is placed.
                </p>
              ) : order.status === 'PENDING_PAYMENT' ? (
                <>
                  <p className="text-sm text-muted">
                    Your items are reserved while payment is pending.
                  </p>
                  {payment && !payment.checkoutStarted ? (
                    <p className="text-sm text-muted">
                      This order uses an earlier payment preparation. Cancel it
                      to start a new checkout.
                    </p>
                  ) : (
                    <button
                      className={actionClass}
                      disabled={busy}
                      onClick={() => void run(() => resumeOrder(order.id))}
                    >
                      Continue to Stripe Checkout
                    </button>
                  )}
                  <button
                    className="block text-sm font-bold text-red-700"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const current = readOrder(
                          await api.request<Order>(
                            '/v1/checkout/orders/' + order.id + '/cancel',
                            { method: 'POST', timeoutMs: 45000 },
                          ),
                        )
                        guard()
                        setOrder(current)
                        shopping.reload()
                      })
                    }
                  >
                    Cancel checkout
                  </button>
                </>
              ) : (
                <button
                  className={actionClass}
                  disabled={busy}
                  onClick={() => {
                    setOrder(null)
                    setPayment(null)
                    setHold(null)
                    setIntent(null)
                    setShortages([])
                    setOptions(null)
                    window.history.replaceState(null, '', '/checkout')
                    shopping.reload()
                  }}
                >
                  Return to checkout
                </button>
              )}
              <button
                className="block text-sm font-bold text-primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await loadOrder(order.id)
                    shopping.reload()
                  })
                }
              >
                Refresh payment status
              </button>
              <Link
                href={'/account/orders/' + order.id}
                className="block text-sm font-bold text-primary"
              >
                View order details
              </Link>
            </section>
          ) : (
            <>
              <Link href="/cart" className="block w-fit font-bold text-primary">
                Review your cart
              </Link>
              {cartBlocked && (
                <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm">
                  Finish saving your cart and resolve any cart errors before
                  continuing.
                </p>
              )}
              {shortages.length > 0 && (
                <section
                  aria-label="Stock availability"
                  className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <h2 className="font-extrabold">
                    Some quantities need updating
                  </h2>
                  {shortages.map((line) => (
                    <article key={line.itemId} className="space-y-3">
                      <h3 className="font-bold">
                        {line.title}
                        {line.sku ? ' · ' + line.sku : ''}
                      </h3>
                      <p className="text-sm">
                        You requested {line.requestedQuantity}. Only{' '}
                        {line.availableQuantity} are currently available. Reduce
                        the quantity or remove this item to continue.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {line.availableQuantity > 0 && (
                          <button
                            className={actionClass}
                            disabled={busy || cartBlocked}
                            onClick={() =>
                              void run(() => resolveStock(line, false), false)
                            }
                          >
                            Update quantity to {line.availableQuantity}
                          </button>
                        )}
                        <button
                          className="min-h-11 text-sm font-bold text-red-700"
                          disabled={busy || cartBlocked}
                          onClick={() =>
                            void run(() => resolveStock(line, true), false)
                          }
                        >
                          Remove item
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}
              {activeHold ? (
                <div className="space-y-3 rounded-xl bg-blue-50 p-4">
                  <p className="text-sm">
                    A previous checkout is holding stock. Release it to
                    continue.
                  </p>
                  <button
                    className={actionClass}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const released = readReservation(
                          await api.request<Reservation>(
                            '/v1/checkout/reservations/' + hold.id,
                            { method: 'DELETE' },
                          ),
                        )
                        guard()
                        setIntent(null)
                        setHold(null)
                        if (released.status === 'CONSUMED') await recover()
                        shopping.reload()
                      })
                    }
                  >
                    Release previous stock hold
                  </button>
                </div>
              ) : (
                <>
                  {addressResource.loading && !addressResource.data && (
                    <p role="status">Loading delivery addresses…</p>
                  )}
                  {addressResource.error && (
                    <button
                      className={actionClass}
                      onClick={addressResource.reload}
                    >
                      Retry delivery addresses
                    </button>
                  )}
                  {!addressResource.loading && !addresses.length && (
                    <Link href="/account/addresses" className={actionClass}>
                      Add a saved delivery address
                    </Link>
                  )}
                  <label className="block text-sm font-bold">
                    Delivery address
                    <select
                      aria-label="Delivery address"
                      className={inputClass}
                      value={addressId}
                      disabled={busy || Boolean(intent)}
                      onChange={(event) => {
                        setAddressId(event.target.value)
                        setOptions(null)
                      }}
                    >
                      <option value="">Select your address</option>
                      {addresses.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label}: {row.recipientName}, {row.addressLine1},{' '}
                          {row.city}, {row.countryCode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Link
                    href="/account/addresses"
                    className="block w-fit text-sm font-bold text-primary"
                  >
                    Manage saved addresses
                  </Link>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-0 flex-1 text-sm font-bold">
                      Coupon code (optional)
                      <input
                        className={inputClass}
                        maxLength={24}
                        value={coupon}
                        disabled={busy || Boolean(intent)}
                        onChange={(event) => setCoupon(event.target.value)}
                      />
                    </label>
                    <button
                      className={actionClass}
                      disabled={
                        busy ||
                        Boolean(intent) ||
                        appliedCoupon === coupon.trim().toUpperCase()
                      }
                      onClick={() =>
                        setAppliedCoupon(coupon.trim().toUpperCase())
                      }
                    >
                      Apply
                    </button>
                  </div>
                  {deliveryLoading && (
                    <p role="status" className="text-sm">
                      Calculating delivery…
                    </p>
                  )}
                  {options?.options.length === 1 ? (
                    <div
                      role="group"
                      aria-label="Delivery service"
                      className="space-y-2"
                    >
                      <p className="text-sm font-bold">Delivery service</p>
                      <p className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
                        {options.options[0].label} ·{' '}
                        {money(
                          options.options[0].shippingMinor,
                          options.currency,
                        )}
                        {options.options[0].etaNote && (
                          <> · {options.options[0].etaNote}</>
                        )}
                      </p>
                    </div>
                  ) : options?.options.length ? (
                    <label className="block text-sm font-bold">
                      Delivery service
                      <select
                        aria-label="Delivery service"
                        className={inputClass}
                        value={kind}
                        disabled={busy || Boolean(intent)}
                        onChange={(event) => setKind(event.target.value)}
                      >
                        {options.options.map((option) => (
                          <option
                            key={option.kind || 'flat'}
                            value={option.kind || ''}
                          >
                            {option.label} ·{' '}
                            {money(option.shippingMinor, options.currency)} ·{' '}
                            {option.etaNote}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : options ? (
                    <ErrorMessage text="Delivery is unavailable for this destination. Choose another address or contact the store." />
                  ) : null}
                  {intent ? (
                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm">
                        Your checkout could not be confirmed. Retry the same
                        checkout to continue.
                      </p>
                      <button
                        className={actionClass}
                        disabled={busy || cartBlocked}
                        onClick={() => void run(() => start(intent))}
                      >
                        Retry checkout
                      </button>
                    </div>
                  ) : (
                    <button
                      className={actionClass + ' w-full'}
                      disabled={
                        busy ||
                        cartBlocked ||
                        deliveryLoading ||
                        !address ||
                        !selectedDelivery ||
                        shortages.length > 0 ||
                        !shopping.cart?.items.length
                      }
                      onClick={() =>
                        void run(async () => {
                          if (!address) return
                          const value = {
                            ...checkoutSelection(
                              address.countryCode,
                              kind,
                              appliedCoupon,
                            ),
                            requestId: crypto.randomUUID(),
                            items: checkoutItems(shopping.cart),
                            shippingAddress: shippingSnapshot(address),
                          }
                          const recovered = await recover()
                          if (recovered.checkout) {
                            const previous = recovered.checkout
                            if (
                              previous.order.status === 'PENDING_PAYMENT' &&
                              (!previous.payment ||
                                previous.payment.checkoutStarted)
                            )
                              await resumeOrder(previous.order.id)
                            return
                          }
                          if (recovered.reservation?.status === 'ACTIVE') return
                          setIntent(value)
                          setShortages([])
                          await start(value)
                        })
                      }
                    >
                      <LockKeyhole size={16} className="mr-2" />
                      {busy
                        ? 'Preparing checkout…'
                        : 'Continue to Stripe Checkout'}
                    </button>
                  )}
                  <p className="text-xs text-muted">
                    Stock and final prices are confirmed before payment. Your
                    items are reserved while you complete Stripe Checkout.
                  </p>
                </>
              )}
              <button
                className="block text-sm font-bold text-primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await recover()
                    shopping.reload()
                    setNotice('Checkout status refreshed.')
                  })
                }
              >
                Refresh checkout status
              </button>
            </>
          )}
        </div>
        <aside className="space-y-4 rounded-[22px] border border-border bg-[#fbfcff] p-6">
          <h2 className="text-xl font-extrabold">Order summary</h2>
          {order ? (
            <p className="text-xl font-extrabold">
              {money(order.totalMinor, order.currency)}
            </p>
          ) : (
            <>
              <div className="flex justify-between gap-4 text-sm">
                <span>Items</span>
                <strong>
                  {shopping.cart?.currency
                    ? money(shopping.cart.subtotalMinor, shopping.cart.currency)
                    : '—'}
                </strong>
              </div>
              {options && selectedDelivery && (
                <>
                  <div className="flex justify-between gap-4 text-sm">
                    <span>Discount</span>
                    <strong>
                      {money(options.discountMinor, options.currency)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span>Shipping</span>
                    <strong>
                      {money(selectedDelivery.shippingMinor, options.currency)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-4 font-extrabold">
                    <span>Estimated total</span>
                    <span>
                      {money(selectedDelivery.totalMinor, options.currency)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
