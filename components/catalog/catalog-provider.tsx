'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { publicData, readPublic } from '@/lib/api/public-data'
import { readCategories, type Category } from '@/lib/api/catalog'
const Context = createContext<{
  categories: Category[]
  loading: boolean
  error: string
  reload: () => void
}>({ categories: [], loading: true, error: '', reload: () => undefined })
export function CatalogProvider({
  children,
  initial = null,
  expiresAt = 0,
}: {
  children: React.ReactNode
  initial?: Category[] | null
  expiresAt?: number
}) {
  const [snapshot, setSnapshot] = useState<Category[] | null>(() => {
      if (initial !== null) return initial
      const cached = publicData.peek('/v1/categories')
      return cached ? readCategories(cached) : null
    }),
    [loading, setLoading] = useState(snapshot === null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  const hasData = useRef(snapshot !== null)
  useEffect(() => {
    let active = true
    if (initial !== null)
      publicData.seed('/v1/categories', {}, initial, expiresAt)
    const load = async (force = false) => {
      setLoading(!hasData.current)
      try {
        const result = readCategories(
          await readPublic('/v1/categories', {}, force),
        )
        if (active) {
          hasData.current = true
          setSnapshot(result)
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
  }, [revision, initial, expiresAt])
  return (
    <Context.Provider
      value={{
        categories: snapshot ?? [],
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
