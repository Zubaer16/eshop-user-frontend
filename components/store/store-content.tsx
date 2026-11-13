'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api/client'
import { publicData, readPublic } from '@/lib/api/public-data'
import { Homepage } from '@/components/store/home'
import { ProductCard } from './product-card'
export type Asset = {
  id: string
  url: string
  alt?: string
  width: number
  height: number
  mimeType?: string
  srcSet?: string
  sizes?: string
}
export type StoreProductCard = {
  id: string
  slug: string
  title: string
  currency: string
  priceMinor: number
  compareAtMinor: number | null
  badge: string
  tag: string | null
  availableQuantity: number
  hasVariants: boolean
  image: Asset | null
}
export type Collection = {
  id: string
  slug: string
  title: string
  description: string
  position: number
  productIds: string[]
  productCount: number
  productsTruncated: boolean
  products: StoreProductCard[]
}
export type Home = {
  schemaVersion: number
  revision: string
  bannersTruncated: boolean
  collectionsTruncated: boolean
  banners: {
    id: string
    headline: string
    subtitle: string
    ctaText: string
    ctaHref: string
    slot: 'hero' | 'secondary' | 'promo'
    position: number
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
        const root = document.documentElement
        if (value.configured && /^#[a-f0-9]{6}$/i.test(value.accentColor)) {
          root.style.setProperty('--primary', value.accentColor)
          root.style.setProperty(
            '--primary-hover',
            `color-mix(in srgb, ${value.accentColor}, black 15%)`,
          )
          root.style.setProperty('--ring', value.accentColor)
        } else {
          for (const token of ['--primary', '--primary-hover', '--ring'])
            root.style.removeProperty(token)
        }
        if (
          value.configured &&
          /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/.test(value.locale)
        )
          root.dataset.storeLocale = value.locale
        else delete root.dataset.storeLocale
        if (value.configured) root.dataset.storeTheme = value.themeMode
        else delete root.dataset.storeTheme
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
export function StoreHome() {
  const [data, setData] = useState<Home | null>(() =>
      publicData.peek<Home>('/v1/store/homepage'),
    ),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    store = useStoreConfiguration()
  useEffect(() => {
    let active = true
    setData(publicData.peek<Home>('/v1/store/homepage'))
    setError('')
    void readPublic<Home>('/v1/store/homepage', {}, revision > 0)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError('Published store content is unavailable.')
      })
    return () => {
      active = false
    }
  }, [revision])
  if (error) {
    return (
      <section className="container-shell py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white"
          >
            Retry loading content
          </button>
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="container-shell py-12">
        <p
          role="status"
          className="rounded-2xl border border-border bg-white p-6 text-sm text-muted"
        >
          Loading published store content…
        </p>
      </section>
    )
  }

  return (
    <Homepage
      data={data}
      supportNotice={store.data?.profile.supportNotice || ''}
      onRefresh={() => setRevision((value) => value + 1)}
    />
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
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {collection.products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
export function CollectionPage({ slug }: { slug: string }) {
  const [data, setData] = useState<Collection | null>(() =>
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
        ? publicData.peek<Collection>('/v1/store/collections/' + slug)
        : null,
    ),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('Collection unavailable.')
      return
    }
    setData(publicData.peek<Collection>('/v1/store/collections/' + slug))
    setError('')
    void readPublic<Collection>('/v1/store/collections/' + slug)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active)
          setError('Collection is unavailable or no longer published.')
      })
    return () => {
      active = false
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
export function PolicyPage({ kind }: { kind: string }) {
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
