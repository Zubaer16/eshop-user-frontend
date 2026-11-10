'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { ProductCard } from '@/components/store/product-card'
import { categories, products, productPrice } from '@/lib/catalog'
import { useUiCopy } from '@/hooks/use-ui-copy'
import { buildShopQuery } from '@/lib/shop-query'
import { useStoreReady } from '@/hooks/use-store-ready'

type ShopProps = {
  query: string
  category: string
  tag: string
  sort: string
  price: string
  stock: string
}

export function ShopClient({
  query,
  category,
  tag,
  sort,
  price,
  stock,
}: ShopProps) {
  const ready = useStoreReady()
  const [text, setText] = useState(query)
  const [selectedCategory, setSelectedCategory] = useState(category)
  const [selectedTag, setSelectedTag] = useState(tag)
  const [sortBy, setSortBy] = useState(sort || 'featured')
  const [priceTier, setPriceTier] = useState(
    ['0', '1', '2'].includes(price) ? price : 'all',
  )
  const [stockOnly, setStockOnly] = useState(stock === '1')
  const [showFilters, setShowFilters] = useState(false)
  const filterToggleRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLElement>(null)

  function toggleMobileFilters() {
    const next = !showFilters
    setShowFilters(next)
    if (next)
      requestAnimationFrame(() =>
        filterPanelRef.current
          ?.querySelector<HTMLButtonElement>('button')
          ?.focus(),
      )
    else filterToggleRef.current?.focus()
  }

  function onFilterEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || !showFilters) return
    event.stopPropagation()
    setShowFilters(false)
    filterToggleRef.current?.focus()
  }
  const t = useUiCopy()
  const priceLevels = [25, 60, 120]
  const priceLimit =
    priceTier === 'all' ? undefined : priceLevels[Number(priceTier)]
  const currencyLabel = '$'

  // Replace the current URL without remounting Shop or stealing focus from
  // its search input. Native history changes are supported in Next App Router.
  useEffect(() => {
    const next = buildShopQuery({
      text,
      category: selectedCategory,
      tag: selectedTag,
      sort: sortBy,
      price: priceTier,
      stockOnly,
    })
    if (`/shop${window.location.search}` !== next)
      window.history.replaceState(window.history.state, '', next)
  }, [text, selectedCategory, selectedTag, sortBy, priceTier, stockOnly])

  const visible = useMemo(() => {
    const needle = text.toLocaleLowerCase().trim()
    const result = products.filter((product) => {
      const categoryName =
        categories.find((c) => c.id === product.category)?.label ?? ''
      const matchesText =
        !needle ||
        [
          product.title,
          product.description,
          product.category,
          categoryName,
        ].some((item) => item.toLocaleLowerCase().includes(needle))
      const matchesCategory =
        !selectedCategory ||
        (selectedCategory === 'style'
          ? product.category === 'fashion' || product.category === 'footwear'
          : product.category === selectedCategory)
      const matchesTag =
        !selectedTag ||
        (selectedTag === 'sale'
          ? !!product.compareAt
          : product.tag === selectedTag)
      const matchesPrice =
        priceLimit === undefined || productPrice(product) <= priceLimit
      const matchesStock = !stockOnly || product.stock > 0
      return (
        matchesText &&
        matchesCategory &&
        matchesTag &&
        matchesPrice &&
        matchesStock
      )
    })
    if (sortBy === 'price-asc')
      result.sort((a, b) => productPrice(a) - productPrice(b))
    if (sortBy === 'price-desc')
      result.sort((a, b) => productPrice(b) - productPrice(a))
    if (sortBy === 'newest')
      result.sort((a, b) => Number(b.tag === 'new') - Number(a.tag === 'new'))
    return result
  }, [text, selectedCategory, selectedTag, sortBy, priceLimit, stockOnly])

  function reset() {
    setText('')
    setSelectedCategory('')
    setSelectedTag('')
    setSortBy('featured')
    setPriceTier('all')
    setStockOnly(false)
  }
  const activeCategory = categories.find((c) => c.id === selectedCategory)
  const categoryLabel =
    selectedCategory === 'style' ? t.styleShoes : activeCategory?.label
  const filterCount =
    Number(!!selectedCategory) +
    Number(!!selectedTag) +
    Number(priceTier !== 'all') +
    Number(stockOnly)

  return (
    <div className="container-shell pb-20 pt-8 sm:pt-12">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted"
      >
        <Link href="/" className="hover:text-primary">
          {t.home}
        </Link>
        <ChevronRight size={14} />
        <span className="font-bold text-ink">{t.shop}</span>
      </nav>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.17em] text-primary">
            {t.shopIntro}
          </p>
          <h1 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">
            {categoryLabel ?? t.exploreCollection}
          </h1>
          <p className="mt-2 text-sm text-muted">{t.shopSubtitle}</p>
        </div>
        <span aria-live="polite" className="text-sm font-semibold text-muted">
          {visible.length} {t.productsFound}
        </span>
      </div>
      <div
        role="group"
        aria-label={t.categories}
        className="mt-7 flex gap-2 overflow-x-auto pb-2"
      >
        <button
          type="button"
          onClick={() => setSelectedCategory('')}
          aria-pressed={!selectedCategory}
          className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition ${!selectedCategory ? 'border-primary bg-primary text-white' : 'border-border bg-white text-[#596a84] hover:border-primary'}`}
        >
          {t.allProducts}
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('style')}
          aria-pressed={selectedCategory === 'style'}
          className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition ${selectedCategory === 'style' ? 'border-primary bg-primary text-white' : 'border-border bg-white text-[#596a84] hover:border-primary'}`}
        >
          {t.styleShoes}
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            aria-pressed={selectedCategory === c.id}
            className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition ${selectedCategory === c.id ? 'border-primary bg-primary text-white' : 'border-border bg-white text-[#596a84] hover:border-primary'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-7 lg:flex-row lg:gap-8">
        <aside
          ref={filterPanelRef}
          onKeyDown={onFilterEscape}
          aria-label={t.filterProducts}
          id="shop-filter-panel"
          className={`${showFilters ? 'block' : 'hidden'} w-full shrink-0 self-start rounded-[20px] border border-border bg-white p-5 lg:block lg:w-[235px]`}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">{t.filterProducts}</h2>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-bold text-primary hover:underline"
            >
              {t.reset}
            </button>
          </div>
          <fieldset>
            <legend className="mb-3 text-xs font-extrabold uppercase tracking-[.1em] text-muted">
              {t.category}
            </legend>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${!selectedCategory ? 'bg-blue-50 font-extrabold text-primary' : 'text-[#61708b] hover:bg-slate-50'}`}
              >
                {t.allCategories}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('style')}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${selectedCategory === 'style' ? 'bg-blue-50 font-extrabold text-primary' : 'text-[#61708b] hover:bg-slate-50'}`}
              >
                {t.styleShoes}
              </button>
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${selectedCategory === c.id ? 'bg-blue-50 font-extrabold text-primary' : 'text-[#61708b] hover:bg-slate-50'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="my-6 h-px bg-border" />
          <fieldset>
            <legend className="mb-3 text-xs font-extrabold uppercase tracking-[.1em] text-muted">
              {t.collection}
            </legend>
            <div className="space-y-3">
              {[
                { id: '', label: t.allProducts },
                { id: 'sale', label: t.specialOffers },
                { id: 'new', label: t.newArrivals },
                { id: 'popular', label: t.popularPicks },
              ].map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 text-sm text-[#61708b]"
                >
                  <input
                    name="collection"
                    type="radio"
                    value={c.id}
                    checked={selectedTag === c.id}
                    onChange={() => setSelectedTag(c.id)}
                    className="accent-[#2459e8]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="my-6 h-px bg-border" />
          <label
            htmlFor="price-range"
            className="mb-3 block text-xs font-extrabold uppercase tracking-[.1em] text-muted"
          >
            {t.priceRange}
          </label>
          <select
            id="price-range"
            value={priceTier}
            onChange={(event) => setPriceTier(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">{t.anyPrice}</option>
            {priceLevels.map((level, i) => (
              <option key={`price-${level}`} value={i}>
                {t.under} {currencyLabel}
                {level.toLocaleString('en-US')}
              </option>
            ))}
          </select>
          <label className="mt-6 flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-[#566783]">
            <input
              type="checkbox"
              checked={stockOnly}
              onChange={(event) => setStockOnly(event.target.checked)}
              className="size-4 accent-[#2459e8]"
            />{' '}
            {t.inStockOnly}
          </label>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[16px] border border-border bg-[#fbfcff] p-3">
            <div className="relative min-w-[150px] flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-label={t.keywordFilter}
                placeholder={t.searchWithin}
                className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              ref={filterToggleRef}
              disabled={!ready}
              aria-controls="shop-filter-panel"
              aria-expanded={showFilters}
              onClick={toggleMobileFilters}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-bold lg:hidden"
            >
              <SlidersHorizontal size={16} /> {t.filters}
              {filterCount > 0 ? ` (${filterCount})` : ''}
            </button>
            <label htmlFor="sort-products" className="sr-only">
              {t.sortProducts}
            </label>
            <select
              id="sort-products"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#495873] outline-none"
            >
              <option value="featured">{t.featured}</option>
              <option value="newest">{t.newArrivals}</option>
              <option value="price-asc">{t.priceLow}</option>
              <option value="price-desc">{t.priceHigh}</option>
            </select>
          </div>
          {(selectedCategory ||
            selectedTag ||
            text ||
            priceTier !== 'all' ||
            stockOnly) && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                categoryLabel,
                selectedTag &&
                  (selectedTag === 'sale' ? t.offers : selectedTag),
                text && `${t.search}: ${text}`,
                priceTier !== 'all' && `Under ${currencyLabel}${priceLimit}`,
                stockOnly && t.inStock,
              ]
                .filter(
                  (item): item is string =>
                    typeof item === 'string' && item.length > 0,
                )
                .map((item, i) => (
                  <span
                    key={`${i}-${item}`}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-primary"
                  >
                    {item}
                  </span>
                ))}
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary"
              >
                <X size={13} /> {t.clearAll}
              </button>
            </div>
          )}
          {visible.length > 0 ? (
            <div
              className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3"
              aria-label={t.productsFound}
            >
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div
              role="status"
              className="flex min-h-[350px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[#fbfcff] p-6 text-center"
            >
              <Search size={32} className="text-[#a1b0c8]" />
              <h3 className="mt-4 text-lg font-extrabold">{t.noMatches}</h3>
              <p className="mt-2 max-w-sm text-sm text-muted">
                {t.noMatchesDescription}
              </p>
              <button
                type="button"
                className="mt-5 font-bold text-primary hover:underline"
                onClick={reset}
              >
                {t.resetFilters}
              </button>
            </div>
          )}
          <p className="mt-8 text-center text-xs text-muted">
            {`Preview only · ${visible.length} local products · Backend search and pagination will replace this later.`}
          </p>
        </div>
      </div>
    </div>
  )
}
