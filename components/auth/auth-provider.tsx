'use client'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api, authChannelName, sessionSource } from '@/lib/api/client'
import { isPreviewMode } from '@/lib/integration-mode'
import type { Session } from '@/lib/api/runtime'
const Context = createContext<{ session: Session; ready: boolean } | null>(null)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    api.subscribe,
    api.getSnapshot,
    api.getServerSnapshot,
  )
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    if (isPreviewMode) {
      setReady(true)
      return
    }
    void api.restoreSession().finally(() => {
      if (active) setReady(true)
    })
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(authChannelName)
    if (channel)
      channel.onmessage = (event) => {
        if (
          event.data?.source === sessionSource ||
          !['login', 'logout'].includes(event.data?.type)
        )
          return
        api.clearLocalSession()
        if (event.data.type === 'login')
          void api.restoreSession().then(() => api.restoreSession())
      }
    const check = () => {
      if (
        document.visibilityState === 'visible' &&
        api.getSnapshot().status === 'authenticated'
      )
        void api.refreshIdentity().catch(() => undefined)
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, 60000)
    return () => {
      active = false
      channel?.close()
      clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return (
    <Context.Provider value={{ session, ready }}>{children}</Context.Provider>
  )
}
export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth(),
    pathname = usePathname(),
    router = useRouter()
  useEffect(() => {
    if (!isPreviewMode && ready && session.status === 'anonymous')
      router.replace('/sign-in?next=' + encodeURIComponent(pathname))
  }, [ready, session.status, pathname, router])
  if (isPreviewMode) return children
  if (!ready || session.status !== 'authenticated')
    return (
      <p role="status" className="p-8 text-sm text-slate-600">
        {session.status === 'checking'
          ? 'Checking your session…'
          : 'Please sign in to continue.'}
      </p>
    )
  return (
    <div
      key={
        session.epoch +
        ':' +
        session.user?.id +
        ':' +
        session.user?.permissions.join(',')
      }
    >
      {children}
    </div>
  )
}
