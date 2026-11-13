'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api/client'
import { readCategories, type Category } from '@/lib/api/catalog'
const Context = createContext<{
  categories: Category[]
  loading: boolean
  error: string
  reload: () => void
}>({ categories: [], loading: true, error: '', reload: () => undefined })
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const load = async () => {
      try {
        const result = readCategories(
          await api.request('/v1/categories', {
            auth: false,
            signal: controller.signal,
          }),
        )
        if (active) {
          setCategories(result)
          setError('')
        }
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : 'Categories are unavailable.',
          )
      } finally {
        if (active) setLoading(false)
      }
    }
    setLoading(true)
    void load()
    const focus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 60000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
  }, [revision])
  return (
    <Context.Provider
      value={{
        categories,
        loading,
        error,
        reload: () => setRevision((value) => value + 1),
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useCatalog() {
  return useContext(Context)
}
