/* eslint-disable @next/next/no-img-element -- Verified remote and disk image URLs are served directly without fabricated image transforms. */
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '@/lib/api/client'
import {
  categoryLabel,
  imageUrl,
  money,
  readPage,
  readProduct,
  shopQuery,
  type GalleryImage,
  type Page,
  type Product,
  type ShopQuery,
} from '@/lib/api/catalog'
import { useCatalog } from './catalog-provider'
import { ProductCard } from '@/components/store/product-card'
import { CategoryTile } from '@/components/store/category-tile'
import {
  ChevronRight,
  Compass,
  SlidersHorizontal,
  X,
  CheckCircle2,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react'
import { ProductActions } from '@/components/shopping/cart'
const control =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10'
const button =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50'
function CatalogImage({
  image,
  title,
  className = '',
}: {
  image?: GalleryImage
  title: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = imageUrl(image?.url)
  return src && !failed ? (
    <img
      src={src}
      srcSet={image?.srcSet}
      sizes={image?.sizes}
      alt={image?.alt || title}
      width={image?.width}
      height={image?.height}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className + ' object-contain'}
    />
  ) : (
    <div
      className={
        className +
        ' flex items-center justify-center bg-slate-100 p-4 text-center text-sm text-muted'
      }
    >
      No product image
    </div>
  )
}
function ErrorState({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <p role="alert" className="text-sm text-red-800">
        {error}
      </p>
      <button className={button + ' mt-4'} onClick={retry}>
        Retry loading
      </button>
    </div>
  )
}
export function Categories() {
  const { categories, loading, error, reload } = useCatalog()
  return (
    <section className="container-shell pb-20 pt-9">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/">Home</Link>
        <ChevronRight size={14} />
        <span className="font-bold text-ink">Categories</span>
      </nav>
      <div className="relative mb-10 mt-6 overflow-hidden rounded-[24px] bg-[#edf2ff] px-7 py-10 sm:px-12 sm:py-14">
        <div className="absolute -right-10 -top-16 size-[230px] rounded-full border-[48px] border-[#d6e0ff]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary">
            <Compass size={15} />
            Discover your favorites
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-[-.045em] text-ink sm:text-5xl">
            Shop by category
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
            Find everyday favorites, thoughtfully grouped for you.
          </p>
        </div>
      </div>
      {error ? (
        <div className="mt-6">
          <ErrorState error={error} retry={reload} />
        </div>
      ) : loading ? (
        <p role="status" className="py-8">
          Loading categories…
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories
            .filter((c) => c.active && c.parentId === null)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <div key={c.id} className="space-y-3">
                <CategoryTile category={c} feature />
                <div className="flex flex-wrap gap-2 px-2">
                  {categories
                    .filter((child) => child.active && child.parentId === c.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((child) => (
                      <Link
                        key={child.id}
                        href={
                          '/shop?category=' + encodeURIComponent(child.slug)
                        }
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-primary hover:text-primary"
                      >
                        {child.name}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          {!categories.length && (
            <p className="py-8 text-sm text-muted">
              No categories are available yet.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
export function Shop({ params }: { params: ShopQuery }) {
  const router = useRouter(),
    catalog = useCatalog(),
    [data, setData] = useState<Page<Product> | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  useEffect(() => {
    if (showFilters)
      document.querySelector<HTMLButtonElement>('#shop-filters button')?.focus()
  }, [showFilters])
  const [q, setQ] = useState(params.q || ''),
    [category, setCategory] = useState(params.category || ''),
    [tag, setTag] = useState(params.tag || ''),
    [sort, setSort] = useState(
      params.sort === 'featured' ? 'newest' : params.sort || 'newest',
    ),
    [stock, setStock] = useState(
      params.stock === '1' ? 'true' : params.stock || '',
    ),
    [min, setMin] = useState(params.min || ''),
    [max, setMax] = useState(params.max || '')
  const key = JSON.stringify({
    ...params,
    sort: params.sort === 'featured' ? 'newest' : params.sort,
    stock: params.stock === '1' ? 'true' : params.stock,
  })
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setData(null)
    setError('')
    async function load() {
      try {
        const query = shopQuery(JSON.parse(key))
        const result = readPage(
          await api.request('/v1/products', {
            query,
            auth: false,
            signal: controller.signal,
          }),
          readProduct,
        )
        if (active) setData(result)
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : 'Products are unavailable.',
          )
      }
    }
    void load()
    const focus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 60000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
  }, [key, revision])
  function navigate(values: ShopQuery) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(values))
      if (value) query.set(key, value)
    router.push('/shop?' + query.toString())
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    navigate({ q, category, tag, sort, stock, min, max, page: '1' })
    setShowFilters(false)
  }
  return (
    <section className="container-shell py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Discover your next favorite
          </p>
          <h1 className="mt-2 text-3xl font-black">Explore products</h1>
          <p className="mt-3 text-sm text-muted">
            Prices and filters in USD. Availability is confirmed again at
            checkout.
          </p>
        </div>
        <button
          className="text-sm font-bold text-primary"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh products
        </button>
      </div>
      <button
        type="button"
        aria-expanded={showFilters}
        aria-controls="shop-filters"
        onClick={() => setShowFilters((open) => !open)}
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold lg:hidden"
      >
        <SlidersHorizontal size={16} />
        Filters
      </button>
      <div className="grid items-start gap-7 lg:grid-cols-[235px_minmax(0,1fr)]">
        <form
          id="shop-filters"
          className={`${showFilters ? 'block' : 'hidden'} h-fit space-y-4 rounded-[20px] border border-border bg-white p-5 lg:block`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowFilters(false)
              document
                .querySelector<HTMLButtonElement>(
                  '[aria-controls="shop-filters"]',
                )
                ?.focus()
            }
          }}
          onSubmit={submit}
        >
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => {
              setShowFilters(false)
              document
                .querySelector<HTMLButtonElement>(
                  '[aria-controls="shop-filters"]',
                )
                ?.focus()
            }}
            className="ml-auto flex size-10 items-center justify-center rounded-lg border border-border lg:hidden"
          >
            <X size={16} />
          </button>
          <label className="block text-sm font-bold">
            Search
            <input
              className={control + ' mt-2'}
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="block text-sm font-bold">
            Category
            <select
              aria-label="Category"
              className={control + ' mt-2'}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {categoryLabel(c, catalog.categories)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Tag
            <select
              aria-label="Tag"
              className={control + ' mt-2'}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">All tags</option>
              {['new', 'popular', 'sale'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Sort
            <select
              aria-label="Sort"
              className={control + ' mt-2'}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Availability
            <select
              aria-label="Availability"
              className={control + ' mt-2'}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            >
              <option value="">Any availability</option>
              <option value="true">In stock</option>
              <option value="false">Out of stock</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Minimum price (USD)
            <input
              inputMode="decimal"
              className={control + ' mt-2'}
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </label>
          <label className="block text-sm font-bold">
            Maximum price (USD)
            <input
              inputMode="decimal"
              className={control + ' mt-2'}
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </label>
          <button type="submit" className={button + ' w-full'}>
            Apply filters
          </button>
          <Link
            href="/shop"
            className="block text-center text-sm font-bold text-primary"
          >
            Clear filters
          </Link>
        </form>
        <div>
          {catalog.error && (
            <div className="mb-4">
              <ErrorState error={catalog.error} retry={catalog.reload} />
            </div>
          )}
          {error ? (
            <ErrorState
              error={error}
              retry={() => setRevision((value) => value + 1)}
            />
          ) : !data ? (
            <p role="status" className="p-8">
              Loading products…
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                {data.total} products · Page {data.page} of{' '}
                {Math.max(1, data.pages)}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                {data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {!data.items.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <h2 className="font-bold">No products match</h2>
                  <p className="mt-2 text-sm text-muted">
                    Try another category or clear the filters.
                  </p>
                </div>
              )}
              <div className="mt-7 flex justify-between gap-3">
                <button
                  className={button}
                  disabled={data.page <= 1}
                  onClick={() =>
                    navigate({ ...params, page: String(data.page - 1) })
                  }
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={data.page >= data.pages}
                  onClick={() =>
                    navigate({ ...params, page: String(data.page + 1) })
                  }
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
export function ProductDetails({ initial }: { initial: Product }) {
  const [product, setProduct] = useState(initial),
    [variantId, setVariantId] = useState(''),
    [image, setImage] = useState(0),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [gone, setGone] = useState(false)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const load = async () => {
      try {
        const value = readProduct(
          await api.request('/v1/products/' + initial.slug, {
            auth: false,
            signal: controller.signal,
          }),
        )
        if (active) {
          setProduct(value)
          setError('')
          setGone(false)
        }
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error ? error.message : 'Product refresh failed.',
          )
          if (
            error &&
            typeof error === 'object' &&
            'status' in error &&
            error.status === 404
          )
            setGone(true)
        }
      }
    }
    const focus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    void load()
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 60000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
  }, [initial.slug, revision])
  const { categories } = useCatalog()
  const productCategory = categories.find((c) =>
    product.categoryIds.includes(c.id),
  )
  const variant = product.variants.find((v) => v.id === variantId),
    price = variant?.priceMinor ?? product.priceMinor
  return (
    <section
      data-product-id={product.id}
      className="container-shell pb-16 pt-8 sm:pb-20"
    >
      <nav
        aria-label="Breadcrumb"
        className="mb-7 flex flex-wrap items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/">Home</Link>
        <ChevronRight size={14} />
        <Link href="/shop">Shop</Link>
        {productCategory && (
          <>
            <ChevronRight size={14} />
            <Link href={'/shop?category=' + productCategory.slug}>
              {productCategory.name}
            </Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="max-w-48 truncate font-semibold text-ink">
          {product.title}
        </span>
      </nav>
      {error && (
        <div className="my-5">
          <ErrorState
            error={error}
            retry={() => setRevision((value) => value + 1)}
          />
        </div>
      )}
      {!gone && (
        <div className="grid gap-9 md:grid-cols-2 md:gap-10 lg:gap-16">
          <div>
            <CatalogImage
              key={
                product.gallery[image]?.id || product.gallery[0]?.id || 'empty'
              }
              image={product.gallery[image] || product.gallery[0]}
              title={product.title}
              className="aspect-square w-full rounded-3xl border border-slate-200 bg-white p-7"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              {product.gallery.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={'View image ' + (index + 1)}
                  aria-pressed={image === index}
                  className={
                    'rounded-xl border p-1 ' +
                    (image === index ? 'border-primary' : 'border-slate-200')
                  }
                  onClick={() => setImage(index)}
                >
                  <CatalogImage
                    image={item}
                    title={product.title}
                    className="h-16 w-16 rounded-lg"
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {product.badge}
            </p>
            <h1 className="mt-3 text-[30px] font-extrabold leading-[1.2] tracking-[-.045em] sm:text-[39px]">
              {product.title}
            </h1>
            <p className="mt-4 max-w-[480px] whitespace-pre-wrap text-sm leading-7 text-muted">
              {product.description}
            </p>
            <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-6">
              <strong className="text-3xl font-extrabold">
                {money(price, product.currency)}
              </strong>
              {product.compareAtMinor !== null &&
                product.compareAtMinor > price && (
                  <del className="text-lg text-muted">
                    {money(product.compareAtMinor, product.currency)}
                  </del>
                )}
            </div>
            <p className="mt-3 text-sm text-muted">
              SKU: {variant?.sku || product.sku}
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-muted">
              <CheckCircle2 size={17} />
              {error
                ? 'Availability refresh required'
                : product.hasVariants
                  ? !variant
                    ? 'Choose a size / color option'
                    : variant.available
                      ? 'Selected option is in stock'
                      : 'Selected option is unavailable'
                  : product.purchasable
                    ? 'In stock'
                    : 'Currently unavailable'}
            </p>
            {product.hasVariants && (
              <fieldset className="mt-6">
                <legend className="text-sm font-bold">Size / color</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={variantId === v.id}
                      onClick={() => setVariantId(v.id)}
                      className={
                        'min-h-11 rounded-xl border px-4 py-3 text-sm font-bold transition ' +
                        (variantId === v.id
                          ? 'border-primary bg-blue-50 text-primary'
                          : 'border-border hover:border-primary')
                      }
                    >
                      {[v.options.size, v.options.color]
                        .filter(Boolean)
                        .join(' / ') || v.sku}
                      <span className="ml-2 text-xs font-normal">
                        {money(
                          v.priceMinor ?? product.priceMinor,
                          product.currency,
                        )}
                        {!v.available ? ' · Unavailable' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <ProductActions
              product={product}
              variantId={variantId}
              unavailable={Boolean(error)}
            />
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-[#fbfcff] p-4">
                <PackageCheck size={19} className="text-primary" />
                <p className="mt-2 text-sm font-extrabold">Delivery options</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Available services and charges are confirmed for your address
                  at checkout.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-[#fbfcff] p-4">
                <ShieldCheck size={19} className="text-primary" />
                <p className="mt-2 text-sm font-extrabold">Shop with clarity</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Review current availability and your order total before
                  placing an order.
                </p>
              </div>
            </div>
            <button
              className="mt-5 text-sm font-bold text-primary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh product availability
            </button>
          </div>
        </div>
      )}
      {!gone && productCategory && (
        <RelatedProducts
          category={productCategory.slug}
          productId={product.id}
        />
      )}
    </section>
  )
}

function RelatedProducts({
  category,
  productId,
}: {
  category: string
  productId: string
}) {
  const [items, setItems] = useState<Product[]>([])
  useEffect(() => {
    const controller = new AbortController()
    setItems([])
    void api
      .request('/v1/products', {
        auth: false,
        query: { category, limit: 5 },
        signal: controller.signal,
      })
      .then((value) => {
        if (!controller.signal.aborted)
          setItems(
            readPage(value, readProduct)
              .items.filter((item) => item.id !== productId)
              .slice(0, 4),
          )
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [category, productId])
  return items.length ? (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="section-heading mb-7">More to discover</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  ) : null
}
