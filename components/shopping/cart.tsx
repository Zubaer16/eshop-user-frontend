'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { money } from '@/lib/api/catalog'
import {
  productSelection,
  type CartLine,
  type CartQuote,
} from '@/lib/api/shopping'
import type { Product } from '@/lib/api/catalog'
import { useCommerce } from './commerce-provider'
export const inputClass =
  'mt-2 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus:border-primary focus:outline-none'
export const actionClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
export function ErrorMessage({ text }: { text: string }) {
  return text ? (
    <p
      role="alert"
      className="my-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      {text}
    </p>
  ) : null
}
export function SaveProductButton({
  product,
}: {
  product: Pick<Product, 'id' | 'slug'>
}) {
  const shopping = useCommerce(),
    saved =
      shopping.wishlist?.items.some((item) => item.productId === product.id) ||
      false
  return shopping.authenticated ? (
    <button
      type="button"
      className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-primary disabled:opacity-50"
      aria-pressed={saved}
      disabled={
        shopping.loading || shopping.busy || Boolean(shopping.wishError)
      }
      onClick={() => {
        void shopping.save(product.id, !saved)
      }}
    >
      {saved ? 'Remove saved item' : 'Save item'}
    </button>
  ) : (
    <Link
      className="inline-flex min-h-10 items-center text-sm font-bold text-primary"
      href={'/sign-in?next=' + encodeURIComponent('/product/' + product.slug)}
    >
      Sign in to save
    </Link>
  )
}
export function ProductActions({
  product,
  variantId = '',
  unavailable = false,
  compact = false,
}: {
  product: Product
  variantId?: string
  unavailable?: boolean
  compact?: boolean
}) {
  const shopping = useCommerce(),
    [quantity, setQuantity] = useState(1),
    [error, setError] = useState('')
  const variant = product.variants.find((item) => item.id === variantId),
    available = product.hasVariants
      ? Boolean(variant?.available)
      : product.purchasable
  async function add() {
    setError('')
    try {
      await shopping.add(productSelection(product, variantId, quantity))
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not add this product.',
      )
    }
  }
  return (
    <div
      className={
        compact
          ? 'mt-3 space-y-2'
          : 'mt-7 space-y-4 rounded-2xl border border-slate-200 bg-white p-5'
      }
    >
      {!compact && (
        <label className="block text-sm font-bold">
          Quantity
          <input
            type="number"
            required
            min={1}
            max={99}
            step={1}
            className={inputClass}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
      )}
      {compact && product.hasVariants ? (
        <Link
          href={'/product/' + product.slug}
          className={actionClass + ' w-full'}
        >
          Choose options
        </Link>
      ) : (
        <button
          type="button"
          className={actionClass + ' w-full'}
          disabled={
            shopping.loading ||
            shopping.busy ||
            Boolean(shopping.pending) ||
            !available ||
            unavailable ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 99
          }
          onClick={() => void add()}
        >
          Add to cart
        </button>
      )}
      <SaveProductButton product={product} />
      <ErrorMessage text={error || shopping.cartError || shopping.wishError} />
      {(shopping.cartError || shopping.wishError) && (
        <button
          className="text-sm font-bold text-primary"
          disabled={shopping.busy}
          onClick={shopping.reload}
        >
          Refresh cart and saved items
        </button>
      )}
      {shopping.pending && (
        <Link
          href="/cart"
          className="block text-sm font-bold text-primary"
          onClick={() => shopping.setCartOpen(false)}
        >
          Review unconfirmed cart change
        </Link>
      )}
      {!compact && (
        <p className="text-xs text-muted">
          The server recalculates price and stock. Adding items does not reserve
          stock or create an order.
        </p>
      )}
    </div>
  )
}
function Line({
  item,
  guestPending,
}: {
  item: CartLine
  guestPending: boolean
}) {
  const shopping = useCommerce(),
    [quantity, setQuantity] = useState(String(item.quantity))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const selection = {
      productId: item.productId,
      variantId: item.variantId,
      quantity: Number(quantity),
    }
    await (guestPending
      ? shopping.setGuestQuantity(selection)
      : shopping.setQuantity(selection))
  }
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{item.title}</h3>
          <p className="mt-1 text-xs text-muted">
            SKU: {item.sku || 'Unavailable'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {item.variantId ? 'Selected variant retained' : 'Simple product'}
          </p>
        </div>
        <p className="whitespace-nowrap text-sm font-bold">
          {money(item.lineTotalMinor, item.currency)}
        </p>
      </div>
      <p className="text-xs text-muted">
        {money(item.unitPriceMinor, item.currency)} per unit ·{' '}
        {item.availableQuantity} currently available
      </p>
      {item.status !== 'AVAILABLE' && (
        <p className="text-sm font-semibold text-amber-800">
          {item.status.replaceAll('_', ' ')} — update or remove this item before
          checkout.
        </p>
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <label className="block text-xs font-bold">
          Quantity for {item.sku || item.title}
          <input
            className={inputClass + ' max-w-24'}
            type="number"
            required
            min={1}
            max={99}
            step={1}
            value={quantity}
            disabled={shopping.busy || Boolean(shopping.pending)}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <button
          className={actionClass}
          disabled={shopping.busy || Boolean(shopping.pending)}
          type="submit"
        >
          Update quantity
        </button>
        <button
          type="button"
          className="min-h-11 px-2 text-sm font-bold text-red-700 disabled:opacity-50"
          disabled={shopping.busy || Boolean(shopping.pending)}
          onClick={() => {
            void (guestPending
              ? shopping.removeGuest(item.id)
              : shopping.remove(item.id))
          }}
        >
          Remove item
        </button>
      </form>
    </article>
  )
}
function Lines({
  quote,
  guestPending = false,
}: {
  quote: CartQuote
  guestPending?: boolean
}) {
  return (
    <div className="space-y-3">
      {quote.items.map((item) => (
        <Line
          key={item.id + ':' + item.quantity + ':' + item.status}
          item={item}
          guestPending={guestPending}
        />
      ))}
    </div>
  )
}
export function CartContents() {
  const shopping = useCommerce(),
    quote = shopping.cart
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {shopping.authenticated
            ? 'Your account cart'
            : 'Guest cart on this browser'}
        </p>
        <button
          className="text-sm font-bold text-primary disabled:opacity-50"
          disabled={shopping.busy}
          onClick={shopping.reload}
        >
          Refresh cart
        </button>
      </div>
      <ErrorMessage text={shopping.cartError} />
      {shopping.notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 text-sm text-primary"
        >
          {shopping.notice}
        </p>
      )}
      {shopping.pending && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm">
            A cart change is unconfirmed. The same absolute quantity/removal is
            retained for explicit retry.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className={actionClass}
              disabled={shopping.busy || shopping.loading}
              onClick={() => {
                void shopping.retry()
              }}
            >
              Retry same cart change
            </button>
            <button
              className="text-sm font-bold text-primary"
              disabled={shopping.busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Refresh and reconcile the current cart first. Discard this local pending request?',
                  )
                )
                  shopping.discardPending()
              }}
            >
              Discard local request
            </button>
          </div>
        </div>
      )}
      {shopping.loading ? (
        <p role="status" className="py-5 text-sm">
          Loading your current cart…
        </p>
      ) : shopping.cartError && !quote ? (
        <p className="text-sm text-muted">
          Your cart could not be loaded. No sample items are substituted.
        </p>
      ) : !quote?.items.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="font-bold">Your cart is empty</h2>
          <Link
            className="mt-4 inline-block text-sm font-bold text-primary"
            href="/shop"
            onClick={() => shopping.setCartOpen(false)}
          >
            Explore products
          </Link>
        </div>
      ) : (
        <>
          <Lines quote={quote} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex justify-between font-bold">
              <span>Available-items subtotal</span>
              <span>
                {quote.currency
                  ? money(quote.subtotalMinor, quote.currency)
                  : 'Unavailable'}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted">
              Server quote: {quote.quotedAt}. This is not a payable amount.
              Tax/shipping and reservations are calculated during checkout.
            </p>
            {quote.issues.length > 0 && (
              <p role="status" className="mt-3 text-sm text-amber-800">
                Some items cannot currently be purchased. Review the line
                statuses.
              </p>
            )}
            <button
              className="mt-4 text-sm font-bold text-red-700 disabled:opacity-50"
              disabled={shopping.busy || Boolean(shopping.pending)}
              onClick={() => {
                if (window.confirm('Clear all items in this cart?'))
                  void shopping.clear()
              }}
            >
              Clear cart
            </button>
          </div>
        </>
      )}
      {shopping.authenticated &&
        shopping.guest &&
        shopping.guest.items.length > 0 && (
          <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h2 className="font-bold">Guest items waiting to merge</h2>
            <p className="text-sm">
              Merge these browser items into the signed-in account, or
              edit/remove conflicting items first. Nothing is silently
              discarded.
            </p>
            <Lines quote={shopping.guest} guestPending />
            <div className="flex flex-wrap gap-3">
              <button
                className={actionClass}
                disabled={
                  shopping.busy || shopping.loading || Boolean(shopping.pending)
                }
                onClick={() => {
                  void shopping.mergeGuest()
                }}
              >
                Merge guest cart
              </button>
              <button
                className="text-sm font-bold text-red-700"
                disabled={shopping.busy || Boolean(shopping.pending)}
                onClick={() => {
                  if (
                    window.confirm(
                      'Discard only the guest cart on this browser? Your account cart stays unchanged.',
                    )
                  )
                    void shopping.revokeGuest()
                }}
              >
                Discard guest cart
              </button>
            </div>
          </section>
        )}
      {shopping.authenticated ? (
        <div>
          <Link
            href="/checkout"
            className={actionClass + ' w-full'}
            onClick={() => shopping.setCartOpen(false)}
          >
            Continue to checkout
          </Link>
          <p className="mt-2 text-xs text-muted">
            Resolve guest items and unconfirmed changes before reserving stock.
          </p>
        </div>
      ) : (
        <Link
          className={actionClass + ' w-full'}
          href="/sign-in?next=%2Fcart"
          onClick={() => shopping.setCartOpen(false)}
        >
          Sign in to continue
        </Link>
      )}
    </div>
  )
}
export function LiveCartPage() {
  return (
    <section className="container-shell max-w-4xl py-10">
      <h1 className="mb-7 text-3xl font-black">Your cart</h1>
      <CartContents />
    </section>
  )
}
export function LiveCartDrawer() {
  const shopping = useCommerce()
  return (
    <Sheet open={shopping.cartOpen} onOpenChange={shopping.setCartOpen}>
      <SheetContent>
        <div className="border-b border-slate-200 px-6 py-6">
          <SheetTitle className="text-xl font-black">Your cart</SheetTitle>
          <SheetDescription className="mt-2 text-xs text-muted">
            Current server prices and stock; no reservation or payment yet.
          </SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <CartContents />
        </div>
        <Link
          href="/cart"
          className="border-t border-slate-200 p-5 text-center text-sm font-bold text-primary"
          onClick={() => shopping.setCartOpen(false)}
        >
          Open full cart
        </Link>
      </SheetContent>
    </Sheet>
  )
}
export function LiveWishlist() {
  const shopping = useCommerce()
  return (
    <section className="container-shell max-w-4xl py-10">
      <h1 className="text-3xl font-black">Saved items</h1>
      <p className="mt-3 text-sm text-muted">
        Saved on your account. Unpublished products stay hidden until
        legitimately republished.
      </p>
      <ErrorMessage text={shopping.wishError} />
      <button
        className="my-5 text-sm font-bold text-primary"
        disabled={shopping.busy}
        onClick={shopping.reload}
      >
        Refresh saved items
      </button>
      {shopping.loading || (!shopping.wishlist && !shopping.wishError) ? (
        <p role="status">Loading saved items…</p>
      ) : (
        shopping.wishlist && (
          <div className="grid gap-4 sm:grid-cols-2">
            {shopping.wishlist.items.map((item) => (
              <article
                key={item.productId}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <Link
                  href={'/product/' + item.slug}
                  className="text-lg font-extrabold text-primary"
                >
                  {item.title}
                </Link>
                <p className="mt-4 font-bold">
                  {money(item.priceMinor, item.currency)}
                </p>
                <p className="mt-2 text-xs text-muted">Saved {item.addedAt}</p>
                <button
                  className="mt-5 text-sm font-bold text-red-700 disabled:opacity-50"
                  disabled={shopping.busy}
                  onClick={() => {
                    void shopping.save(item.productId, false)
                  }}
                >
                  Remove saved item
                </button>
              </article>
            ))}
            {!shopping.wishlist.items.length && (
              <p className="py-8 text-sm text-muted">
                No saved products yet. Save products from their detail pages.
              </p>
            )}
          </div>
        )
      )}
    </section>
  )
}
