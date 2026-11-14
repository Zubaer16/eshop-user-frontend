/* eslint-disable @next/next/no-img-element -- Validated public product media. */
'use client'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Box,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
} from 'lucide-react'
import { usePublicProduct } from '@/hooks/use-public-product'
import { additionPreview } from '@/lib/api/cart-preview'
import { ProductCard } from '@/components/store/product-card'
import { money, imageUrl } from '@/lib/api/catalog'
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
  const shopping = useCommerce(
    useShallow((state) => ({
      authenticated: state.authenticated,
      loading: state.wishLoading,
      busy: state.busy,
      wishError: state.wishError,
      save: state.save,
      saved:
        state.wishlist?.items.some((item) => item.productId === product.id) ||
        false,
    })),
  )
  const saved = shopping.saved
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
  const shopping = useCommerce(
    useShallow((state) => ({
      add: state.add,
      canAdd: state.canAdd,
      busy: state.busy,
      cartError: state.cartError,
      wishError: state.wishError,
      reload: state.reload,
      setCartOpen: state.setCartOpen,
    })),
  )
  const [quantity, setQuantity] = useState(1),
    [error, setError] = useState('')
  const variant = product.variants.find((item) => item.id === variantId),
    available = product.hasVariants
      ? Boolean(variant?.available)
      : product.purchasable
  async function add() {
    setError('')
    try {
      await shopping.add(
        productSelection(product, variantId, quantity),
        additionPreview(product, variantId),
      )
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not add this product.',
      )
    }
  }
  return (
    <div className={compact ? 'mt-3 space-y-2' : 'mt-5 space-y-4'}>
      {!compact && (
        <div className="block text-sm font-bold">
          <span>Quantity</span>
          <div className="mt-2 flex h-12 w-fit items-center rounded-xl border border-border">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="h-full px-4 disabled:opacity-35"
            >
              <Minus size={17} />
            </button>
            <input
              aria-label="Quantity"
              type="number"
              required
              min={1}
              max={99}
              step={1}
              className="h-full w-16 border-0 bg-transparent text-center text-sm font-bold outline-none"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= 99}
              onClick={() => setQuantity((value) => Math.min(99, value + 1))}
              className="h-full px-4 disabled:opacity-35"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>
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
            !shopping.canAdd ||
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
      {!compact && (
        <p className="text-xs text-muted">
          Prices and stock are confirmed at checkout. Adding items does not
          reserve stock or create an order.
        </p>
      )}
    </div>
  )
}
function Line({ item }: { item: CartLine }) {
  const shopping = useCommerce(),
    [quantity, setQuantity] = useState(String(item.quantity))
  const quantityInputId = useId()
  const src = imageUrl(item.image?.url)
  useEffect(() => {
    setQuantity(String(item.quantity))
  }, [item.quantity])
  const quantityLocked = shopping.loading || shopping.busy
  const enteredQuantity = Number(quantity)
  const stepQuantity =
    Number.isInteger(enteredQuantity) &&
    enteredQuantity >= 1 &&
    enteredQuantity <= 99
      ? enteredQuantity
      : item.quantity
  function changeQuantity(value: string) {
    setQuantity(value)
    const quantity = Number(value)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return
    const selection = {
      productId: item.productId,
      variantId: item.variantId,
      quantity,
    }
    void shopping.setQuantity(selection)
  }
  return (
    <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div className="flex gap-4 sm:gap-5">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f5f7fb] sm:size-28">
          {src ? (
            <img
              src={src}
              alt={item.title}
              width={112}
              height={112}
              loading="lazy"
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <Box size={28} className="text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">{item.title}</h3>
              {item.sku && (
                <p className="mt-1 text-xs text-muted">SKU: {item.sku}</p>
              )}
              <p className="mt-1 text-xs text-muted">
                {item.variantId
                  ? 'Selected variant retained'
                  : 'Simple product'}
              </p>
            </div>
            <p className="whitespace-nowrap text-sm font-bold">
              {money(item.lineTotalMinor, item.currency)}
            </p>
          </div>
          <p className="text-xs text-muted">
            {money(item.unitPriceMinor, item.currency)} per unit
            {item.availableQuantity !== null && (
              <> · {item.availableQuantity} currently available</>
            )}
          </p>
          {item.status !== 'AVAILABLE' && (
            <p className="text-sm font-semibold text-amber-800">
              {item.status.replaceAll('_', ' ')} — update or remove this item
              before checkout.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label
                htmlFor={quantityInputId}
                className="block text-xs font-bold"
              >
                Quantity for {item.sku || item.title}
              </label>
              <div className="mt-2 inline-flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <button
                  type="button"
                  aria-label={
                    'Decrease quantity for ' + (item.sku || item.title)
                  }
                  className="flex size-11 shrink-0 items-center justify-center text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-40"
                  disabled={quantityLocked || stepQuantity <= 1}
                  onClick={() => changeQuantity(String(stepQuantity - 1))}
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <input
                  id={quantityInputId}
                  className="h-full w-12 min-w-0 border-x border-slate-200 bg-transparent text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={99}
                  step={1}
                  value={quantity}
                  disabled={quantityLocked}
                  onChange={(e) => changeQuantity(e.target.value)}
                  onBlur={() => {
                    if (
                      !Number.isInteger(Number(quantity)) ||
                      Number(quantity) < 1 ||
                      Number(quantity) > 99
                    )
                      setQuantity(String(item.quantity))
                  }}
                />
                <button
                  type="button"
                  aria-label={
                    'Increase quantity for ' + (item.sku || item.title)
                  }
                  className="flex size-11 shrink-0 items-center justify-center text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-40"
                  disabled={quantityLocked || stepQuantity >= 99}
                  onClick={() => changeQuantity(String(stepQuantity + 1))}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <button
              type="button"
              className="min-h-11 px-2 text-sm font-bold text-red-700 disabled:opacity-50"
              disabled={shopping.busy}
              onClick={() => {
                void shopping.remove(item.id)
              }}
            >
              Remove item
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
function Lines({ quote }: { quote: CartQuote }) {
  return (
    <div className="space-y-3">
      {quote.items.map((item) => (
        <Line key={item.id} item={item} />
      ))}
    </div>
  )
}
export function CartContents({ fullPage = false }: { fullPage?: boolean }) {
  const shopping = useCommerce()
  const quote = shopping.cart
  return (
    <div className="space-y-5">
      <ErrorMessage text={shopping.cartError} />
      {shopping.guestMergeError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p>{shopping.guestMergeError}</p>
          <button
            type="button"
            className="mt-2 min-h-11 font-bold text-primary"
            disabled={shopping.busy || shopping.loading}
            onClick={shopping.retryGuestMerge}
          >
            Retry adding previous items
          </button>
        </div>
      )}
      {shopping.notice && (
        <p role="status" className="text-sm text-amber-800">
          {shopping.notice}
        </p>
      )}
      {shopping.loading ? (
        <p role="status">Loading your cart…</p>
      ) : !quote?.items.length ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#fbfcff] p-6 text-center">
          <ShoppingBag size={44} className="mb-5 text-primary" />
          <h2 className="font-bold">Your cart is empty</h2>
          <Link
            className="mt-4 text-sm font-bold text-primary"
            href="/shop"
            onClick={() => shopping.setCartOpen(false)}
          >
            Explore products
          </Link>
        </div>
      ) : (
        <div
          className={
            fullPage
              ? 'grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_350px]'
              : 'space-y-5'
          }
        >
          <Lines quote={quote} />
          <aside className="h-fit space-y-4 rounded-2xl border border-border bg-[#fbfcff] p-6">
            <h2 className="text-lg font-extrabold">Order summary</h2>
            <div className="flex justify-between font-bold">
              <span>Estimated subtotal</span>
              <span>
                {quote.currency
                  ? money(quote.subtotalMinor, quote.currency)
                  : 'Unavailable'}
              </span>
            </div>
            <p className="text-xs text-muted">
              Final prices, stock and delivery charges are confirmed at
              checkout.
            </p>
            <button
              className="text-sm font-bold text-red-700 disabled:opacity-50"
              disabled={shopping.busy}
              onClick={() => {
                if (window.confirm('Clear all items in this cart?'))
                  void shopping.clear()
              }}
            >
              Clear cart
            </button>
            {fullPage && <CartContinue />}
          </aside>
        </div>
      )}
      {!fullPage && <CartContinue />}
    </div>
  )
}
export function CartPage() {
  return (
    <section className="container-shell pb-20 pt-9">
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/">Home</Link>
        <ChevronRight size={14} />
        <span className="font-bold text-ink">Cart</span>
      </nav>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Your cart
      </h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Review your everyday finds before checkout.
      </p>
      <CartContents fullPage />
    </section>
  )
}
export function CartDrawer() {
  const shopping = useCommerce()
  return (
    <Sheet open={shopping.cartOpen} onOpenChange={shopping.setCartOpen}>
      <SheetContent>
        <div className="border-b border-slate-200 px-6 py-6">
          <SheetTitle className="text-xl font-black">Your cart</SheetTitle>
          <SheetDescription className="mt-2 text-xs text-muted">
            Review your items before checkout.
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
export function WishlistPage() {
  const shopping = useCommerce()
  return (
    <section className="container-shell pb-20 pt-9">
      <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-primary">
        <Heart size={16} />
        Your favorites
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Saved items
      </h1>
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
      {shopping.wishLoading || (!shopping.wishlist && !shopping.wishError) ? (
        <p role="status">Loading saved items…</p>
      ) : (
        shopping.wishlist && (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {shopping.wishlist.items.map((item) => (
              <SavedProduct key={item.productId} item={item} />
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

function SavedProduct({
  item,
}: {
  item: {
    productId: string
    slug: string
    title: string
    currency: string
    priceMinor: number
  }
}) {
  const shopping = useCommerce()
  const visual = usePublicProduct(item.productId, item.title, item.slug)
  return (
    <div ref={visual.ref}>
      {visual.product ? (
        <ProductCard product={visual.product} />
      ) : (
        <article className="overflow-hidden rounded-[18px] border border-border bg-white">
          <Link
            href={'/product/' + item.slug}
            className="flex aspect-[1.03] items-center justify-center bg-[#f5f7fb]"
          >
            <Box size={40} className="text-muted" />
          </Link>
          <div className="p-4">
            <Link
              href={'/product/' + item.slug}
              className="line-clamp-2 text-sm font-bold"
            >
              {item.title}
            </Link>
            <p className="mt-3 font-extrabold">
              {money(item.priceMinor, item.currency)}
            </p>
            <button
              type="button"
              disabled={shopping.busy}
              onClick={() => {
                void shopping.save(item.productId, false)
              }}
              className="mt-4 text-xs font-bold text-red-700"
            >
              Remove saved item
            </button>
          </div>
        </article>
      )}
    </div>
  )
}

function CartContinue() {
  const shopping = useCommerce()
  if (
    !shopping.cart?.items.length ||
    shopping.busy ||
    shopping.loading ||
    shopping.guestMergeError
  )
    return null
  return (
    <Link
      className={actionClass + ' w-full'}
      href={shopping.authenticated ? '/checkout' : '/sign-in?next=%2Fcart'}
      onClick={() => shopping.setCartOpen(false)}
    >
      {shopping.authenticated ? 'Continue to checkout' : 'Sign in to continue'}
    </Link>
  )
}
