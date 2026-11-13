/* eslint-disable @next/next/no-img-element -- Public media URLs are validated by imageUrl(). */
'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Box,
  ChevronRight,
  Globe2,
  HeartHandshake,
  Sparkles,
  Tag,
} from 'lucide-react'
import { readPublic } from '@/lib/api/public-data'
import { imageUrl } from '@/lib/api/catalog'
import { useCatalog } from '@/components/catalog/catalog-provider'
import { finishCopy } from '@/lib/finish-copy'
import { ProductCard } from './product-card'
import { CategoryTile } from './category-tile'
import type { Collection, Home } from '@/components/store/store-content'

function safeStorePath(value: string) {
  return (
    /^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(value) &&
    !/(?:\.\.|%2f|%5c|%25|\\)/i.test(value)
  )
}

function HeroBanner({ banner }: { banner: Home['banners'][number] }) {
  const src = imageUrl(banner.image?.url)
  const href = safeStorePath(banner.ctaHref) ? banner.ctaHref : null

  return (
    <article
      className={`relative isolate min-h-[470px] overflow-hidden rounded-[28px] border border-border sm:min-h-[480px] bg-gradient-to-br from-[#123fae] via-[#2459e8] to-[#6b8cfc] text-white`}
    >
      {src ? (
        <>
          <div className="absolute inset-0 hidden md:block">
            <img
              src={src}
              srcSet={banner.image?.srcSet}
              sizes={banner.image?.sizes || '75vw'}
              alt={banner.image?.alt || banner.headline}
              width={banner.image?.width}
              height={banner.image?.height}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#123fae] via-[#2459e8]/90 via-[38%] to-[#2459e8]/10" />
          </div>
          <div className="absolute inset-0 md:hidden">
            <img
              src={src}
              srcSet={banner.image?.srcSet}
              sizes="100vw"
              alt=""
              width={banner.image?.width}
              height={banner.image?.height}
              decoding="async"
              className="h-full w-full object-cover object-[68%_center] opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#123fae] via-[#2459e8]/70 to-transparent" />
          </div>
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -left-32 -top-32 hidden size-[440px] rounded-full border-[70px] border-white/5 md:block" />
          <img
            src="/illustrations/hero.svg"
            alt="Curated headphones and everyday products"
            width={750}
            height={550}
            className="pointer-events-none absolute -bottom-4 -right-12 hidden h-[390px] w-[48%] object-contain md:block"
          />
          <img
            src="/illustrations/hero.svg"
            alt=""
            width={750}
            height={550}
            className="pointer-events-none absolute bottom-0 right-0 h-[245px] w-[78%] object-contain object-bottom opacity-90 md:hidden"
          />
        </>
      )}

      <div
        className={`relative z-10 flex min-h-[470px] flex-col justify-start px-6 pb-11 pt-9 sm:px-9 sm:min-h-[480px] md:w-[57%] md:justify-center md:px-10 md:py-12 md:pb-12 xl:px-12 text-white`}
      >
        <span
          className={`mb-5 inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[.16em] border-white/25 bg-white/10 text-white`}
        >
          <Sparkles size={14} className="text-[#ffde8a]" />
          Discover
        </span>
        <h1 className="max-w-[560px] text-[36px] font-black leading-[1.08] tracking-[-.055em] sm:text-[44px] md:text-[42px] xl:text-[52px]">
          {banner.headline}
        </h1>
        {banner.subtitle && (
          <p
            className={`mt-4 max-w-[390px] text-sm leading-7 sm:text-[15px] text-[#e6edff]`}
          >
            {banner.subtitle}
          </p>
        )}
        {href && (
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href={href}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold shadow-sm transition hover:-translate-y-0.5 bg-white text-[#2459e8] hover:bg-[#edf2ff]`}
            >
              {banner.ctaText}
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href="/categories"
              className={`inline-flex items-center gap-2 text-sm font-extrabold hover:underline text-white`}
            >
              Explore categories <ArrowRight size={16} />
            </Link>
          </div>
        )}
        <p
          className={`mt-8 flex items-center gap-2 text-[11px] font-semibold text-white/75`}
        >
          <Globe2 size={14} /> Explore a world of everyday finds
        </p>
      </div>
    </article>
  )
}

function PromoBannerCard({
  banner,
  index,
}: {
  banner: Home['banners'][number]
  index: number
}) {
  const src = imageUrl(banner.image?.url)
  const href = safeStorePath(banner.ctaHref) ? banner.ctaHref : null
  const tone =
    index % 2 === 0
      ? {
          surface: '#f0eafc',
          eyebrow: '#7862b5',
          title: '#42346e',
          action: '#69519e',
        }
      : {
          surface: '#FAECDF',
          eyebrow: '#a8754f',
          title: '#75462d',
          action: '#976039',
        }

  return (
    <article
      className="group relative min-h-[215px] overflow-hidden rounded-[26px] border border-black/[.035] lg:min-h-0"
      style={{ backgroundColor: tone.surface }}
    >
      <div className="relative z-10 flex h-full max-w-[64%] flex-col items-start justify-center p-7">
        <p
          className="text-[9px] font-extrabold uppercase tracking-[.16em]"
          style={{ color: tone.eyebrow }}
        >
          Featured edit
        </p>
        <h2
          className="mt-2 line-clamp-3 text-[23px] font-black leading-[1.15] tracking-[-.04em] sm:text-[25px]"
          style={{ color: tone.title }}
        >
          {banner.headline}
        </h2>
        {banner.subtitle && (
          <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#64708a]">
            {banner.subtitle}
          </p>
        )}
        {href && (
          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold hover:underline"
            style={{ color: tone.action }}
          >
            {banner.ctaText} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="absolute inset-y-0 right-0 w-[36%] overflow-hidden">
        {src ? (
          <img
            src={src}
            srcSet={banner.image?.srcSet}
            sizes={banner.image?.sizes || '(max-width: 1024px) 40vw, 18vw'}
            alt={banner.image?.alt || banner.headline}
            width={banner.image?.width}
            height={banner.image?.height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.04]"
            style={{
              objectPosition: index === 0 ? '82% center' : '58% center',
            }}
          />
        ) : (
          <img
            src={index === 0 ? '/products/loafers.svg' : '/products/tshirt.svg'}
            alt=""
            width={640}
            height={640}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
    </article>
  )
}

function TrustStrip() {
  const f = finishCopy('en')
  const items = [
    { icon: Box, title: f.highlight1, text: f.highlight1Desc },
    {
      icon: HeartHandshake,
      title: 'One place to explore',
      text: 'Thoughtfully grouped collections',
    },
    { icon: BadgeCheck, title: f.highlight3, text: f.highlight3Desc },
  ]

  return (
    <section className="container-shell pt-9 sm:pt-11">
      <div className="grid gap-4 rounded-[22px] border border-border bg-[#fbfcff] p-5 sm:grid-cols-3 sm:gap-5 sm:px-7 sm:py-6">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#ecf2ff] text-primary">
              <Icon size={20} />
            </span>
            <span>
              <strong className="block text-xs font-extrabold sm:text-sm">
                {title}
              </strong>
              <span className="mt-1 block text-xs text-muted">{text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function CategorySection() {
  const { categories, loading, error, reload } = useCatalog()
  const roots = categories
    .filter((category) => category.active && category.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const f = finishCopy('en')

  return (
    <section className="container-shell pb-4 pt-14 sm:pt-[68px]">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">
            {f.categoryEyebrow}
          </p>
          <h2 className="section-heading">Shop by category</h2>
          <p className="mt-2 text-sm text-muted">
            A little something for every part of life.
          </p>
        </div>
        <Link
          href="/categories"
          className="hidden items-center gap-2 text-sm font-extrabold text-primary hover:underline sm:inline-flex"
        >
          {f.categoryLink} <ArrowRight size={16} />
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Categories are temporarily unavailable.</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 font-extrabold text-primary underline"
          >
            Retry loading categories
          </button>
        </div>
      ) : loading ? (
        <div
          role="status"
          aria-label="Loading categories"
          className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-8 sm:gap-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-[142px] animate-pulse flex-col items-center gap-3 rounded-[20px] border border-border bg-white p-4"
            >
              <span className="size-[62px] rounded-[18px] bg-slate-100 sm:size-[76px]" />
              <span className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : roots.length ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-8 sm:gap-4">
          {roots.map((category) => (
            <CategoryTile category={category} key={category.id} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-white p-5 text-sm text-muted">
          No active top-level categories are available yet.
        </p>
      )}

      <div className="mt-5 text-center sm:hidden">
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary"
          href="/categories"
        >
          Browse all categories <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}

function CollectionTabs({
  collections,
  collectionsTruncated,
}: {
  collections: Collection[]
  collectionsTruncated: boolean
}) {
  const [activeSlug, setActiveSlug] = useState(collections[0]?.slug || '')
  const [expanded, setExpanded] = useState<Record<string, Collection>>({})
  const [loadingSlug, setLoadingSlug] = useState('')
  const [detailError, setDetailError] = useState('')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeCollection = collections.find((item) => item.slug === activeSlug)
  const visibleCollection =
    (activeCollection && expanded[activeCollection.slug]) || activeCollection

  useEffect(() => {
    if (!collections.some((item) => item.slug === activeSlug))
      setActiveSlug(collections[0]?.slug || '')
  }, [activeSlug, collections])

  useEffect(() => {
    setDetailError('')
  }, [activeSlug])

  useEffect(() => {
    if (
      !activeCollection ||
      !activeCollection.productsTruncated ||
      expanded[activeCollection.slug]
    )
      return

    const controller = new AbortController()
    let current = true
    setLoadingSlug(activeCollection.slug)
    setDetailError('')

    void readPublic<Collection>(
      '/v1/store/collections/' + encodeURIComponent(activeCollection.slug),
    )
      .then((detail) => {
        if (!current) return
        if (
          detail.id !== activeCollection.id ||
          detail.slug !== activeCollection.slug ||
          !Array.isArray(detail.products)
        )
          throw new Error(
            'The collection detail response did not match the selected collection.',
          )
        setExpanded((previous) => ({
          ...previous,
          [activeCollection.slug]: detail,
        }))
      })
      .catch(() => {
        if (current && !controller.signal.aborted)
          setDetailError(
            'The full collection could not be loaded. Showing the featured selection instead.',
          )
      })
      .finally(() => {
        if (current) setLoadingSlug('')
      })

    return () => {
      current = false
      controller.abort()
    }
  }, [activeCollection, expanded])

  function onTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % collections.length
    if (event.key === 'ArrowLeft')
      next = (index - 1 + collections.length) % collections.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = collections.length - 1
    if (next === null) return
    event.preventDefault()
    setActiveSlug(collections[next].slug)
    tabRefs.current[next]?.focus()
  }

  if (!collections.length) return null

  const f = finishCopy('en')
  const products = (visibleCollection?.products || []).slice(0, 8)
  const moreInCollection = Boolean(
    visibleCollection?.productsTruncated ||
      (visibleCollection?.products.length || 0) > 8,
  )

  return (
    <section className="container-shell pb-16 pt-12 sm:pb-20 sm:pt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">
            {f.collectionEyebrow}
          </p>
          <h2 className="section-heading">{f.collectionTitle}</h2>
          <p className="mt-2 text-sm text-muted">
            Everyday favorites and fresh arrivals from our featured collections.
          </p>
        </div>
        <Link
          href="/shop"
          className="hidden items-center gap-2 text-sm font-extrabold text-primary hover:underline sm:inline-flex"
        >
          View all products <ArrowRight size={16} />
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Featured product collections"
        className="mb-6 flex max-w-full gap-2 overflow-x-auto pb-2"
      >
        {collections.map((collection, index) => (
          <button
            key={collection.id}
            type="button"
            role="tab"
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            tabIndex={activeSlug === collection.slug ? 0 : -1}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            id={`collection-tab-${collection.slug}`}
            aria-selected={activeSlug === collection.slug}
            aria-controls="collection-panel"
            onClick={() => setActiveSlug(collection.slug)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-extrabold transition sm:text-sm ${activeSlug === collection.slug ? 'bg-[#16233e] text-white shadow-sm' : 'border border-border bg-white text-[#61708b] hover:border-primary hover:text-primary'}`}
          >
            {collection.title}
          </button>
        ))}
      </div>

      <div
        id="collection-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`collection-tab-${activeSlug}`}
        className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4"
      >
        {products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>

      {loadingSlug === activeSlug && (
        <p role="status" className="mt-4 text-center text-xs text-muted">
          Loading the complete collection…
        </p>
      )}
      {detailError && (
        <p role="status" className="mt-4 text-center text-xs text-muted">
          {detailError}
        </p>
      )}
      {moreInCollection && (
        <p className="mt-4 text-center text-xs text-muted">
          More products are available in this collection.
        </p>
      )}
      {collectionsTruncated && (
        <p className="mt-3 text-center text-xs text-muted">
          Additional featured collections are available in the shop.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        {visibleCollection && (
          <Link
            href={'/collections/' + encodeURIComponent(visibleCollection.slug)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-extrabold text-ink transition hover:border-primary hover:text-primary"
          >
            View {visibleCollection.title} <ArrowRight size={17} />
          </Link>
        )}
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-white transition hover:bg-primary-hover"
        >
          Explore all products <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  )
}

function BottomPromotion() {
  const f = finishCopy('en')

  return (
    <section className="container-shell pb-16 sm:pb-20">
      <div className="grid overflow-hidden rounded-[27px] bg-[#152039] text-white lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden px-8 py-12 sm:px-14 sm:py-16">
          <div className="pointer-events-none absolute -bottom-40 -left-20 size-80 rounded-full border-[58px] border-white/5" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-extrabold text-[#ffdf9b]">
              <Tag size={14} /> {f.promoEyebrow}
            </div>
            <h2 className="mt-5 max-w-lg text-3xl font-black tracking-[-.04em] sm:text-4xl">
              {f.promoTitle}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-[#bac6dc]">
              {f.promoDesc}
            </p>
            <Link
              href="/shop"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white bg-white px-5 py-3 text-sm font-extrabold text-[#152039] transition hover:bg-[#e8efff]"
            >
              {f.promoLink} <ChevronRight size={17} />
            </Link>
          </div>
        </div>
        <div className="relative hidden min-h-[290px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#384e83] to-[#677fb9] lg:flex">
          <div className="absolute -right-20 -top-24 size-[340px] rounded-full border-[58px] border-white/10" />
          <img
            src="/products/bottle.svg"
            alt="Insulated reusable bottle illustration"
            width={270}
            height={270}
            loading="lazy"
            className="relative size-[260px] object-contain drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  )
}

export function Homepage({
  data,
  supportNotice,
  onRefresh,
}: {
  data: Home
  supportNotice?: string
  onRefresh: () => void
}) {
  const banners = [...data.banners].sort((a, b) => a.position - b.position)
  const hero = banners.find((banner) => banner.slot === 'hero') || banners[0]
  const promotions = banners
    .filter((banner) => banner.id !== hero?.id)
    .sort((a, b) => a.position - b.position)
  const sidePromotions = promotions.slice(0, 2)
  const additionalPromotions = promotions.slice(2)

  return (
    <>
      {supportNotice && (
        <div className="container-shell pt-5">
          <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[#31518c]">
            {supportNotice}
          </p>
        </div>
      )}

      {hero ? (
        <section className="container-shell pt-5 sm:pt-7">
          <div
            className={`grid gap-4 ${sidePromotions.length ? 'lg:grid-cols-[1.78fr_1fr]' : ''}`}
          >
            <HeroBanner banner={hero} />
            {sidePromotions.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {sidePromotions.map((banner, index) => (
                  <PromoBannerCard
                    banner={banner}
                    index={index}
                    key={banner.id}
                  />
                ))}
              </div>
            )}
          </div>
          {additionalPromotions.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {additionalPromotions.map((banner, index) => (
                <PromoBannerCard
                  banner={banner}
                  index={index + 2}
                  key={banner.id}
                />
              ))}
            </div>
          )}
          {data.bannersTruncated && (
            <p className="mt-3 text-right text-xs text-muted">
              Additional featured banners are not shown in this selection.
            </p>
          )}
        </section>
      ) : (
        <section className="container-shell pt-7">
          <div className="rounded-[24px] border border-border bg-white p-7 sm:p-10">
            <h1 className="text-3xl font-black tracking-tight text-ink">
              Discover something new
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              Explore the latest products and browse the store by category.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white hover:bg-primary-hover"
            >
              Browse products <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      <TrustStrip />
      <CategorySection />
      <CollectionTabs
        collections={[...data.collections].sort(
          (a, b) => a.position - b.position,
        )}
        collectionsTruncated={data.collectionsTruncated}
      />
      <BottomPromotion />

      <div className="container-shell -mt-8 flex justify-end pb-8">
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-bold text-muted underline decoration-border underline-offset-4 transition hover:text-primary"
        >
          Refresh featured content
        </button>
      </div>
    </>
  )
}
