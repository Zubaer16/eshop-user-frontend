'use client'
import { createStore } from 'zustand/vanilla'
import { api } from '@/lib/api/client'
import {
  readWishlist,
  validateSelection,
  type CartQuote,
  type CartSelection,
  type Wishlist,
} from '@/lib/api/shopping'
import type { AddPreview } from '@/lib/api/cart-preview'
import {
  addLocalItem,
  cartStorageKey,
  decodeLocalCart,
  localQuote,
  checkoutItems,
} from './local-cart'

export type Commerce = {
  owner: string
  authenticated: boolean
  cart: CartQuote | null
  guestMergeError: string
  wishlist: Wishlist | null
  loading: boolean
  wishLoading: boolean
  wishError: string
  cartError: string
  notice: string
  cartOpen: boolean
  busy: boolean
  canAdd: boolean
  setCartOpen: (open: boolean) => void
  beginCheckout: () => () => void
  reload: () => void
  add: (selection: CartSelection, preview: AddPreview) => Promise<boolean>
  setQuantity: (selection: CartSelection) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  clear: () => Promise<boolean>
  retryGuestMerge: () => void
  save: (id: string, wanted: boolean) => Promise<boolean>
  rememberCheckout: (
    requestId: string,
    items: ReturnType<typeof checkoutItems>,
  ) => Promise<void>
  completeCheckout: (requestId: string) => Promise<void>
}

export function createCommerceStore() {
  let ready = false
  let started = false
  let session = api.getServerSnapshot()
  let storageKey = ''
  let checkoutLease = 0
  let wishGeneration = 0
  let wishWriting = false
  let mergingOwner: string | null = null
  let failedMergeOwner: string | null = null
  const memoryCarts = new Map<string, CartQuote>()
  const store = createStore<Commerce>(() => ({
    owner: '',
    authenticated: false,
    cart: null,
    guestMergeError: '',
    wishlist: null,
    loading: true,
    wishLoading: false,
    wishError: '',
    cartError: '',
    notice: '',
    cartOpen: false,
    busy: false,
    canAdd: false,
    setCartOpen: (open) => store.setState({ cartOpen: open }),
    beginCheckout,
    reload: () => {
      hydrate()
      void loadWishlist()
    },
    add,
    setQuantity,
    remove: (id) =>
      change((cart) => localQuote(cart.items.filter((item) => item.id !== id))),
    clear: () => change(() => localQuote([])),
    retryGuestMerge: () => {
      if (get().busy) return
      failedMergeOwner = null
      store.setState({ guestMergeError: '' })
      hydrate()
    },
    save,
    rememberCheckout,
    completeCheckout,
  }))
  const get = store.getState
  const ownerOf = () =>
    `${session.status}:${session.epoch}:${session.user?.id || ''}`
  function guard(owner = get().owner) {
    const current = api.getSnapshot()
    if (
      !started ||
      !ready ||
      current.status === 'checking' ||
      `${current.status}:${current.epoch}:${current.user?.id || ''}` !== owner
    )
      throw new Error('The account changed. Please try again.')
  }
  function read(key: string, fallback: CartQuote | null = null) {
    const memory = memoryCarts.get(key)
    if (memory) return memory
    try {
      return decodeLocalCart(window.localStorage.getItem(key))
    } catch {
      return fallback ?? localQuote([])
    }
  }
  function persist(
    key: string,
    cart: CartQuote,
    mergedGuest?: string,
    checkout?: {
      requestId: string
      items: ReturnType<typeof checkoutItems>
    } | null,
  ) {
    try {
      const previous = window.localStorage.getItem(key)
      let metadata: {
        mergedGuest?: string
        checkout?: {
          requestId: string
          items: ReturnType<typeof checkoutItems>
        }
      } = {}
      try {
        const parsed = previous ? JSON.parse(previous) : null
        if (parsed && typeof parsed === 'object') metadata = parsed
      } catch {
        /* A malformed saved cart can be replaced by a valid edit. */
      }
      const receipt = mergedGuest ?? metadata.mergedGuest
      const submitted = checkout === undefined ? metadata.checkout : checkout
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          cart,
          ...(receipt ? { mergedGuest: receipt } : {}),
          ...(submitted ? { checkout: submitted } : {}),
        }),
      )
      memoryCarts.delete(key)
      store.setState({ notice: '' })
      return true
    } catch {
      store.setState({
        notice:
          'Browser storage is unavailable. Keep this tab open to retain your cart.',
      })
      return false
    }
  }
  function guestAlreadyAssigned(raw: string | null) {
    try {
      return Boolean(raw && JSON.parse(raw)?.mergedTo)
    } catch {
      return false
    }
  }
  function hydrate() {
    if (!started || !ready || session.status === 'checking') return
    const owner = get().owner
    // A successfully imported guest snapshot may remain if the browser rejected
    // its deletion. Do not show those claimed items after logout.
    const hiddenGuest =
      session.status === 'anonymous' &&
      guestAlreadyAssigned((() => {
        try {
          return window.localStorage.getItem(storageKey)
        } catch {
          return null
        }
      })())
    const cart = hiddenGuest ? localQuote([]) : read(storageKey, get().cart)
    // Guest items are an internal storage detail, never a separate visible cart.
    const hasGuest =
      session.status === 'authenticated' &&
      read(cartStorageKey()).items.length > 0
    if (!hasGuest && get().guestMergeError) {
      failedMergeOwner = null
      store.setState({ guestMergeError: '' })
    }
    const startMerge =
      hasGuest &&
      mergingOwner !== owner &&
      failedMergeOwner !== owner &&
      !get().busy
    if (startMerge) mergingOwner = owner
    const merging = mergingOwner === owner
    store.setState({
      cart,
      loading: merging,
      canAdd: !get().busy && !merging,
    })
    if (startMerge) void mergeGuestIntoAccount(owner)
  }
  // Local writes share a browser lock across tabs. No network request is involved.
  async function change(update: (cart: CartQuote) => CartQuote) {
    const owner = get().owner
    try {
      guard(owner)
      if (get().busy || mergingOwner === owner) return false
      const run = () => {
        guard(owner)
        if (get().busy || mergingOwner === owner) return false
        const raw = (() => {
          try {
            return window.localStorage.getItem(storageKey)
          } catch {
            return null
          }
        })()
        const cart = update(
          session.status === 'anonymous' && guestAlreadyAssigned(raw)
            ? localQuote([])
            : raw === null
              ? (get().cart ?? localQuote([]))
              : read(storageKey, get().cart),
        )
        if (!persist(storageKey, cart)) memoryCarts.set(storageKey, cart)
        store.setState({ cart, cartError: '' })
        return true
      }
      return await (navigator.locks
        ? navigator.locks.request('eshop-local-cart', run)
        : run())
    } catch (error) {
      if (get().owner === owner)
        store.setState({
          cartError:
            error instanceof Error
              ? error.message
              : 'Could not update your browser cart.',
        })
      return false
    }
  }
  async function add(selection: CartSelection, preview: AddPreview) {
    guard()
    store.setState({ cartOpen: true })
    return change((cart) =>
      addLocalItem(cart, selection, preview, crypto.randomUUID()),
    )
  }
  async function setQuantity(selection: CartSelection) {
    const desired = validateSelection(selection)
    return change((cart) =>
      localQuote(
        cart.items.map((item) =>
          item.productId === desired.productId &&
          item.variantId === desired.variantId
            ? {
                ...item,
                quantity: desired.quantity,
                lineTotalMinor: item.unitPriceMinor * desired.quantity,
              }
            : item,
        ),
      ),
    )
  }
  async function mergeGuestIntoAccount(owner: string) {
    const guestKey = cartStorageKey()
    const userId = session.user?.id
    try {
      if (!userId) return
      const run = () => {
        guard(owner)
        const guest = read(guestKey)
        if (!guest.items.length) return
        const savedGuest = window.localStorage.getItem(guestKey)
        const guestMetadata = savedGuest ? JSON.parse(savedGuest) : null
        // If a previous login persisted this guest cart but couldn't delete it,
        // never import that account's items into a different account.
        if (guestMetadata?.mergedTo && guestMetadata.mergedTo !== userId) {
          window.localStorage.removeItem(guestKey)
          memoryCarts.delete(guestKey)
          return
        }
        const signature = JSON.stringify(
          guest.items.map(({ id, productId, variantId, quantity }) => ({
            id,
            productId,
            variantId,
            quantity,
          })),
        )
        const saved = window.localStorage.getItem(storageKey)
        const alreadyMerged =
          saved && JSON.parse(saved).mergedGuest === signature
        let cart = read(storageKey, get().cart)
        if (!alreadyMerged) {
          for (const item of guest.items)
            cart = addLocalItem(
              cart,
              item,
              {
                title: item.title,
                sku: item.sku,
                currency: item.currency,
                unitPriceMinor: item.unitPriceMinor,
                image: item.image ?? null,
              },
              item.id,
            )
          if (!persist(storageKey, cart, signature))
            throw new Error('Could not save your items after sign-in.')
        }
        // Account cart was persisted first. A claim marker prevents a leftover
        // guest snapshot from being merged into another user if clearing fails.
        if (guestMetadata) {
          try {
            window.localStorage.setItem(
              guestKey,
              JSON.stringify({ ...guestMetadata, mergedTo: userId }),
            )
          } catch {
            // Still attempt removal if the marker could not be written.
          }
        }
        try {
          window.localStorage.removeItem(guestKey)
        } catch {
          throw new Error(
            'Your items were added, but old guest storage could not be cleared. Please retry before switching accounts.',
          )
        }
        memoryCarts.delete(guestKey)
        store.setState({ cart, cartError: '', guestMergeError: '' })
      }
      if (navigator.locks)
        await navigator.locks.request('eshop-local-cart', run)
      else run()
    } catch (error) {
      if (get().owner === owner) {
        failedMergeOwner = owner
        store.setState({
          guestMergeError:
            (error instanceof Error ? error.message : 'Could not combine your items.') +
            ' Your previous items remain saved in this browser.',
        })
      }
    } finally {
      if (mergingOwner === owner) mergingOwner = null
      if (get().owner === owner) hydrate()
    }
  }
  async function rememberCheckout(
    requestId: string,
    items: ReturnType<typeof checkoutItems>,
  ) {
    const owner = get().owner
    const run = () => {
      guard(owner)
      const cart = read(storageKey, get().cart)
      persist(storageKey, cart, undefined, { requestId, items })
    }
    if (navigator.locks) await navigator.locks.request('eshop-local-cart', run)
    else run()
  }
  async function completeCheckout(requestId: string) {
    const owner = get().owner
    const run = () => {
      guard(owner)
      try {
        const raw = window.localStorage.getItem(storageKey)
        const receipt = raw ? JSON.parse(raw).checkout : null
        if (receipt?.requestId !== requestId) return
        const cart = read(storageKey, get().cart)
        const matching =
          JSON.stringify(receipt.items) === JSON.stringify(checkoutItems(cart))
        const next = matching ? localQuote([]) : cart
        if (!persist(storageKey, next, undefined, null))
          memoryCarts.set(storageKey, next)
        store.setState({ cart: next })
      } catch {
        store.setState({
          notice:
            'Payment is confirmed. Review your browser cart before another purchase.',
        })
      }
    }
    if (navigator.locks) await navigator.locks.request('eshop-local-cart', run)
    else run()
  }
  function beginCheckout() {
    const owner = get().owner
    guard(owner)
    const lease = ++checkoutLease
    store.setState({ busy: true, canAdd: false })
    return () => {
      if (get().owner !== owner || lease !== checkoutLease) return
      store.setState({ busy: false, canAdd: true })
      hydrate()
    }
  }
  async function loadWishlist() {
    const owner = get().owner
    const generation = ++wishGeneration
    if (!get().authenticated || !ready) return
    store.setState({ wishLoading: true })
    try {
      const wishlist = readWishlist(await api.request('/v1/wishlist'))
      if (owner === get().owner && generation === wishGeneration)
        store.setState({ wishlist, wishError: '' })
    } catch (error) {
      if (owner === get().owner && generation === wishGeneration)
        store.setState({
          wishError:
            error instanceof Error
              ? error.message
              : 'Could not load saved items.',
        })
    } finally {
      if (owner === get().owner && generation === wishGeneration)
        store.setState({ wishLoading: false })
    }
  }
  async function save(id: string, wanted: boolean) {
    const owner = get().owner
    guard(owner)
    if (!get().authenticated || wishWriting) return false
    wishWriting = true
    try {
      await api.request('/v1/wishlist/' + id, {
        method: wanted ? 'PUT' : 'DELETE',
      })
      guard(owner)
      await loadWishlist()
      return true
    } catch (error) {
      if (owner === get().owner)
        store.setState({
          wishError:
            error instanceof Error
              ? error.message
              : 'Could not save this product.',
        })
      return false
    } finally {
      if (owner === get().owner) wishWriting = false
    }
  }
  function syncSession() {
    session = api.getSnapshot()
    const owner = ownerOf()
    if (owner !== get().owner) {
      checkoutLease++
      wishGeneration++
      wishWriting = false
      storageKey = cartStorageKey(
        session.status === 'authenticated' ? session.user!.id : undefined,
      )
      store.setState({
        owner,
        authenticated: session.status === 'authenticated',
        cart: null,
        guestMergeError: '',
        wishlist: null,
        wishError: '',
        cartError: '',
        loading: true,
        wishLoading: false,
        busy: false,
        canAdd: false,
        cartOpen: false,
      })
      hydrate()
      if (started && ready) void loadWishlist()
    }
  }
  function setReady(value: boolean) {
    const becameReady = value && !ready
    ready = value
    syncSession()
    hydrate()
    if (becameReady && started) void loadWishlist()
  }
  function start() {
    started = true
    syncSession()
    hydrate()
    if (ready) void loadWishlist()
    const unsubscribe = api.subscribe(syncSession)
    const storage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        (event.key === null ||
          event.key === storageKey ||
          event.key === cartStorageKey())
      ) {
        if (event.key) memoryCarts.delete(event.key)
        else memoryCarts.clear()
        hydrate()
      }
    }
    window.addEventListener('storage', storage)
    return () => {
      started = false
      wishGeneration++
      checkoutLease++
      unsubscribe()
      window.removeEventListener('storage', storage)
    }
  }
  return { store, start, setReady }
}
