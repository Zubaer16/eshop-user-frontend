'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Heart,
  MapPin,
  Package,
  Settings2,
  ShoppingCart,
  Truck,
  UserRound,
} from 'lucide-react'
import { DemoOrderCard } from '@/components/account/order-ui'
import { Button } from '@/components/ui/button'
import { useStoreReady } from '@/hooks/use-store-ready'
import { useFinishCopy } from '@/hooks/use-finish-copy'
import { demoOrders } from '@/lib/account-preview'
import { useCommerceStore } from '@/stores/commerce-store'

const quickLinks = [
  {
    href: '/account/orders',
    labelKey: 'quickOrders',
    descriptionKey: 'quickOrdersDesc',
    icon: Package,
  },
  {
    href: '/track',
    labelKey: 'quickTracking',
    descriptionKey: 'quickTrackingDesc',
    icon: Truck,
  },
  {
    href: '/account/addresses',
    labelKey: 'quickAddresses',
    descriptionKey: 'quickAddressesDesc',
    icon: MapPin,
  },
  {
    href: '/account/settings',
    labelKey: 'quickSettings',
    descriptionKey: 'quickSettingsDesc',
    icon: Settings2,
  },
]

export default function AccountOverview() {
  const t = useFinishCopy()
  const ready = useStoreReady()
  const cart = useCommerceStore((s) => s.cart)
  const wishlist = useCommerceStore((s) => s.wishlist)
  return (
    <div className="space-y-7">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1942ab] via-primary to-[#728efa] px-6 py-9 text-white sm:px-9">
        <div
          className="absolute -right-16 -top-20 size-64 rounded-full border-[36px] border-white/10"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <UserRound size={14} /> {t.accountBadge}
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-tight">
            {t.accountTitle}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-blue-50">
            {t.accountDescription}
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-6 border-white bg-white text-primary hover:bg-blue-50"
          >
            <Link href="/sign-in">
              {t.accountLogin} <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <Package className="text-primary" size={23} />
          <p className="mt-3 text-2xl font-black">{demoOrders.length}</p>
          <p className="mt-1 text-xs text-muted">{t.exampleOrders}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <Heart className="text-primary" size={23} />
          <p className="mt-3 text-2xl font-black">
            {ready ? wishlist.length : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">{t.savedItems}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <ShoppingCart className="text-primary" size={23} />
          <p className="mt-3 text-2xl font-black">
            {ready ? cart.reduce((sum, item) => sum + item.quantity, 0) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">{t.cartItems}</p>
        </div>
      </div>
      <section aria-labelledby="account-quick-links">
        <h2
          id="account-quick-links"
          className="mb-4 text-xl font-extrabold tracking-tight"
        >
          {t.accountExplore}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map(({ href, labelKey, descriptionKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-4 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
                <Icon size={21} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold">
                  {t[labelKey as keyof typeof t]}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {t[descriptionKey as keyof typeof t]}
                </p>
              </div>
              <ArrowRight
                size={16}
                className="text-muted group-hover:text-primary"
              />
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="sample-orders-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="sample-orders-title"
            className="text-xl font-extrabold tracking-tight"
          >
            {t.sampleOrder}
          </h2>
          <Link
            href="/account/orders"
            className="text-sm font-bold text-primary hover:underline"
          >
            {t.viewOrders} <ArrowRight size={15} className="inline" />
          </Link>
        </div>
        <DemoOrderCard order={demoOrders[0]} />
      </section>
    </div>
  )
}
