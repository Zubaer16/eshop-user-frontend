'use client'
import { useEffect } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { accountData } from '@/lib/api/client'

export function AccountPreload() {
  const { session, ready } = useAuth()
  useEffect(() => {
    if (!ready || session.status !== 'authenticated') return
    accountData.prefetch('/v1/account/addresses')
    accountData.prefetch('/v1/account/profile')
    accountData.prefetch('/v1/notifications/preferences')
  }, [ready, session.status, session.epoch, session.user?.id])
  return null
}
export function prefetchOrders() {
  accountData.prefetch('/v1/orders', { page: 1, limit: 20 })
}
export function prefetchOrder(id: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return
  const route = '/v1/orders/' + id.toLowerCase()
  for (const resource of [
    route,
    route + '/returns',
    route + '/replacements',
    route + '/tracking',
    '/v1/payments/orders/' + id.toLowerCase() + '/refunds',
  ])
    accountData.prefetch(resource)
}
