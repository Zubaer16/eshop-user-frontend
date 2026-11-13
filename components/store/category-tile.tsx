'use client'
import Link from 'next/link'
import {
  Baby,
  BookOpen,
  Dumbbell,
  Headphones,
  House,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '@/lib/api/catalog'

const icons: Record<string, LucideIcon> = {
  electronics: Headphones,
  fashion: Shirt,
  'beauty-personal-care': Sparkles,
  'home-kitchen': House,
  'sports-outdoors': Dumbbell,
  grocery: ShoppingBasket,
  'books-stationery': BookOpen,
  'toys-baby': Baby,
}
export function CategoryTile({
  category,
  feature = false,
}: {
  category: Category
  feature?: boolean
}) {
  const Icon = icons[category.slug] || Tag
  return (
    <Link
      href={'/shop?category=' + encodeURIComponent(category.slug)}
      className={
        'group flex border border-border bg-white transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg ' +
        (feature
          ? 'items-center gap-4 rounded-[22px] p-5'
          : 'min-w-0 flex-col items-center gap-3 rounded-[20px] p-3 text-center sm:p-4')
      }
    >
      <span
        className={
          'flex shrink-0 items-center justify-center rounded-[18px] text-[#3d5177] transition group-hover:scale-105 ' +
          (feature ? 'size-[72px]' : 'size-[62px] sm:size-[76px]')
        }
        style={{
          backgroundColor: /^#[0-9a-f]{6}$/i.test(category.color)
            ? category.color
            : '#EAF0FF',
        }}
      >
        <Icon size={30} strokeWidth={1.65} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold leading-snug text-ink sm:text-sm">
          {category.name}
        </span>
        {feature && (
          <span className="mt-1 block text-xs leading-5 text-muted">
            {category.description}
          </span>
        )}
      </span>
    </Link>
  )
}
