import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProductDetails } from '@/components/store/product-details'
import { findProduct, products } from '@/lib/catalog'
import { isPreviewMode } from '@/lib/integration-mode'
import { publicProduct } from '@/lib/api/public-catalog'
import { LiveProduct } from '@/components/catalog/catalog'
import Link from 'next/link'

export function generateStaticParams() {
  return isPreviewMode ? products.map(({ slug }) => ({ slug })) : []
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (!isPreviewMode) {
    try {
      const product = await publicProduct(slug)
      return {
        title: product?.title || 'Product not found',
        description: product?.description || 'Product unavailable.',
        robots: { index: false, follow: false },
      }
    } catch {
      return {
        title: 'Product unavailable',
        robots: { index: false, follow: false },
      }
    }
  }
  const product = findProduct(slug)
  return {
    title: product?.title ?? 'Product not found',
    description: product
      ? `${product.description} Storefront preview only; no live orders.`
      : 'Product unavailable.',
    robots: { index: false, follow: false },
  }
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!isPreviewMode) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200)
      notFound()
    let product
    try {
      product = await publicProduct(slug)
    } catch {
      return (
        <section className="container-shell py-14">
          <h1 className="text-3xl font-black">
            Product temporarily unavailable
          </h1>
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
    return <LiveProduct key={product.id} initial={product} />
  }
  const product = findProduct(slug)
  if (!product) notFound()
  return <ProductDetails product={product} />
}
