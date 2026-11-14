'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Globe2,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react'
import { prefetchOrders } from '@/components/account/account-preload'
import { Logo } from '@/components/layout/logo'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { dictionary } from '@/lib/i18n'
import { useCatalog } from '@/components/catalog/catalog-provider'
import { cn } from '@/lib/utils'
import { useUiCopy } from '@/hooks/use-ui-copy'
import { useCommerce } from '@/components/shopping/commerce-provider'
import { useStoreConfiguration } from '@/components/store/store-content'

function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const t = useUiCopy()
  const [query, setQuery] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push(
      `/shop${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
    )
  }
  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        'flex items-center overflow-hidden rounded-xl border border-[#e3e8f1] bg-[#f5f7fb] transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10',
        compact ? 'h-11' : 'h-12',
      )}
    >
      <Search className="ml-3.5 shrink-0 text-[#8a96aa]" size={19} />
      <input
        aria-label={t.searchCatalog}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.searchPlaceholder}
        className="h-full w-full min-w-0 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-[#8a96aa]"
      />
      <button
        aria-label={t.submitSearch}
        className={cn(
          'mr-1 hidden shrink-0 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover sm:block',
          compact ? 'h-9' : 'h-10',
        )}
        type="submit"
      >
        {t.search}
      </button>
    </form>
  )
}

function Counter({ count }: { count: number }) {
  return count > 0 ? (
    <span className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
      {count > 9 ? '9+' : count}
    </span>
  ) : null
}

export function Header() {
  const store = useStoreConfiguration()
  const shopping = useCommerce(
    useShallow((state) => {
      return {
        setCartOpen: state.setCartOpen,
        cartCount:
          state.cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
        wishCount: state.wishlist?.count || 0,
      }
    }),
  )
  const { categories: catalogCategories } = useCatalog()
  const categories = catalogCategories
    .filter((c) => c.active && c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      label: c.name,
      description: c.description,
    }))
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const categoryTriggerRef = useRef<HTMLButtonElement>(null)
  const t = dictionary()
  const { cartCount, wishCount } = shopping
  const links = [
    { href: '/shop', label: t.shop },
    { href: '/categories', label: t.categories },
    { href: '/shop?tag=sale', label: t.deals },
    { href: '/shop?tag=new', label: t.newArrivals },
  ]

  useEffect(() => {
    if (!categoriesOpen) return
    function closeOnOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setCategoriesOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCategoriesOpen(false)
        categoryTriggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [categoriesOpen])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur-xl">
      <div className="border-b border-[#dfe6f7] bg-[#f4f7ff] text-[11px] text-[#4b5d84]">
        <div className="container-shell flex h-8 items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 truncate">
            <Globe2 size={13} />
            {t.global}
          </span>
          <span className="hidden font-bold sm:block">
            {'One store · Many discoveries'}{' '}
            <span className="ml-2 text-primary">✦</span>
          </span>
        </div>
      </div>
      <div className="container-shell flex h-[72px] items-center gap-4 lg:gap-7">
        <button
          aria-label={'Open navigation'}
          type="button"
          className="flex size-10 items-center justify-center rounded-xl border border-border lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={21} />
        </button>
        <Logo />
        <div className="hidden min-w-0 flex-1 lg:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <span
            className="hidden rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-primary md:inline-flex"
            aria-label="Preferred display currency; prices retain their listed currency"
          >
            {store.operations?.displayCurrency || 'USD'}
          </span>
          <Link
            href="/account"
            onMouseEnter={prefetchOrders}
            onFocus={prefetchOrders}
            onTouchStart={prefetchOrders}
            aria-label={t.account}
            className="hidden items-center gap-2 rounded-lg p-2 text-ink hover:bg-slate-100 md:flex"
          >
            <UserRound size={21} />
            <span className="hidden text-xs font-bold xl:block">
              {t.account}
            </span>
          </Link>
          {
            <Link
              href="/account/notifications"
              className="rounded-lg p-2 text-sm font-bold text-primary"
            >
              Inbox
            </Link>
          }
          {store.operations?.showWishlist !== false && (
            <Link
              href="/wishlist"
              aria-label={t.wishlist}
              title={t.wishlist}
              className="relative flex size-10 items-center justify-center rounded-lg hover:bg-slate-100"
            >
              <Heart size={22} />
              <Counter count={wishCount} />
            </Link>
          )}
          <button
            type="button"
            aria-label={
              cartCount === null
                ? 'Open cart, count unavailable'
                : `Open cart, ${cartCount} items`
            }
            onClick={() => {
              shopping.setCartOpen(true)
            }}
            className="relative flex size-10 items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <ShoppingBag size={22} />
            <Counter count={cartCount ?? 0} />
          </button>
        </div>
      </div>
      <div className="container-shell pb-3 lg:hidden">
        <SearchBox compact />
      </div>
      <nav
        className="relative hidden border-t border-border/70 lg:block"
        aria-label="Main navigation"
      >
        <div className="container-shell flex h-12 items-center gap-7">
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              ref={categoryTriggerRef}
              aria-expanded={categoriesOpen}
              aria-controls="desktop-category-menu"
              onClick={() => setCategoriesOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setCategoriesOpen(true)
                  requestAnimationFrame(() =>
                    menuRef.current
                      ?.querySelector<HTMLAnchorElement>(
                        '#desktop-category-menu a',
                      )
                      ?.focus(),
                  )
                }
              }}
              className="inline-flex h-12 items-center gap-2 border-r border-border pr-6 text-[13px] font-extrabold text-primary"
            >
              <Menu size={17} />
              {t.categories}
              <ChevronDown
                size={14}
                className={
                  categoriesOpen ? 'rotate-180 transition' : 'transition'
                }
              />
            </button>
            {categoriesOpen && (
              <div
                id="desktop-category-menu"
                className="absolute left-0 top-[48px] z-30 w-[660px] rounded-b-2xl border border-border bg-white p-6 shadow-[0_22px_54px_rgba(20,32,58,.16)]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-extrabold">{t.categories}</p>
                  <Link
                    href="/categories"
                    onClick={() => setCategoriesOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    {'View all'} <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/shop?category=${encodeURIComponent(category.slug)}`}
                      onClick={() => setCategoriesOpen(false)}
                      className="rounded-xl px-3 py-3 hover:bg-[#f3f6ff]"
                    >
                      <span className="block text-sm font-extrabold">
                        {category.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {category.description}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {links
            .filter((link) => link.href !== '/categories')
            .map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'text-[13px] font-semibold transition hover:text-primary',
                  pathname === href ? 'text-primary' : 'text-[#4c5872]',
                )}
              >
                {label}
              </Link>
            ))}
          {categories.slice(0, 2).map((c) => (
            <Link
              key={c.id}
              href={'/shop?category=' + encodeURIComponent(c.slug)}
              className="text-[13px] font-semibold text-[#4c5872] hover:text-primary"
            >
              {c.label}
            </Link>
          ))}
          <span className="ml-auto text-[12px] font-semibold text-[#52708f]">
            ✦ {t.freeShipping}
          </span>
        </div>
      </nav>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="overflow-y-auto p-5">
          <SheetTitle className="sr-only">Mobile navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Browse product collections. All prices are in USD.
          </SheetDescription>
          <div className="mb-8 flex items-center justify-between pr-7">
            <Logo />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold hover:bg-blue-50"
              >
                {label}
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
          <Link
            href="/account"
            onMouseEnter={prefetchOrders}
            onFocus={prefetchOrders}
            onTouchStart={prefetchOrders}
            onClick={() => setMobileOpen(false)}
            className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-3 text-sm font-extrabold text-primary"
          >
            <span className="flex items-center gap-2">
              <UserRound size={17} /> Your account
            </span>
            <ArrowRight size={16} />
          </Link>
          <div className="my-6 h-px bg-border" />
          <p className="mb-2 px-3 text-xs font-extrabold uppercase tracking-[.15em] text-muted">
            {t.shopByCategory}
          </p>
          <div className="space-y-1">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/shop?category=${encodeURIComponent(category.slug)}`}
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-blue-50"
              >
                {category.label}
              </Link>
            ))}
          </div>
          <div className="my-6 h-px bg-border" />
          <p className="rounded-xl border border-border bg-blue-50 px-3 py-2 text-sm font-semibold text-primary">
            All prices in USD ($)
          </p>
        </SheetContent>
      </Sheet>
    </header>
  )
}
