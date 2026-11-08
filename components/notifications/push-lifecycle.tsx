'use client'
import { useEffect } from 'react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/components/auth/auth-provider'
import { isPreviewMode } from '@/lib/integration-mode'
import {
  pauseBrowserPush,
  restoreBrowserPush,
  revokeBrowserPush,
} from '@/lib/api/browser-push'
export function PushLifecycle() {
  const { ready } = useAuth()
  useEffect(() => {
    if (isPreviewMode) return
    pauseBrowserPush()
    if (!ready) return
    const sync = () => {
      if (api.getSnapshot().status === 'anonymous')
        void revokeBrowserPush().catch(() => pauseBrowserPush())
      else restoreBrowserPush()
    }
    const stop = api.subscribe(sync)
    sync()
    window.addEventListener('focus', sync)
    return () => {
      stop()
      window.removeEventListener('focus', sync)
      pauseBrowserPush()
    }
  }, [ready])
  return null
}
