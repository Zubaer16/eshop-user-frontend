/* eslint-disable @next/next/no-img-element -- Backend-verified public media. */
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api/client'
import { money, imageUrl } from '@/lib/api/catalog'
import { isPreviewMode } from '@/lib/integration-mode'
type Asset = {
  id: string
  url: string
  alt?: string
  width: number
  height: number
}
type ProductCard = {
  id: string
  slug: string
  title: string
  currency: string
  priceMinor: number
  availableQuantity: number
  hasVariants: boolean
  image: Asset | null
}
type Collection = {
  id: string
  slug: string
  title: string
  description: string
  productCount: number
  productsTruncated: boolean
  products: ProductCard[]
}
type Home = {
  bannersTruncated: boolean
  collectionsTruncated: boolean
  banners: {
    id: string
    headline: string
    subtitle: string
    ctaText: string
    ctaHref: string
    image: Asset | null
  }[]
  collections: Collection[]
}
type Bootstrap = {
  profile: {
    configured: boolean
    storeName: string | null
    supportEmail: string | null
    supportNotice: string
    websiteUrl: string
  }
  content: {
    seoTitle: string
    seoDescription: string
    footerText: string
    privacyPolicy: string
    termsOfService: string
    returnPolicy: string
  }
  branding: { logo: Asset | null; favicon: Asset | null }
}
type Operations = {
  configured: boolean
  locale: string
  displayCurrency: string
  themeMode: string
  accentColor: string
  showWishlist: boolean
  showPolicies: boolean
}
const Context = createContext<{
  data: Bootstrap | null
  operations: Operations | null
  error: string
}>({ data: null, operations: null, error: '' })
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null),
    [operations, setOperations] = useState<Operations | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    if (isPreviewMode) return
    let active = true
    async function load() {
      const results = await Promise.allSettled([
        api.request<Bootstrap>('/v1/store/bootstrap', { auth: false }),
        api.request<Operations>('/v1/store/operations', { auth: false }),
      ])
      if (!active) return
      const [b, o] = results
      if (b.status === 'fulfilled') {
        setData(b.value)
        setError('')
      } else {
        setData(null)
        setError('Store information is temporarily unavailable.')
      }
      if (o.status === 'fulfilled') {
        setOperations(o.value)
        const value = o.value
        if (/^#[a-f0-9]{6}$/i.test(value.accentColor))
          document.documentElement.style.setProperty(
            '--primary',
            value.accentColor,
          )
        if (/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/.test(value.locale))
          document.documentElement.dataset.storeLocale = value.locale
        document.documentElement.dataset.storeTheme = value.themeMode
      } else setOperations(null)
    }
    void load()
    window.addEventListener('focus', load)
    const timer = setInterval(() => void load(), 60000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [])
  return (
    <Context.Provider value={{ data, operations, error }}>
      {children}
    </Context.Provider>
  )
}
export const useStoreConfiguration = () => useContext(Context)
export function LiveStoreHome() {
  const [data, setData] = useState<Home | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    store = useStoreConfiguration()
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setData(null)
    setError('')
    void api
      .request<Home>('/v1/store/homepage', {
        auth: false,
        signal: controller.signal,
      })
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError('Published store content is unavailable.')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [revision])
  return (
    <section className="container-shell space-y-8 py-10">
      <h1 className="text-3xl font-black">
        {store.data?.profile.storeName || 'eShop'}
      </h1>
      {store.data?.profile.supportNotice && (
        <p className="rounded-xl bg-blue-50 p-4">
          {store.data.profile.supportNotice}
        </p>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading published store content…</p>
      ) : (
        <>
          {data.banners.map((b) => (
            <article
              key={b.id}
              className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-7 md:grid-cols-2"
            >
              <div>
                <h2 className="text-3xl font-black">{b.headline}</h2>
                <p className="my-4 text-muted">{b.subtitle}</p>
                {safeStorePath(b.ctaHref) && (
                  <Link
                    href={b.ctaHref}
                    className="inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white"
                  >
                    {b.ctaText}
                  </Link>
                )}
              </div>
              {b.image && imageUrl(b.image.url) && (
                <img
                  src={imageUrl(b.image.url)!}
                  width={b.image.width}
                  height={b.image.height}
                  alt={b.image.alt || b.headline}
                  className="max-h-80 w-full rounded-2xl object-contain"
                />
              )}
            </article>
          ))}
          {data.collections.map((c) => (
            <section key={c.id} className="space-y-5">
              <Link
                href={'/collections/' + c.slug}
                className="text-2xl font-black text-primary"
              >
                {c.title}
              </Link>
              <p className="text-sm text-muted">{c.description}</p>
              <CollectionProducts collection={c} />
            </section>
          ))}
          {!data.banners.length && !data.collections.length && (
            <p>
              No featured content is published yet. Browse the current catalog.
            </p>
          )}
          {(data.bannersTruncated || data.collectionsTruncated) && (
            <p className="text-sm text-muted">
              Featured selection is bounded; browse the catalog for more.
            </p>
          )}
        </>
      )}
      <div className="flex gap-5">
        <Link href="/shop" className="font-bold text-primary">
          Browse products
        </Link>
        <button
          onClick={() => setRevision((v) => v + 1)}
          className="text-sm font-bold text-primary"
        >
          Refresh featured content
        </button>
      </div>
    </section>
  )
}
export function safeStorePath(value: string) {
  return (
    /^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(value) &&
    !/(?:\.\.|%2f|%5c|%25|\\)/i.test(value)
  )
}
function CollectionProducts({ collection }: { collection: Collection }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {collection.products.map((p) => (
        <article
          key={p.id}
          className="space-y-3 rounded-2xl border bg-white p-5"
        >
          {p.image && imageUrl(p.image.url) && (
            <img
              src={imageUrl(p.image.url)!}
              alt={p.image.alt || p.title}
              width={p.image.width}
              height={p.image.height}
              className="aspect-square w-full object-contain"
            />
          )}
          <Link
            className="block font-bold text-primary"
            href={'/product/' + p.slug}
          >
            {p.title}
          </Link>
          <p className="font-bold">{money(p.priceMinor, p.currency)}</p>
          <p className="text-xs text-muted">
            {p.availableQuantity > 0
              ? 'Current availability shown on product page'
              : 'Currently unavailable'}
            {p.hasVariants ? ' · Choose options on product page' : ''}
          </p>
        </article>
      ))}
    </div>
  )
}
export function LiveCollection({ slug }: { slug: string }) {
  const [data, setData] = useState<Collection | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const c = new AbortController()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('Collection unavailable.')
      return
    }
    void api
      .request<Collection>('/v1/store/collections/' + slug, {
        auth: false,
        signal: c.signal,
      })
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active)
          setError('Collection is unavailable or no longer published.')
      })
    return () => {
      active = false
      c.abort()
    }
  }, [slug])
  return (
    <section className="container-shell space-y-6 py-10">
      {error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <>
          <h1 className="text-3xl font-black">{data.title}</h1>
          <p>{data.description}</p>
          <CollectionProducts collection={data} />
        </>
      ) : (
        <p role="status">Loading published collection…</p>
      )}
    </section>
  )
}
export function LivePolicy({ kind }: { kind: string }) {
  const store = useStoreConfiguration(),
    key =
      kind === 'privacy'
        ? 'privacyPolicy'
        : kind === 'terms'
          ? 'termsOfService'
          : kind === 'returns'
            ? 'returnPolicy'
            : null
  return (
    <section className="container-shell max-w-4xl space-y-5 py-10">
      <h1 className="text-3xl font-black">
        {kind === 'privacy'
          ? 'Privacy policy'
          : kind === 'terms'
            ? 'Terms of service'
            : 'Return policy'}
      </h1>
      {store.error ? (
        <p role="alert">{store.error}</p>
      ) : !store.data ? (
        <p role="status">Loading policy…</p>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-7">
          {key
            ? store.data.content[key] || 'This policy has not been published.'
            : 'Policy unavailable.'}
        </p>
      )}
    </section>
  )
}
export function LiveStoreFooter() {
  const store = useStoreConfiguration()
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="container-shell space-y-4">
        <p className="font-bold">{store.data?.profile.storeName || 'eShop'}</p>
        {store.error && (
          <p role="status" className="text-sm">
            {store.error}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm text-muted">
          {store.data?.content.footerText}
        </p>
        {store.data?.profile.supportEmail && (
          <a
            className="text-sm text-primary"
            href={'mailto:' + store.data.profile.supportEmail}
          >
            {store.data.profile.supportEmail}
          </a>
        )}
        <nav className="flex flex-wrap gap-5 text-sm font-bold text-primary">
          <Link href="/shop">Shop</Link>
          <Link href="/account/orders">Your orders</Link>
          <Link href="/account/notifications">Inbox</Link>
          {store.operations?.showPolicies && (
            <>
              <Link href="/policies/privacy">Privacy</Link>
              <Link href="/policies/terms">Terms</Link>
              <Link href="/policies/returns">Returns</Link>
            </>
          )}
        </nav>
      </div>
    </footer>
  )
}
