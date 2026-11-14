'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  House,
  MapPin,
  Package,
  Settings2,
  Truck,
  UserRound,
  Bell,
} from 'lucide-react'
import { prefetchOrders } from './account-preload'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils'
const sections = [
  { href: '/account', label: 'Overview', icon: House },
  { href: '/account/orders', label: 'Your orders', icon: Package },
  { href: '/track', label: 'Track your order', icon: Truck },
  { href: '/account/addresses', label: 'Saved addresses', icon: MapPin },
  { href: '/account/settings', label: 'Security settings', icon: Settings2 },
  { href: '/account/notifications', label: 'Inbox', icon: Bell },
]
export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="container-shell pb-20 pt-8 sm:pt-11">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-primary">
            <UserRound size={16} />
            Your account
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Account center
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Manage your details, orders and preferences in one place.
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          Continue shopping
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="grid items-start gap-7 lg:grid-cols-[238px_minmax(0,1fr)]">
        <nav
          aria-label="Account navigation"
          className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-44 lg:flex-col lg:rounded-[22px] lg:border lg:border-border lg:bg-white lg:p-3"
        >
          {sections.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === '/account/orders' &&
                pathname.startsWith('/account/orders/'))
            return (
              <Link
                key={href}
                href={href}
                onMouseEnter={
                  href === '/account/orders' ? prefetchOrders : undefined
                }
                onFocus={
                  href === '/account/orders' ? prefetchOrders : undefined
                }
                onTouchStart={
                  href === '/account/orders' ? prefetchOrders : undefined
                }
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border px-3.5 py-3 text-sm font-bold transition lg:border-transparent',
                  active
                    ? 'border-primary/15 bg-blue-50 text-primary'
                    : 'border-border bg-white text-[#4c5a75] hover:border-primary/30 hover:bg-[#f7faff]',
                )}
              >
                <Icon size={18} />
                {label}
                {active && <span className="sr-only">(current)</span>}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => {
              void api.signOut()
            }}
            className="shrink-0 rounded-xl px-3.5 py-3 text-left text-sm font-bold text-muted"
          >
            Sign out
          </button>
        </nav>
        <div className="min-w-0 [&_.container-shell]:w-full [&_.container-shell]:max-w-none [&_.container-shell]:py-0">
          {children}
        </div>
      </div>
    </div>
  )
}
