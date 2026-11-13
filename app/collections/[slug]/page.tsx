import { CollectionPage } from '@/components/store/store-content'
import { publicCollection } from '@/lib/api/public-catalog'
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const initial = await publicCollection(slug).catch(() => null)
  return (
    <CollectionPage
      key={slug}
      slug={slug}
      initial={initial}
      expiresAt={Date.now() + 30000}
    />
  )
}
