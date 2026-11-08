'use client'

import { AuthProvider } from '@/components/auth/auth-provider'
import { CatalogProvider } from '@/components/catalog/catalog-provider'
import { CommerceProvider } from '@/components/shopping/commerce-provider'
import { LiveCartDrawer } from '@/components/shopping/cart'
import { isPreviewMode } from '@/lib/integration-mode'
import { StoreProvider } from '@/components/store/live-store'
import { PushLifecycle } from '@/components/notifications/push-lifecycle'
import { Toaster } from 'sonner'
import { StoreHydrator } from '@/hooks/use-store-ready'
import { CartDrawer } from '@/components/store/cart-drawer'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AuthProvider>
        <PushLifecycle />
        <CommerceProvider>
          <CatalogProvider>
            {isPreviewMode && <StoreHydrator />}
            {children}
            {isPreviewMode && <CartDrawer />}
            {!isPreviewMode && <LiveCartDrawer />}
            <Toaster richColors closeButton position="top-right" />
          </CatalogProvider>
        </CommerceProvider>
      </AuthProvider>
    </StoreProvider>
  )
}
