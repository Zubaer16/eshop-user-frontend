import type { Metadata } from 'next'
import { CategoriesClient } from '@/components/store/categories-client'
import { LiveCategories } from '@/components/catalog/catalog'
import { isPreviewMode } from '@/lib/integration-mode'

export const metadata: Metadata = {
  title: 'Explore Categories',
  description: 'Browse electronics, fashion, shoes, home and more at eShop.',
}

export default function CategoriesPage() {
  return isPreviewMode ? <CategoriesClient /> : <LiveCategories />
}
