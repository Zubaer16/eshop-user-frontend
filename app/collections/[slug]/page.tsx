import { CollectionPage } from '@/components/store/store-content'
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <CollectionPage key={slug} slug={slug} />
}
