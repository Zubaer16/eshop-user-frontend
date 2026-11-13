import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { publicProduct } from '@/lib/api/public-catalog'
import { ProductDetails } from '@/components/catalog/catalog'

// Published slugs require request-time catalog reads, including after deployment.
export const dynamic = 'force-dynamic'
function validSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) notFound()
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  validSlug(slug)
  let product
  try {
    product = await publicProduct(slug)
  } catch {
    return {
      title: 'Product unavailable',
      robots: { index: false, follow: false },
    }
  }
  if (!product) notFound()
  return {
    title: product.title,
    description: product.description,
    robots: { index: false, follow: false },
  }
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  validSlug(slug)
  let product
  try {
    product = await publicProduct(slug)
  } catch {
    return (
      <section className="container-shell py-14">
        <h1 className="text-3xl font-black">Product temporarily unavailable</h1>
        <p role="alert" className="mt-4 text-sm text-muted">
          The catalog service could not be reached. Please try again.
        </p>
        <Link href="/shop" className="mt-5 block font-bold text-primary">
          Back to products
        </Link>
      </section>
    )
  }
  if (!product) notFound()
  return <ProductDetails key={product.id} initial={product} />
}
