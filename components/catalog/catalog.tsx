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
export function LiveCategories() {
  const { categories, loading, error, reload } = useCatalog()
  return (
    <section className="container-shell py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        Explore eShop
      </p>
      <h1 className="mt-2 text-3xl font-black">Shop by category</h1>
      {error ? (
        <div className="mt-6">
          <ErrorState error={error} retry={reload} />
        </div>
      ) : loading ? (
        <p role="status" className="py-8">
          Loading categories…
        </p>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={'/shop?category=' + encodeURIComponent(c.slug)}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary"
            >
              <div
                className="mb-5 h-12 w-12 rounded-2xl"
                style={{
                  background: /^#[0-9a-f]{6}$/i.test(c.color)
                    ? c.color
                    : '#EAF0FF',
                }}
              />
              <h2 className="text-lg font-extrabold">
                {categoryLabel(c, categories)}
              </h2>
              <p className="mt-2 text-sm text-muted">{c.description}</p>
              <span className="mt-5 block text-sm font-bold text-primary">
                Explore products →
              </span>
            </Link>
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
function Card({ product }: { product: Product }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Link href={'/product/' + product.slug}>
        <CatalogImage
          key={product.gallery[0]?.id || 'empty'}
          image={product.gallery[0]}
          title={product.title}
          className="aspect-square w-full bg-slate-50 p-5"
        />
      </Link>
      <div className="p-4">
        {product.badge && (
          <p className="mb-2 text-xs font-bold text-primary">{product.badge}</p>
        )}
        <Link
          href={'/product/' + product.slug}
          className="font-extrabold hover:text-primary"
        >
          {product.title}
        </Link>
        <p className="mt-3 font-black">
          {money(product.priceMinor, product.currency)}
          {product.compareAtMinor != null &&
            product.compareAtMinor > product.priceMinor && (
              <del className="ml-2 text-xs font-normal text-muted">
                {money(product.compareAtMinor, product.currency)}
              </del>
            )}
        </p>
        <p className="mt-2 text-xs text-muted">
          {product.purchasable ? 'In stock' : 'Currently unavailable'}
          {product.hasVariants ? ' · Choose size / color' : ''}
        </p>
        <Link
          href={'/product/' + product.slug}
          className={button + ' mt-4 w-full'}
        >
          View product
        </Link>
        <ProductActions product={product} compact />
      </div>
    </article>
  )
}
export function LiveShop({ params }: { params: ShopQuery }) {
  const router = useRouter(),
    catalog = useCatalog(),
    [data, setData] = useState<Page<Product> | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
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
      <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
        <form
          className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          onSubmit={submit}
        >
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((product) => (
                  <Card key={product.id} product={product} />
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
export function LiveProduct({ initial }: { initial: Product }) {
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
  const variant = product.variants.find((v) => v.id === variantId),
    price = variant?.priceMinor ?? product.priceMinor
  return (
    <section data-product-id={product.id} className="container-shell py-10">
      <Link href="/shop" className="text-sm font-bold text-primary">
        ← Back to products
      </Link>
      {error && (
        <div className="my-5">
          <ErrorState
            error={error}
            retry={() => setRevision((value) => value + 1)}
          />
        </div>
      )}
      {!gone && (
        <div className="mt-7 grid gap-9 lg:grid-cols-2">
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
            <h1 className="mt-3 text-3xl font-black">{product.title}</h1>
            <p className="mt-5 text-3xl font-black">
              {money(price, product.currency)}
            </p>
            <p className="mt-3 text-sm text-muted">
              SKU: {variant?.sku || product.sku}
            </p>
            <p className="mt-3 text-sm font-bold">
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
              <label className="mt-6 block text-sm font-bold">
                Size / color
                <select
                  className={control + ' mt-2'}
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                >
                  <option value="">Choose an option</option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.options.size, v.options.color]
                        .filter(Boolean)
                        .join(' / ')}{' '}
                      —{' '}
                      {money(
                        v.priceMinor ?? product.priceMinor,
                        product.currency,
                      )}
                      {!v.available ? ' (unavailable)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {product.description}
            </p>
            <ProductActions
              product={product}
              variantId={variantId}
              unavailable={Boolean(error)}
            />
            <button
              className="mt-5 text-sm font-bold text-primary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh product availability
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
