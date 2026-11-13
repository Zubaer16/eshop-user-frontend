'use client'

import { AuthProvider } from '@/components/auth/auth-provider'
import { CatalogProvider } from '@/components/catalog/catalog-provider'
import { CommerceProvider } from '@/components/shopping/commerce-provider'
import { CartDrawer } from '@/components/shopping/cart'
import { StoreProvider } from '@/components/store/store-content'
import { PushLifecycle } from '@/components/notifications/push-lifecycle'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AuthProvider>
        <PushLifecycle />
        <CommerceProvider>
          <CatalogProvider>
            {children}
            <CartDrawer />
          </CatalogProvider>
        </CommerceProvider>
      </AuthProvider>
    </StoreProvider>
  )
}
