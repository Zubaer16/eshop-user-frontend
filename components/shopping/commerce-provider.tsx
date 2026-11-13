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
  readCart,
  readWishlist,
  validateSelection,
  type CartQuote,
  type CartSelection,
  type Wishlist,
} from '@/lib/api/shopping'
import {
  projectQuantities,
  type AddPreview,
  type OptimisticAddition,
  type QuantityDraft,
} from '@/lib/api/cart-preview'
import type { Session } from '@/lib/api/runtime'

const keyOf = (session: Session) =>
  `${session.status}:${session.epoch}:${session.user?.id || ''}`
type Pending = {
  owner: string
  guest: boolean
  action: 'add' | 'set' | 'remove' | 'clear'
  selection?: CartSelection
  id?: string
  requestId?: string
}
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
  add: (selection: CartSelection, preview: AddPreview) => Promise<boolean>
  optimisticAdds: OptimisticAddition[]
  setCheckoutBusy: (busy: boolean) => void
  quantitySaving: boolean
  canAdd: boolean
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
    [checkoutBusyOwner, setCheckoutBusyOwner] = useState(''),
    [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null),
    writing = useRef('')
  const [optimisticAdds, setOptimisticAdds] = useState<OptimisticAddition[]>([])
  const addQueue = useRef<OptimisticAddition[]>([])
  const activeAdd = useRef<OptimisticAddition | null>(null)
  const addTimer = useRef<number | undefined>(undefined)
  const [quantityDrafts, setQuantityDrafts] = useState<QuantityDraft[]>([])
  const quantityQueue = useRef<QuantityDraft[]>([])
  const activeQuantity = useRef<QuantityDraft | null>(null)
  const quantityTimer = useRef<number | undefined>(undefined)
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
        authenticated
          ? api.request('/v1/cart', { query: { view: 'draft' } }).then(readCart)
          : guestRead,
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
      if (
        document.visibilityState === 'visible' &&
        !writing.current &&
        !quantityQueue.current.length &&
        !addQueue.current.length
      )
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
          !writing.current &&
          !quantityQueue.current.length &&
          !addQueue.current.length
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
    setCheckoutBusyOwner('')
    window.clearTimeout(addTimer.current)
    addTimer.current = undefined
    addQueue.current = []
    activeAdd.current = null
    setOptimisticAdds([])
    window.clearTimeout(quantityTimer.current)
    quantityTimer.current = undefined
    quantityQueue.current = []
    activeQuantity.current = null
    setQuantityDrafts([])
    return () => {
      window.clearTimeout(addTimer.current)
      window.clearTimeout(quantityTimer.current)
    }
  }, [owner])
  useEffect(() => {
    if (
      (!pending || pending.owner !== owner) &&
      !optimisticAdds.some((row) => row.owner === owner) &&
      !quantityDrafts.some((row) => row.owner === owner)
    )
      return
    const leaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', leaving)
    return () => window.removeEventListener('beforeunload', leaving)
  }, [pending, owner, optimisticAdds, quantityDrafts])
  async function quoteFor(ticket: string, guest: boolean) {
    return guest
      ? await readGuest(ticket)
      : readCart(await api.request('/v1/cart', { query: { view: 'draft' } }))
  }
  async function execute(change: Pending) {
    guard(change.owner)
    if (change.guest) {
      const result = await guestCartRequest<{ cart: unknown }>(
        change.action,
        change.action === 'add'
          ? { ...change.selection!, requestId: change.requestId }
          : change.action === 'set'
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
        change.action === 'add'
          ? '/v1/cart/items/add'
          : change.action === 'set'
            ? '/v1/cart/items'
            : change.action === 'remove'
              ? '/v1/cart/items/' + change.id
              : '/v1/cart',
        {
          query: { view: 'draft' },
          method:
            change.action === 'add'
              ? 'POST'
              : change.action === 'set'
                ? 'PUT'
                : 'DELETE',
          ...(change.action === 'add'
            ? { body: { ...change.selection, requestId: change.requestId } }
            : change.action === 'set'
              ? { body: change.selection }
              : {}),
        },
      ),
    )
  }
  async function cartChange(
    action: Pending['action'],
    selection?: CartSelection,
    id?: string,
    retrying = false,
    forceGuest = false,
    addition?: OptimisticAddition,
  ) {
    const ticket = owner
    if (
      checkoutBusyOwner === ticket ||
      writing.current === ticket ||
      (action !== 'set' &&
        (activeQuantity.current || quantityQueue.current.length > 0)) ||
      (action !== 'add' &&
        (activeAdd.current || addQueue.current.length > 0)) ||
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
    try {
      return await shoppingLock(async () => {
        guard(ticket)
        let change = retrying ? pendingRef.current : null
        if (!change) {
          const desired = selection ? validateSelection(selection) : undefined
          guard(ticket)
          change = {
            owner: ticket,
            guest: forceGuest || !authenticated,
            action,
            selection: desired,
            id,
            ...(action === 'add' ? { requestId: addition!.requestId } : {}),
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
            (action === 'add' || action === 'set') &&
            error instanceof ApiRequestError &&
            [400, 401, 403, 404, 409, 422, 429].includes(error.status) &&
            pendingRef.current?.owner === ticket
          )
            pendingWrite(null)
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
          notice: '',
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
  function publishAdds() {
    const current = keyOf(api.getSnapshot())
    setOptimisticAdds(
      [
        ...(activeAdd.current ? [activeAdd.current] : []),
        ...addQueue.current,
      ].filter((row) => row.owner === current),
    )
  }
  function finishAdd(operation: OptimisticAddition, confirmed: boolean) {
    if (
      keyOf(api.getSnapshot()) !== operation.owner ||
      activeAdd.current !== operation
    )
      return
    if (confirmed) {
      activeAdd.current = null
      publishAdds()
      if (addQueue.current.length) scheduleAdds(0)
    } else if (!pendingRef.current) {
      if (addQueue.current.length)
        update(operation.owner, {
          notice:
            'Unsent additions were cancelled. Review the cart and add them again.',
        })
      activeAdd.current = null
      addQueue.current = []
      publishAdds()
    }
  }
  function scheduleAdds(delay = 180) {
    if (addTimer.current !== undefined || activeAdd.current) return
    addTimer.current = window.setTimeout(() => {
      addTimer.current = undefined
      const operation = addQueue.current.shift()
      if (!operation || operation.owner !== keyOf(api.getSnapshot())) return
      activeAdd.current = operation
      publishAdds()
      void cartChange(
        'add',
        operation.selection,
        undefined,
        false,
        false,
        operation,
      ).then((confirmed) => finishAdd(operation, confirmed))
    }, delay)
  }
  async function add(selection: CartSelection, preview: AddPreview) {
    guard(owner)
    if (
      checkoutBusyOwner === owner ||
      view.loading ||
      (writing.current && !activeAdd.current) ||
      quantityQueue.current.length > 0 ||
      activeQuantity.current ||
      (pendingRef.current && !writing.current)
    )
      return false
    const desired = validateSelection(selection)
    const additions = [
      ...(activeAdd.current ? [activeAdd.current] : []),
      ...addQueue.current,
    ]
    const current =
      view.cart?.items.find(
        (row) =>
          row.productId === desired.productId &&
          row.variantId === desired.variantId,
      )?.quantity || 0
    const queued = additions
      .filter(
        (row) =>
          row.selection.productId === desired.productId &&
          row.selection.variantId === desired.variantId,
      )
      .reduce((sum, row) => sum + row.selection.quantity, 0)
    if (current + queued + desired.quantity > 99)
      throw new Error('Cart line quantity cannot exceed 99.')
    const last = addQueue.current.at(-1)
    if (
      last &&
      last.owner === owner &&
      last.selection.productId === desired.productId &&
      last.selection.variantId === desired.variantId
    ) {
      last.selection = {
        ...last.selection,
        quantity: last.selection.quantity + desired.quantity,
      }
      last.preview = preview
    } else {
      if (additions.length >= 50)
        throw new Error('Please wait for the current cart additions to sync.')
      addQueue.current.push({
        owner,
        requestId: crypto.randomUUID(),
        selection: desired,
        preview,
      })
    }
    update(owner, { cartError: '', notice: '' })
    publishAdds()
    setCartOpen(true)
    scheduleAdds()
    return true
  }
  function publishQuantities() {
    const current = keyOf(api.getSnapshot())
    setQuantityDrafts(
      [
        ...(activeQuantity.current ? [activeQuantity.current] : []),
        ...quantityQueue.current,
      ].filter((row) => row.owner === current),
    )
  }
  function finishQuantity(operation: QuantityDraft, confirmed: boolean) {
    if (
      keyOf(api.getSnapshot()) !== operation.owner ||
      activeQuantity.current !== operation
    )
      return
    if (confirmed) {
      activeQuantity.current = null
      publishQuantities()
      if (quantityQueue.current.length) scheduleQuantities(0)
    } else if (!pendingRef.current) {
      activeQuantity.current = null
      quantityQueue.current = []
      publishQuantities()
    }
  }
  function scheduleQuantities(delay = 350) {
    if (activeQuantity.current) return
    window.clearTimeout(quantityTimer.current)
    quantityTimer.current = window.setTimeout(() => {
      quantityTimer.current = undefined
      const operation = quantityQueue.current.shift()
      if (!operation || operation.owner !== keyOf(api.getSnapshot())) return
      activeQuantity.current = operation
      publishQuantities()
      void cartChange(
        'set',
        operation.selection,
        undefined,
        false,
        operation.guest,
      ).then((confirmed) => finishQuantity(operation, confirmed))
    }, delay)
  }
  async function queueQuantity(selection: CartSelection, guest = false) {
    guard(owner)
    if (
      checkoutBusyOwner === owner ||
      view.loading ||
      activeAdd.current ||
      addQueue.current.length ||
      (writing.current && !activeQuantity.current) ||
      (pendingRef.current && !writing.current)
    )
      return false
    const desired = validateSelection(selection)
    const quote = guest ? view.guest : view.cart
    if (
      !quote?.items.some(
        (row) =>
          row.productId === desired.productId &&
          row.variantId === desired.variantId,
      )
    )
      return false
    quantityQueue.current = quantityQueue.current.filter(
      (row) =>
        row.guest !== guest ||
        row.selection.productId !== desired.productId ||
        row.selection.variantId !== desired.variantId,
    )
    quantityQueue.current.push({ owner, guest, selection: desired })
    update(owner, { cartError: '', notice: '' })
    publishQuantities()
    scheduleQuantities()
    return true
  }
  async function retryChange() {
    const operation = activeAdd.current
    const quantityOperation = activeQuantity.current
    const confirmed = await cartChange(
      pendingRef.current?.action === 'add' ? 'add' : 'set',
      undefined,
      undefined,
      true,
    )
    if (operation) finishAdd(operation, confirmed)
    if (quantityOperation) finishQuantity(quantityOperation, confirmed)
    return confirmed
  }
  async function guestAction(merge: boolean) {
    const ticket = owner
    if (
      (merge && !authenticated) ||
      activeQuantity.current ||
      quantityQueue.current.length > 0 ||
      activeAdd.current ||
      addQueue.current.length > 0 ||
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
            : readCart(
                await api.request('/v1/cart', { query: { view: 'draft' } }),
              )
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
    if (
      !authenticated ||
      writing.current === ticket ||
      view.loading ||
      activeQuantity.current ||
      quantityQueue.current.length ||
      activeAdd.current ||
      addQueue.current.length
    )
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
        cart: projectQuantities(
          view.cart,
          quantityDrafts.filter((row) => row.owner === owner && !row.guest),
        ),
        guest: projectQuantities(
          view.guest,
          quantityDrafts.filter((row) => row.owner === owner && row.guest),
        ),
        quantitySaving: quantityDrafts.some((row) => row.owner === owner),
        authenticated,
        cartOpen,
        setCartOpen,
        setCheckoutBusy: (busy) => {
          if (busy && keyOf(api.getSnapshot()) !== owner) return
          setCheckoutBusyOwner((previous) =>
            busy ? owner : previous === owner ? '' : previous,
          )
        },
        busy:
          checkoutBusyOwner === owner ||
          busyOwner === owner ||
          (optimisticAdds.some((row) => row.owner === owner) && !pending) ||
          (quantityDrafts.some((row) => row.owner === owner) && !pending),
        optimisticAdds: optimisticAdds.filter((row) => row.owner === owner),
        canAdd:
          ready &&
          checkoutBusyOwner !== owner &&
          !view.loading &&
          !quantityDrafts.some((row) => row.owner === owner) &&
          (!writing.current || Boolean(activeAdd.current)) &&
          (!pending || busyOwner === owner),
        pending: pending?.owner === owner ? pending : null,
        reload,
        add,
        setQuantity: (selection) => queueQuantity(selection),
        remove: (id) => cartChange('remove', undefined, id),
        setGuestQuantity: (selection) => queueQuantity(selection, true),
        removeGuest: (id) => cartChange('remove', undefined, id, false, true),
        clear: () => cartChange('clear'),
        retry: retryChange,
        discardPending: () => {
          window.clearTimeout(addTimer.current)
          addTimer.current = undefined
          addQueue.current = []
          activeAdd.current = null
          setOptimisticAdds([])
          window.clearTimeout(quantityTimer.current)
          quantityTimer.current = undefined
          quantityQueue.current = []
          activeQuantity.current = null
          setQuantityDrafts([])
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
