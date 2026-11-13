import type { Metadata } from 'next'
import { Categories } from '@/components/catalog/catalog'
export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse the current product categories.',
}
export default function Page() {
  return <Categories />
}
