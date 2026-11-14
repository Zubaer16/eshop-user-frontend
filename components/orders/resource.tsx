'use client'
import { useEffect, useRef, useState } from 'react'
import { api, accountData } from '@/lib/api/client'
import {
  isOrderId,
  readOrderDetail,
  type OrderDetail,
  type ReturnRow,
  type ReplacementRow,
  type RefundRow,
  type Tracking,
} from '@/lib/api/orders'
type Bundle = {
  order: OrderDetail
  returns: ReturnRow[]
  replacements: ReplacementRow[]
  refunds: RefundRow[]
  tracking: Tracking
}
function checkedBundle(bundle: Bundle, id: string) {
  readOrderDetail(bundle.order)
  if (
    !Array.isArray(bundle.returns) ||
    !Array.isArray(bundle.replacements) ||
    !Array.isArray(bundle.refunds) ||
    bundle.tracking.orderId !== id
  )
    throw new Error('Invalid order ledger response.')
  return bundle
}
function cachedBundle(id: string): Bundle | null {
  const route = '/v1/orders/' + id
  const bundle = {
    order: accountData.peek<OrderDetail>(route, {}, true),
    returns: accountData.peek<ReturnRow[]>(route + '/returns', {}, true),
    replacements: accountData.peek<ReplacementRow[]>(
      route + '/replacements',
      {},
      true,
    ),
    tracking: accountData.peek<Tracking>(route + '/tracking', {}, true),
    refunds: accountData.peek<RefundRow[]>(
      '/v1/payments/orders/' + id + '/refunds',
      {},
      true,
    ),
  }
  if (
    !bundle.order ||
    !bundle.returns ||
    !bundle.replacements ||
    !bundle.tracking ||
    !bundle.refunds
  )
    return null
  try {
    return checkedBundle(bundle as Bundle, id)
  } catch {
    return null
  }
}
type Pending = { route: string; body?: Record<string, unknown> }
export function useOrderResource(
  inputId: string,
  admin = false,
  owner = false,
) {
  const id = inputId.toLowerCase()
  const [data, setData] = useState<Bundle | null>(() =>
      admin ? null : cachedBundle(id),
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [pending, setPending] = useState<Pending | null>(null)
  const active = useRef(true),
    generation = useRef(0),
    writing = useRef(false),
    uncertain = useRef<Pending | null>(null),
    identity = useRef(api.getSnapshot())
  const route = (admin ? '/v1/admin/orders/' : '/v1/orders/') + id
  function guard() {
    const current = api.getSnapshot()
    if (
      !active.current ||
      current.epoch !== identity.current.epoch ||
      current.user?.id !== identity.current.user?.id ||
      current.status !== 'authenticated'
    )
      throw new Error('The account changed. Reopen the order.')
  }
  async function load(force = false) {
    guard()
    if (!isOrderId(id)) throw new Error('Enter a canonical order UUID.')
    const ticket = ++generation.current
    const read = <T,>(resource: string) =>
      admin
        ? api.request<T>(resource)
        : accountData.read<T>(resource, {}, force)
    const [order, returns, replacements, tracking, refunds] = await Promise.all(
      [
        read<OrderDetail>(route),
        read<ReturnRow[]>(route + '/returns'),
        read<ReplacementRow[]>(route + '/replacements'),
        read<Tracking>(route + '/tracking'),
        !admin || owner
          ? read<RefundRow[]>(
              (admin ? '/v1/admin/payments/orders/' : '/v1/payments/orders/') +
                id +
                '/refunds',
            )
          : Promise.resolve([] as RefundRow[]),
      ],
    )
    guard()
    if (ticket !== generation.current) return
    setData(
      checkedBundle({ order, returns, replacements, tracking, refunds }, id),
    )
    setError('')
  }
  useEffect(() => {
    active.current = true
    void load().catch((e) => {
      if (active.current)
        setError(e instanceof Error ? e.message : 'Could not load order.')
    })
    return () => {
      active.current = false
    }
    // Parent keys the resource by order and authenticated owner/epoch/grants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!pending) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])
  async function perform(work: () => Promise<void>) {
    if (writing.current) return
    writing.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const locked = async () => {
        guard()
        await work()
        guard()
      }
      if (typeof navigator !== 'undefined' && navigator.locks)
        await navigator.locks.request('eshop-order-write', locked)
      else await locked()
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : 'Request not confirmed.')
    } finally {
      writing.current = false
      if (active.current) setBusy(false)
    }
  }
  async function execute(value: Pending) {
    guard()
    await api.request(value.route, {
      method: 'POST',
      ...(value.body ? { body: value.body } : {}),
    })
    guard()
    uncertain.current = null
    setPending(null)
    setNotice(
      'Action acknowledged by the server. Read the current state below.',
    )
    await load(true)
  }
  function act(target: string, body?: Record<string, unknown>) {
    return perform(async () => {
      if (uncertain.current)
        throw new Error('Reconcile or retry the unconfirmed action first.')
      const value = {
        route: target,
        ...(body ? { body: structuredClone(body) } : {}),
      }
      uncertain.current = value
      setPending(value)
      generation.current++
      await execute(value)
    })
  }
  return {
    data,
    error,
    busy,
    notice,
    pending,
    route,
    act,
    refresh: () => perform(() => load(true)),
    retry: () =>
      perform(async () => {
        if (uncertain.current) await execute(uncertain.current)
      }),
    reconcile: () =>
      perform(async () => {
        await load(true)
        guard()
        if (
          window.confirm(
            'Inspect the refreshed ledgers. Discard only the local unconfirmed action? A later retry must be a deliberate new action.',
          )
        ) {
          uncertain.current = null
          setPending(null)
          setNotice(
            'Local request discarded after reading server state. No server action was undone.',
          )
        }
      }),
  }
}
