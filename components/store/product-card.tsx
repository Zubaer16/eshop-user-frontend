/* eslint-disable @next/next/no-img-element -- Validated public media URLs. */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Box, Heart, Plus } from 'lucide-react'
import { imageUrl, money, type Product } from '@/lib/api/catalog'
import { additionPreview } from '@/lib/api/cart-preview'
import { validateSelection } from '@/lib/api/shopping'
import { useCommerce } from '@/components/shopping/commerce-provider'
import { useCatalog } from '@/components/catalog/catalog-provider'
import type { StoreProductCard } from './store-content'

export function ProductCard({
  product,
  priority = false,
}: {
  product: Product | StoreProductCard
  priority?: boolean
}) {
  const shopping = useCommerce()
  const { categories } = useCatalog()
  const [error, setError] = useState('')
  const [failedImage, setFailedImage] = useState('')
  const image = 'gallery' in product ? product.gallery[0] : product.image
  const src = imageUrl(image?.url)
  const category =
    'categoryIds' in product
      ? categories.find((item) => product.categoryIds.includes(item.id))
      : null
  const available =
    'purchasable' in product
      ? product.purchasable
      : product.availableQuantity > 0
  const saved =
    shopping.wishlist?.items.some((item) => item.productId === product.id) ||
    false
  const href = '/product/' + encodeURIComponent(product.slug)

  async function add() {
    setError('')
    try {
      await shopping.add(
        validateSelection({
          productId: product.id,
          variantId: null,
          quantity: 1,
        }),
        additionPreview(product),
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not add this product.',
      )
    }
  }

  return (
    <article className="group relative overflow-hidden rounded-[18px] border border-border bg-white card-lift">
      <Link
        href={href}
        className="relative block aspect-[1.03] overflow-hidden bg-[#f5f7fb]"
        aria-label={'View product: ' + product.title}
      >
        {src && failedImage !== src ? (
          <img
            src={src}
            srcSet={image?.srcSet}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            alt={image?.alt || product.title}
            width={image?.width}
            height={image?.height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedImage(src)}
            className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-muted">
            <Box size={42} strokeWidth={1.2} />
            <span className="sr-only">No product image</span>
          </span>
        )}
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-[#26395e] shadow-sm">
            {product.badge}
          </span>
        )}
      </Link>
      {shopping.authenticated ? (
        <button
          type="button"
          aria-label={
            (saved ? 'Remove saved item: ' : 'Save item: ') + product.title
          }
          aria-pressed={saved}
          disabled={
            shopping.loading || shopping.busy || Boolean(shopping.wishError)
          }
          onClick={() => {
            void shopping.save(product.id, !saved)
          }}
          className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/95 text-muted shadow-sm transition hover:text-primary disabled:opacity-40"
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      ) : (
        <Link
          href={'/sign-in?next=' + encodeURIComponent(href)}
          aria-label={'Sign in to save: ' + product.title}
          className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/95 text-muted shadow-sm hover:text-primary"
        >
          <Heart size={18} />
        </Link>
      )}
      <div className="px-3.5 pb-4 pt-3 sm:px-4 sm:pb-5">
        <p className="mb-1.5 min-h-4 text-[10px] font-bold uppercase tracking-[.12em] text-muted">
          {category?.name || product.tag || 'Discover'}
        </p>
        <Link
          href={href}
          className="line-clamp-2 min-h-[42px] text-[13px] font-bold leading-[1.6] text-ink hover:text-primary sm:text-sm"
        >
          {product.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <strong className="text-sm font-extrabold sm:text-base">
            {money(product.priceMinor, product.currency)}
          </strong>
          {product.compareAtMinor !== null &&
            product.compareAtMinor > product.priceMinor && (
              <del className="text-xs text-muted">
                {money(product.compareAtMinor, product.currency)}
              </del>
            )}
        </div>
        {product.hasVariants ? (
          <Link
            href={href}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#dce5fa] bg-[#f2f6ff] text-xs font-bold text-primary transition hover:border-primary hover:bg-primary hover:text-white"
          >
            Choose options <ArrowRight size={16} />
          </Link>
        ) : (
          <button
            type="button"
            disabled={
              !available ||
              shopping.loading ||
              !shopping.canAdd ||
              Boolean(shopping.cartError)
            }
            onClick={() => void add()}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#dce5fa] bg-[#f2f6ff] text-xs font-bold text-primary transition hover:border-primary hover:bg-primary hover:text-white disabled:opacity-40"
          >
            <Plus size={17} />
            {available ? 'Add to cart' : 'Unavailable'}
          </button>
        )}
        {(error || shopping.wishError || shopping.cartError) && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {error || shopping.wishError || shopping.cartError}
          </p>
        )}
      </div>
    </article>
  )
}
