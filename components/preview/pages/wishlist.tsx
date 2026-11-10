'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Heart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/store/product-card'
import { productById, productPrice, type Product } from '@/lib/catalog'
import { useCommerceStore } from '@/stores/commerce-store'
import { useStoreReady } from '@/hooks/use-store-ready'
import { useUiCopy } from '@/hooks/use-ui-copy'

export default function WishlistPage() {
  const ready = useStoreReady()
  const t = useUiCopy()
  const wishlist = useCommerceStore((s) => s.wishlist)
  const clear = useCommerceStore((s) => s.clearWishlist)
  const [sort, setSort] = useState('saved')
  const [confirmClear, setConfirmClear] = useState(false)
  const items = (ready ? wishlist : [])
    .map((id) => productById(id))
    .filter((item): item is Product => !!item)
  if (sort === 'price-low')
    items.sort((a, b) => productPrice(a) - productPrice(b))
  if (sort === 'price-high')
    items.sort((a, b) => productPrice(b) - productPrice(a))
  return (
    <div className="container-shell pb-20 pt-9">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/">{t.home}</Link>
        <ChevronRight size={14} />
        <span className="font-bold text-ink">{t.wishlist}</span>
      </nav>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.wishTitle}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {items.length} {t.savedFinds}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="wishlist-sort" className="sr-only">
              {t.wishSort}
            </label>
            <select
              id="wishlist-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
            >
              <option value="saved">{t.savedOrder}</option>
              <option value="price-low">{t.priceLow}</option>
              <option value="price-high">{t.priceHigh}</option>
            </select>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-muted hover:border-red-200 hover:text-red-600"
            >
              <Trash2 size={15} /> {t.clearAll}
            </button>
          </div>
        )}
      </div>
      {confirmClear && items.length > 0 && (
        <div
          role="alert"
          aria-label="Confirm clearing wishlist"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-900">
            {t.removeSaved}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmClear(false)}
            >
              {t.cancel}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                clear()
                setConfirmClear(false)
              }}
            >
              {t.clearWishlist}
            </Button>
          </div>
        </div>
      )}
      {items.length ? (
        <div className="mt-9 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      ) : (
        <div className="mt-9 flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#fbfcff] p-6 text-center">
          <Heart size={46} className="text-primary" />
          <h2 className="mt-5 text-xl font-bold">{t.wishEmpty}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
            {t.wishEmptyDescription}
          </p>
          <Button asChild className="mt-6">
            <Link href="/shop">
              {t.findFavorites} <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      )}
      {items.length > 0 && (
        <p className="mt-8 text-center text-xs text-muted">{t.wishNote}</p>
      )}
    </div>
  )
}
