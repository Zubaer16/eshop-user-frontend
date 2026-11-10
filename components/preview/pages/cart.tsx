'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronRight, ShoppingBag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CartLineView } from '@/components/store/cart-line'
import {
  formatPrice,
  productById,
  productPrice,
  productVariant,
} from '@/lib/catalog'
import { useCommerceStore } from '@/stores/commerce-store'
import { useStoreReady } from '@/hooks/use-store-ready'
import { useUiCopy } from '@/hooks/use-ui-copy'
import { assessPreviewCart } from '@/lib/checkout-preview'

export default function CartPage() {
  const ready = useStoreReady()
  const t = useUiCopy()
  const cart = useCommerceStore((s) => s.cart)
  const savedLocale = 'en' as const
  const locale = ready ? savedLocale : 'en'
  const lines = (ready ? cart : [])
    .map((line) => ({ line, product: productById(line.productId) }))
    .filter((row) => !!row.product)
  const complete = (row: (typeof lines)[number]) =>
    !row.product!.variants || !!productVariant(row.product!, row.line.variantId)
  const incompleteCount = lines.filter((row) => !complete(row)).length
  const subtotal = lines
    .filter(complete)
    .reduce(
      (sum, row) => sum + productPrice(row.product!) * row.line.quantity,
      0,
    )
  const count = lines.reduce((sum, row) => sum + row.line.quantity, 0)
  const preview = assessPreviewCart(ready ? cart : [])
  return (
    <div className="container-shell pb-20 pt-9">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/">{t.home}</Link>
        <ChevronRight size={14} />
        <span className="font-bold text-ink">{t.cart}</span>
      </nav>
      <div className="mb-8 mt-5">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.cartTitle}
        </h1>
        <p className="mt-2 text-sm text-muted">{t.cartSubtitle}</p>
      </div>
      {lines.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#fbfcff] p-6 text-center">
          <ShoppingBag size={44} className="text-primary" />
          <h2 className="mt-5 text-xl font-bold">{t.cartEmpty}</h2>
          <p className="mt-2 text-sm text-muted">{t.cartEmptyDescription}</p>
          <Button className="mt-6" asChild>
            <Link href="/shop">
              <ArrowLeft size={17} /> {t.continueShopping}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="border-b border-border bg-[#fbfcff] px-5 py-4 text-sm font-extrabold">
              {t.itemsInCart} ({count})
            </div>
            <div className="divide-y divide-border">
              {lines.map(
                ({ line, product }) =>
                  product && (
                    <CartLineView
                      key={`${line.productId}/${line.variantId ?? 'base'}`}
                      line={line}
                      product={product}
                      locale={locale}
                    />
                  ),
              )}
            </div>
          </div>
          <aside className="h-fit rounded-2xl border border-border bg-[#fbfcff] p-6">
            <h2 className="text-lg font-extrabold">{t.orderSummary}</h2>
            <div className="mt-6 flex justify-between text-sm text-muted">
              <span>{t.subtotal}</span>
              <span className="font-bold text-ink">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="mt-4 flex justify-between gap-3 text-sm text-muted">
              <span>{t.shippingTaxes}</span>
              <span className="text-right">{t.futureCheckout}</span>
            </div>
            {incompleteCount > 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                {incompleteCount} {t.incompleteCart}
              </p>
            )}
            <div className="my-6 h-px bg-border" />
            <div className="flex justify-between text-sm">
              <span className="font-bold">{t.estimatedSubtotal}</span>
              <strong className="text-xl">{formatPrice(subtotal)}</strong>
            </div>
            {preview.readyForPreview ? (
              <Button asChild className="mt-6 w-full">
                <Link href="/checkout">
                  {t.previewCheckout} <ArrowRight size={17} />
                </Link>
              </Button>
            ) : (
              <>
                <Button className="mt-6 w-full" disabled>
                  {t.resolveCart}
                </Button>
                <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-800">
                  {preview.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-4 text-xs leading-6 text-muted">
              {t.checkoutDisclaimer}
            </p>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link href="/shop">
                <ArrowLeft size={17} /> {t.continueShopping}
              </Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  )
}
