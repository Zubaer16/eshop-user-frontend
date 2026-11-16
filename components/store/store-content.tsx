'use client'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { useEffect, useState } from 'react'
import { publicData, readPublic } from '@/lib/api/public-data'
import { Homepage } from '@/components/store/home'
import { ProductCard } from './product-card'
import { useStoreConfiguration } from './store-configuration'
export { StoreProvider, useStoreConfiguration } from './store-configuration'
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
export function StoreHome({
  initial = null,
  expiresAt = 0,
}: {
  initial?: Home | null
  expiresAt?: number
}) {
  const [data, setData] = useState<Home | null>(
      () => initial ?? publicData.peek<Home>('/v1/store/homepage'),
    ),
    [error, setError] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    [revision, setRevision] = useState(0),
    store = useStoreConfiguration()
  useEffect(() => {
    let active = true
    if (initial && revision === 0)
      publicData.seed('/v1/store/homepage', {}, initial, expiresAt)
    setError('')
    setRefreshing(true)
    void readPublic<Home>('/v1/store/homepage', {}, revision > 0)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError('Published store content is unavailable.')
      })
      .finally(() => {
        if (active) setRefreshing(false)
      })
    return () => {
      active = false
    }
  }, [revision, initial, expiresAt])
  if (error && !data) {
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

  if (!data)
    return (
      <section className="container-shell py-12">
        <ContentSkeleton
          variant="home"
          label="Loading published store content"
        />
      </section>
    )

  return (
    <>
      {error && (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-white p-4 text-sm text-red-800 shadow-lg"
        >
          <span>{error}</span>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => setRevision((value) => value + 1)}
            className="min-h-9 rounded-lg px-3 text-xs font-bold text-primary disabled:opacity-50"
          >
            Retry loading content
          </button>
        </p>
      )}
      <Homepage
        data={data}
        refreshing={refreshing}
        supportNotice={store.data?.profile.supportNotice || ''}
        onRefresh={() => setRevision((value) => value + 1)}
      />
    </>
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
export function CollectionPage({
  slug,
  initial = null,
  expiresAt = 0,
}: {
  slug: string
  initial?: Collection | null
  expiresAt?: number
}) {
  const [data, setData] = useState<Collection | null>(() =>
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
        ? publicData.peek<Collection>('/v1/store/collections/' + slug) ||
          initial
        : null,
    ),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('Collection unavailable.')
      return
    }
    if (initial)
      publicData.seed('/v1/store/collections/' + slug, {}, initial, expiresAt)
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
  }, [slug, initial, expiresAt])
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
        <ContentSkeleton variant="grid" label="Loading published collection" />
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
        <ContentSkeleton variant="list" label="Loading policy" />
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
