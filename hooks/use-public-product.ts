'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api/client'
import { readPage, readProduct, type Product } from '@/lib/api/catalog'

/** Optional display metadata only. Cart quotes remain the price/stock authority. */
export function usePublicProduct(
  id: string,
  title: string,
  slug?: string,
  enabled = true,
) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<{ id: string; product: Product } | null>(
    null,
  )
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let started = false
    async function load() {
      if (started) return
      started = true
      try {
        const product = slug
          ? readProduct(
              await api.request('/v1/products/' + slug, {
                auth: false,
                signal: controller.signal,
              }),
            )
          : readPage(
              await api.request('/v1/products', {
                query: { search: title.slice(0, 100), limit: 12 },
                auth: false,
                signal: controller.signal,
              }),
              readProduct,
            ).items.find((item) => item.id === id)
        if (
          !controller.signal.aborted &&
          product?.id === id &&
          product.status === 'ACTIVE'
        )
          setValue({ id, product })
      } catch {
        /* Missing public media must not hide owned cart/wishlist records. */
      }
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                void load()
                observer?.disconnect()
              }
            },
            { rootMargin: '200px' },
          )
    if (observer && ref.current) observer.observe(ref.current)
    else void load()
    return () => {
      observer?.disconnect()
      controller.abort()
    }
  }, [id, title, slug, enabled])
  return { ref, product: value?.id === id && enabled ? value.product : null }
}
