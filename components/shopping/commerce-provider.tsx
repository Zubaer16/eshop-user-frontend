'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useAuth } from '@/components/auth/auth-provider'
import { createCommerceStore, type Commerce } from '@/lib/stores/shopping-store'

const Context = createContext<
  ReturnType<typeof createCommerceStore>['store'] | null
>(null)
export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth()
  const [commerce] = useState(createCommerceStore)
  useEffect(() => commerce.start(), [commerce])
  useEffect(() => {
    commerce.setReady(ready)
  }, [commerce, ready])
  return <Context.Provider value={commerce.store}>{children}</Context.Provider>
}
const identity = (state: Commerce) => state
export function useCommerce<T = Commerce>(
  selector: (state: Commerce) => T = identity as (state: Commerce) => T,
) {
  const store = useContext(Context)
  if (!store) throw new Error('CommerceProvider is missing')
  return useStore(store, selector)
}
