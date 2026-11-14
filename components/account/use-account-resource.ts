'use client'
import { useEffect, useState } from 'react'
import { api, accountData } from '@/lib/api/client'
import { accountKey, accountOwner } from '@/lib/account-cache'

export function useAccountResource<T>(
  route: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  const key = accountKey(route, query)
  const owner = accountOwner(api.getSnapshot())
  const [data, setData] = useState<T | null>(() =>
    accountData.peek<T>(route, query, true),
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!data)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setData(accountData.peek<T>(route, query, true))
    setLoading(true)
    setError('')
    void accountData
      .read<T>(route, query, revision > 0)
      .then((value) => {
        if (active && accountOwner(api.getSnapshot()) === owner) setData(value)
      })
      .catch((failure) => {
        if (active && accountOwner(api.getSnapshot()) === owner)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not load your account.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // The canonical key covers route/query identity. Private boundaries remount on owner changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, owner, revision])
  return {
    data,
    error,
    loading,
    reload: () => {
      if (accountOwner(api.getSnapshot()) !== owner) return
      accountData.invalidate(route)
      setRevision((value) => value + 1)
    },
  }
}
