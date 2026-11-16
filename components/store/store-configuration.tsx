'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { publicData, readPublic } from '@/lib/api/public-data'
import type { Asset } from './store-content'

export type Bootstrap = {
  profile: {
    configured: boolean
    storeName: string | null
    supportEmail: string | null
    supportNotice: string
    websiteUrl: string
  }
  content: {
    seoTitle: string
    seoDescription: string
    footerText: string
    privacyPolicy: string
    termsOfService: string
    returnPolicy: string
  }
  branding: { logo: Asset | null; favicon: Asset | null }
}
export type Operations = {
  configured: boolean
  locale: string
  displayCurrency: string
  themeMode: string
  accentColor: string
  showWishlist: boolean
  showPolicies: boolean
}
const Context = createContext<{
  data: Bootstrap | null
  operations: Operations | null
  error: string
}>({ data: null, operations: null, error: '' })
export function StoreProvider({
  children,
  initialBootstrap = null,
  initialOperations = null,
  expiresAt = 0,
}: {
  children: React.ReactNode
  initialBootstrap?: Bootstrap | null
  initialOperations?: Operations | null
  expiresAt?: number
}) {
  const [data, setData] = useState<Bootstrap | null>(
      () => initialBootstrap ?? publicData.peek('/v1/store/bootstrap'),
    ),
    [operations, setOperations] = useState<Operations | null>(
      () => initialOperations ?? publicData.peek('/v1/store/operations'),
    ),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (initialBootstrap)
      publicData.seed('/v1/store/bootstrap', {}, initialBootstrap, expiresAt)
    if (initialOperations)
      publicData.seed('/v1/store/operations', {}, initialOperations, expiresAt)
    async function load() {
      const results = await Promise.allSettled([
        readPublic<Bootstrap>('/v1/store/bootstrap'),
        readPublic<Operations>('/v1/store/operations'),
      ])
      if (!active) return
      const [b, o] = results
      if (b.status === 'fulfilled') {
        setData(b.value)
        setError('')
      } else {
        setError('Store information is temporarily unavailable.')
      }
      if (o.status === 'fulfilled') {
        setOperations(o.value)
        const value = o.value
        const root = document.documentElement
        if (value.configured && /^#[a-f0-9]{6}$/i.test(value.accentColor)) {
          root.style.setProperty('--primary', value.accentColor)
          root.style.setProperty(
            '--primary-hover',
            `color-mix(in srgb, ${value.accentColor}, black 15%)`,
          )
          root.style.setProperty('--ring', value.accentColor)
        } else {
          for (const token of ['--primary', '--primary-hover', '--ring'])
            root.style.removeProperty(token)
        }
        if (
          value.configured &&
          /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/.test(value.locale)
        )
          root.dataset.storeLocale = value.locale
        else delete root.dataset.storeLocale
        if (value.configured) root.dataset.storeTheme = value.themeMode
        else delete root.dataset.storeTheme
      }
    }
    void load()
    window.addEventListener('focus', load)
    const timer = setInterval(() => void load(), 60000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [initialBootstrap, initialOperations, expiresAt])
  return (
    <Context.Provider value={{ data, operations, error }}>
      {children}
    </Context.Provider>
  )
}
export const useStoreConfiguration = () => useContext(Context)
