'use client'

import { NavigationProvider } from './navigation-provider'
import { AccountPreload } from '@/components/account/account-preload'
import { AuthProvider } from '@/components/auth/auth-provider'
import { CatalogProvider } from '@/components/catalog/catalog-provider'
import { CommerceProvider } from '@/components/shopping/commerce-provider'
import { CartDrawer } from '@/components/shopping/cart'
import {
  StoreProvider,
  type Bootstrap,
  type Operations,
} from '@/components/store/store-configuration'
import { PushLifecycle } from '@/components/notifications/push-lifecycle'
import type { Category } from '@/lib/api/catalog'

export function Providers({
  children,
  initialCategories = null,
  categoriesExpiresAt = 0,
  initialBootstrap = null,
  initialOperations = null,
}: {
  children: React.ReactNode
  initialCategories?: Category[] | null
  categoriesExpiresAt?: number
  initialBootstrap?: Bootstrap | null
  initialOperations?: Operations | null
}) {
  return (
    <NavigationProvider>
      <StoreProvider
        initialBootstrap={initialBootstrap}
        initialOperations={initialOperations}
        expiresAt={categoriesExpiresAt}
      >
        <AuthProvider>
          <AccountPreload />
          <PushLifecycle />
          <CommerceProvider>
            <CatalogProvider
              initial={initialCategories}
              expiresAt={categoriesExpiresAt}
            >
              {children}
              <CartDrawer />
            </CatalogProvider>
          </CommerceProvider>
        </AuthProvider>
      </StoreProvider>
    </NavigationProvider>
  )
}
