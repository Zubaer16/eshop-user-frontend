'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ClipboardList, Search } from 'lucide-react'
import { DemoOrderCard } from '@/components/account/order-ui'
import { demoOrders, type PreviewOrderStatus } from '@/lib/account-preview'
import { usePreviewCopy } from '@/hooks/use-preview-copy'
import { useDisplayLocale } from '@/hooks/use-display-locale'
import { localizeOrderItem } from '@/lib/fixture-localization'

const tabs: { label: string; value: PreviewOrderStatus | 'all' }[] = [
  { label: 'All orders', value: 'all' },
  { label: 'Processing', value: 'processing' },
  { label: 'On the way', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
]

export default function OrdersPage() {
  const t = usePreviewCopy()
  const locale = useDisplayLocale()
  const [filter, setFilter] = useState<PreviewOrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const results = demoOrders.filter(
    (order) =>
      (filter === 'all' || order.status === filter) &&
      (order.id.toLowerCase().includes(query.toLowerCase().trim()) ||
        order.items.some(
          (item) =>
            item.title.toLowerCase().includes(query.toLowerCase().trim()) ||
            localizeOrderItem(item.title, locale)
              .toLowerCase()
              .includes(query.toLowerCase().trim()),
        )),
  )
  return (
    <section aria-labelledby="orders-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="orders-title" className="text-2xl font-black tracking-tight">
            {t.ordersTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">{t.ordersIntro}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary">
          {demoOrders.length} {t.ordersSamples}
        </span>
      </div>
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:p-5">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-[#f8faff] px-3 focus-within:border-primary">
          <Search size={18} className="shrink-0 text-muted" />
          <span className="sr-only">{t.ordersSearch}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.ordersSearchPlaceholder}
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t.ordersFilter}
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={tab.value === filter}
              onClick={() => setFilter(tab.value)}
              className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${tab.value === filter ? 'border-primary bg-primary text-white' : 'border-border bg-white text-muted hover:border-primary/40'}`}
            >
              {tab.value === 'all'
                ? t.allOrders
                : tab.value === 'processing'
                  ? t.statusProcessing
                  : tab.value === 'shipped'
                    ? t.statusShipped
                    : tab.value === 'delivered'
                      ? t.statusDelivered
                      : t.statusCancelled}
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite" className="mt-5 space-y-4">
        {results.length ? (
          results.map((order) => <DemoOrderCard key={order.id} order={order} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-[#fafbfe] px-6 py-12 text-center">
            <ClipboardList size={32} className="mx-auto text-muted" />
            <h3 className="mt-3 text-lg font-extrabold">{t.ordersNone}</h3>
            <p className="mt-2 text-sm text-muted">{t.ordersTry}</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
              className="mt-4 text-sm font-bold text-primary hover:underline"
            >
              {t.ordersClear}
            </button>
          </div>
        )}
      </div>
      <p className="mt-6 text-xs leading-5 text-muted">{t.ordersFuture}</p>
      <Link
        href="/track"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
      >
        {t.ordersTracking} <ArrowRight size={15} />
      </Link>
    </section>
  )
}
