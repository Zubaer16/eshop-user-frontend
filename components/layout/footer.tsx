'use client'
import Link from 'next/link'
import { Mail, PackageCheck, ShieldCheck, ShoppingBag } from 'lucide-react'
import { Logo } from './logo'
import { useStoreConfiguration } from '@/components/store/store-content'
import { useCatalog } from '@/components/catalog/catalog-provider'

export function Footer() {
  const store = useStoreConfiguration()
  const { categories } = useCatalog()
  const roots = categories
    .filter((item) => item.active && item.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    <>
      <div className="border-y border-border bg-[#fbfcff]">
        <div className="container-shell grid gap-7 py-8 md:grid-cols-3 md:gap-4">
          {[
            {
              icon: ShoppingBag,
              title: 'Everyday discoveries',
              detail: 'Explore products across your favorite categories',
            },
            {
              icon: PackageCheck,
              title: 'Order updates',
              detail: 'Follow your orders from your account',
            },
            {
              icon: ShieldCheck,
              title: 'Your account, protected',
              detail: 'Manage your details and security settings',
            },
          ].map(({ icon: Icon, title, detail }) => (
            <div key={title} className="flex items-center gap-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                <Icon size={22} />
              </span>
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs text-muted">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="bg-[#14203A] text-white">
        <div className="container-shell grid gap-10 py-14 lg:grid-cols-[1.7fr_1fr_1fr_1.2fr]">
          <div className="max-w-xs">
            <Logo light />
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#afbad0]">
              {store.data?.content.footerText ||
                'Everyday essentials and unexpected favorites. Discover something for every part of life.'}
            </p>
            {store.error && (
              <p role="status" className="mt-3 text-xs text-[#afbad0]">
                {store.error}
              </p>
            )}
          </div>
          <div>
            <h2 className="mb-5 text-xs font-extrabold uppercase tracking-[.15em]">
              Quick links
            </h2>
            <nav className="grid gap-3 text-sm text-[#b8c3d9]">
              <Link href="/shop">Shop all</Link>
              <Link href="/categories">All categories</Link>
              <Link href="/shop?tag=sale">Special offers</Link>
              <Link href="/shop?tag=new">New arrivals</Link>
              {store.operations?.showWishlist !== false && (
                <Link href="/wishlist">Saved items</Link>
              )}
              <Link href="/account/orders">Your orders</Link>
              <Link href="/track">Track your order</Link>
            </nav>
          </div>
          <div>
            <h2 className="mb-5 text-xs font-extrabold uppercase tracking-[.15em]">
              Categories
            </h2>
            <nav className="grid gap-3 text-sm text-[#b8c3d9]">
              {roots.map((item) => (
                <Link
                  key={item.id}
                  href={'/shop?category=' + encodeURIComponent(item.slug)}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <h2 className="mb-5 text-xs font-extrabold uppercase tracking-[.15em]">
              Here to help
            </h2>
            <nav className="grid gap-3 text-sm text-[#b8c3d9]">
              <Link href="/account">Your account</Link>
              <Link href="/account/notifications">Inbox</Link>
              {store.operations?.showPolicies && (
                <>
                  <Link href="/policies/privacy">Privacy</Link>
                  <Link href="/policies/terms">Terms</Link>
                  <Link href="/policies/returns">Returns</Link>
                </>
              )}
            </nav>
            {store.data?.profile.supportEmail && (
              <a
                href={'mailto:' + store.data.profile.supportEmail}
                className="mt-5 flex items-start gap-2 break-all text-sm text-[#b8c3d9]"
              >
                <Mail size={17} className="shrink-0" />
                {store.data.profile.supportEmail}
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-shell flex flex-wrap justify-between gap-2 py-5 text-xs text-[#96a4bf]">
            <span>
              © {new Date().getFullYear()}{' '}
              {store.data?.profile.storeName || 'eShop'}. All rights reserved.
            </span>
            <Link href="/account/settings">Account and privacy settings</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
