'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { publicData, readPublic } from '@/lib/api/public-data'
import { readCategories, type Category } from '@/lib/api/catalog'
const Context = createContext<{
  categories: Category[]
  loading: boolean
  error: string
  reload: () => void
}>({ categories: [], loading: true, error: '', reload: () => undefined })
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(() => {
      const cached = publicData.peek('/v1/categories')
      return cached ? readCategories(cached) : []
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const load = async (force = false) => {
      try {
        const result = readCategories(
          await readPublic('/v1/categories', {}, force),
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
    void load(revision > 0)
    const focus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 60000)
    return () => {
      active = false
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
