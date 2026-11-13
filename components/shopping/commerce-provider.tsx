'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { api, ApiRequestError, sessionSource } from '@/lib/api/client'
import {
  GuestCartError,
  guestCartRequest,
  shoppingLock,
} from '@/lib/api/guest-cart-client'
import {
  nextQuantity,
  readCart,
  readWishlist,
  validateSelection,
  type CartQuote,
  type CartSelection,
  type Wishlist,
} from '@/lib/api/shopping'
import type { Session } from '@/lib/api/runtime'

const keyOf = (session: Session) =>
  `${session.status}:${session.epoch}:${session.user?.id || ''}`
type Pending = {
  owner: string
  guest: boolean
  action: 'set' | 'remove' | 'clear'
  selection?: CartSelection
  id?: string
}
type AddSelection = CartSelection | (() => Promise<CartSelection>)
type State = {
  owner: string
  cart: CartQuote | null
  wishlist: Wishlist | null
  guest: CartQuote | null
  loading: boolean
  cartError: string
  wishError: string
  notice: string
}
type Commerce = State & {
  authenticated: boolean
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  busy: boolean
  pending: Pending | null
  reload: () => void
  add: (selection: AddSelection) => Promise<boolean>
  setQuantity: (selection: CartSelection) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  setGuestQuantity: (selection: CartSelection) => Promise<boolean>
  removeGuest: (id: string) => Promise<boolean>
  clear: () => Promise<boolean>
  retry: () => Promise<boolean>
  discardPending: () => void
  mergeGuest: () => Promise<boolean>
  revokeGuest: () => Promise<boolean>
  save: (id: string, wanted: boolean) => Promise<boolean>
}
const Context = createContext<Commerce | null>(null)
const blank = (owner: string): State => ({
  owner,
  cart: null,
  wishlist: null,
  guest: null,
  loading: true,
  cartError: '',
  wishError: '',
  notice: '',
})
function announce() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('eshop-shopping')
    channel.postMessage({ source: sessionSource, type: 'changed' })
    channel.close()
  }
}
const errorText = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message +
      (error.retryAfterSeconds
        ? ` Try again after ${error.retryAfterSeconds} seconds.`
        : '')
    : error instanceof Error
      ? error.message
      : 'The request could not be completed.'
export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth(),
    owner = keyOf(session),
    authenticated = session.status === 'authenticated'
  const [state, setState] = useState<State>(() => blank(owner)),
    [revision, setRevision] = useState(0),
    [cartOpen, setCartOpen] = useState(false),
    [busyOwner, setBusyOwner] = useState(''),
    [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null),
    writing = useRef('')
  const generation = useRef(0)
  const view = state.owner === owner ? state : blank(owner)
  function guard(ticket: string) {
    if (!ready || keyOf(api.getSnapshot()) !== ticket)
      throw new ApiRequestError(
        499,
        'The account changed. Please retry from the current account.',
      )
  }
  function update(ticket: string, patch: Partial<State>) {
    if (keyOf(api.getSnapshot()) === ticket) {
      generation.current++
      setState((previous) => ({
        ...(previous.owner === ticket ? previous : blank(ticket)),
        loading: false,
        ...patch,
      }))
    }
  }
  function pendingWrite(value: Pending | null) {
    pendingRef.current = value
    setPending(value)
  }
  function reload() {
    setRevision((value) => value + 1)
  }
  async function readGuest(ticket: string) {
    try {
      const result = await guestCartRequest<{ guest: boolean; cart: unknown }>(
        'read',
        {},
        () => guard(ticket),
      )
      return result.guest ? readCart(result.cart) : null
    } catch (error) {
      if (error instanceof GuestCartError && error.code === 'GUEST_UNAVAILABLE')
        return null
      throw error
    }
  }
  useEffect(() => {
    if (!ready || session.status === 'checking') return
    const ticket = owner
    let active = true
    setState((previous) =>
      previous.owner === ticket
        ? { ...previous, loading: true }
        : blank(ticket),
    )
    const load = async () => {
      const version = ++generation.current
      const guestRead = readGuest(ticket)
      const results = await Promise.allSettled([
        authenticated ? api.request('/v1/cart').then(readCart) : guestRead,
        authenticated
          ? api.request('/v1/wishlist').then(readWishlist)
          : Promise.resolve(null),
        authenticated ? guestRead : Promise.resolve(null),
      ])
      if (
        !active ||
        generation.current !== version ||
        keyOf(api.getSnapshot()) !== ticket
      )
        return
      const [cart, wish, guest] = results
      setState({
        owner: ticket,
        cart: cart.status === 'fulfilled' ? cart.value : null,
        wishlist: wish.status === 'fulfilled' ? wish.value : null,
        guest: guest.status === 'fulfilled' ? guest.value : null,
        loading: false,
        cartError:
          cart.status === 'rejected'
            ? errorText(cart.reason)
            : guest.status === 'rejected'
              ? 'Guest cart could not be checked: ' + errorText(guest.reason)
              : '',
        wishError: wish.status === 'rejected' ? errorText(wish.reason) : '',
        notice: '',
      })
    }
    void load()
    const focus = () => {
      if (document.visibilityState === 'visible' && !writing.current)
        void load()
    }
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel('eshop-shopping')
    if (channel)
      channel.onmessage = (event) => {
        if (
          event.data?.type === 'changed' &&
          event.data.source !== sessionSource &&
          !writing.current
        )
          void load()
      }
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 60000)
    return () => {
      active = false
      channel?.close()
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
    // Ownership is the dependency boundary; every delayed result checks it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, ready, authenticated, revision])
  useEffect(() => {
    pendingRef.current = null
    setPending(null)
    setCartOpen(false)
  }, [owner])
  useEffect(() => {
    if (!pending || pending.owner !== owner) return
    const leaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', leaving)
    return () => window.removeEventListener('beforeunload', leaving)
  }, [pending, owner])
  async function quoteFor(ticket: string, guest: boolean) {
    return guest
      ? await readGuest(ticket)
      : readCart(await api.request('/v1/cart'))
  }
  async function execute(change: Pending) {
    guard(change.owner)
    if (change.guest) {
      const result = await guestCartRequest<{ cart: unknown }>(
        change.action,
        change.action === 'set'
          ? { ...change.selection! }
          : change.action === 'remove'
            ? { id: change.id }
            : {},
        () => guard(change.owner),
      )
      return readCart(result.cart)
    }
    return readCart(
      await api.request(
        change.action === 'set'
          ? '/v1/cart/items'
          : change.action === 'remove'
            ? '/v1/cart/items/' + change.id
            : '/v1/cart',
        {
          method: change.action === 'set' ? 'PUT' : 'DELETE',
          ...(change.action === 'set' ? { body: change.selection } : {}),
        },
      ),
    )
  }
  async function cartChange(
    action: Pending['action'],
    selection?: AddSelection,
    id?: string,
    adding = false,
    retrying = false,
    forceGuest = false,
  ) {
    const ticket = owner
    if (
      writing.current === ticket ||
      view.loading ||
      (retrying && !pendingRef.current)
    )
      return false
    if (!retrying && pendingRef.current?.owner === ticket) {
      update(ticket, {
        cartError: 'Review or retry the unconfirmed cart change first.',
      })
      setCartOpen(true)
      return false
    }
    writing.current = ticket
    setBusyOwner(ticket)
    update(ticket, { cartError: '', notice: '' })
    if (adding) setCartOpen(true)
    try {
      return await shoppingLock(async () => {
        guard(ticket)
        let change = retrying ? pendingRef.current : null
        if (!change) {
          let desired = selection
            ? validateSelection(
                typeof selection === 'function' ? await selection() : selection,
              )
            : undefined
          guard(ticket)
          if (adding && desired) {
            const quote = await quoteFor(ticket, !authenticated)
            guard(ticket)
            if (quote) desired = nextQuantity(quote, desired)
          }
          change = {
            owner: ticket,
            guest: forceGuest || !authenticated,
            action,
            selection: desired,
            id,
          }
          pendingWrite(change)
        }
        if (change.owner !== ticket)
          throw new ApiRequestError(499, 'The account changed.')
        let quote: CartQuote
        try {
          quote = await execute(change)
        } catch (error) {
          if (
            change.action !== 'remove' ||
            !(error instanceof ApiRequestError) ||
            error.status !== 404
          )
            throw error
          const current = await quoteFor(ticket, change.guest)
          if (!current || current.items.some((item) => item.id === change!.id))
            throw error
          quote = current
        }
        guard(ticket)
        pendingWrite(null)
        update(ticket, {
          ...(change.guest && authenticated
            ? { guest: quote }
            : { cart: quote }),
          cartError: '',
          notice:
            'Cart change confirmed. Prices and availability were recalculated.',
        })
        announce()
        return true
      })
    } catch (error) {
      update(ticket, {
        cartError:
          errorText(error) +
          (pendingRef.current?.owner === ticket
            ? ' Retry the same change or refresh and reconcile before discarding it.'
            : ''),
      })
      return false
    } finally {
      if (writing.current === ticket) writing.current = ''
      setBusyOwner((previous) => (previous === ticket ? '' : previous))
    }
  }
  async function guestAction(merge: boolean) {
    const ticket = owner
    if (
      (merge && !authenticated) ||
      writing.current === ticket ||
      view.loading ||
      pendingRef.current?.owner === ticket
    )
      return false
    writing.current = ticket
    setBusyOwner(ticket)
    update(ticket, { cartError: '', notice: '' })
    try {
      return await shoppingLock(async () => {
        guard(ticket)
        const result = await guestCartRequest<{ cart?: unknown }>(
          merge ? 'merge' : 'revoke',
          merge ? { customerId: session.user!.id } : {},
          () => guard(ticket),
        )
        const quote = authenticated
          ? result.cart
            ? readCart(result.cart)
            : readCart(await api.request('/v1/cart'))
          : null
        guard(ticket)
        update(ticket, {
          cart: quote,
          guest: null,
          cartError: '',
          notice: merge
            ? 'Guest items merged into this account. Repeating the same consumed capability does not double-add.'
            : 'Guest cart discarded on this browser.',
        })
        announce()
        return true
      })
    } catch (error) {
      update(ticket, {
        ...(!merge
          ? { guest: null, ...(!authenticated ? { cart: null } : {}) }
          : {}),
        cartError: errorText(error),
      })
      if (
        error instanceof GuestCartError &&
        error.code === 'CUSTOMER_SESSION_REQUIRED'
      )
        await api.signOut()
      return false
    } finally {
      if (writing.current === ticket) writing.current = ''
      setBusyOwner((previous) => (previous === ticket ? '' : previous))
    }
  }
  async function save(id: string, wanted: boolean) {
    const ticket = owner
    if (!authenticated || writing.current === ticket || view.loading)
      return false
    writing.current = ticket
    setBusyOwner(ticket)
    update(ticket, { wishError: '' })
    try {
      return await shoppingLock(async () => {
        guard(ticket)
        const result = await api.request('/v1/wishlist/' + id, {
          method: wanted ? 'PUT' : 'DELETE',
        })
        guard(ticket)
        if (wanted)
          update(ticket, { wishlist: readWishlist(result), wishError: '' })
        else {
          update(ticket, { wishlist: null })
          update(ticket, {
            wishlist: readWishlist(await api.request('/v1/wishlist')),
            wishError: '',
          })
        }
        announce()
        return true
      })
    } catch (error) {
      update(ticket, { wishError: errorText(error) })
      return false
    } finally {
      if (writing.current === ticket) writing.current = ''
      setBusyOwner((previous) => (previous === ticket ? '' : previous))
    }
  }
  return (
    <Context.Provider
      value={{
        ...view,
        authenticated,
        cartOpen,
        setCartOpen,
        busy: busyOwner === owner,
        pending: pending?.owner === owner ? pending : null,
        reload,
        add: (selection) => cartChange('set', selection, undefined, true),
        setQuantity: (selection) => cartChange('set', selection),
        remove: (id) => cartChange('remove', undefined, id),
        setGuestQuantity: (selection) =>
          cartChange('set', selection, undefined, false, false, true),
        removeGuest: (id) =>
          cartChange('remove', undefined, id, false, false, true),
        clear: () => cartChange('clear'),
        retry: () => cartChange('set', undefined, undefined, false, true),
        discardPending: () => {
          pendingWrite(null)
          update(owner, {
            cartError: '',
            notice:
              'Local pending request discarded. Review the latest quote before a new change.',
          })
          reload()
        },
        mergeGuest: () => guestAction(true),
        revokeGuest: () => guestAction(false),
        save,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useCommerce() {
  const value = useContext(Context)
  if (!value) throw new Error('CommerceProvider is missing')
  return value
}
