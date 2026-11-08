'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '@/lib/api/client'
import {
  addressPayload,
  type Address,
  type AddressInput,
  type Profile,
} from '@/lib/api/shopping'
import { actionClass, inputClass, ErrorMessage } from './cart'
function useAccountResource<T>(route: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setData(null)
    setError('')
    api
      .request<T>(route, { signal: controller.signal })
      .then((data) => {
        if (active) setData(data)
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load your account.',
          )
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [route, revision])
  return { data, error, reload: () => setRevision((value) => value + 1) }
}
function AccountNav() {
  return (
    <nav
      aria-label="Your account navigation"
      className="my-6 flex flex-wrap gap-5 text-sm font-bold text-primary"
    >
      <Link href="/account">Account overview</Link>
      <Link href="/account/addresses">Saved addresses</Link>
      <Link href="/account/settings">Security settings</Link>
      <Link href="/wishlist">Saved items</Link>
      <Link href="/cart">Your cart</Link>
      <Link href="/account/orders">Your orders</Link>
      <Link href="/account/notifications">
        Inbox and notification preferences
      </Link>
      <button
        onClick={() => {
          void api.signOut()
        }}
      >
        Sign out
      </button>
    </nav>
  )
}
export function AccountHome() {
  const resource = useAccountResource<Profile>('/v1/account/profile')
  const [notice, setNotice] = useState('')
  return (
    <section className="container-shell max-w-4xl py-10">
      <h1 className="text-3xl font-black">Your account</h1>
      <AccountNav />
      {notice && (
        <p role="status" className="my-4 text-sm text-primary">
          {notice}
        </p>
      )}
      <ErrorMessage text={resource.error} />
      {resource.error && (
        <button className={actionClass} onClick={resource.reload}>
          Retry account
        </button>
      )}
      {resource.data ? (
        <ProfileForm
          key={resource.data.id + resource.data.displayName}
          profile={resource.data}
          saved={() => {
            setNotice('Display name saved.')
            resource.reload()
          }}
        />
      ) : (
        !resource.error && <p role="status">Loading your profile…</p>
      )}
    </section>
  )
}
function ProfileForm({
  profile,
  saved,
}: {
  profile: Profile
  saved: () => void
}) {
  const [name, setName] = useState(profile.displayName),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await api.request<Profile>('/v1/account/profile', {
        method: 'PATCH',
        body: { displayName: name.trim() },
      })
      setName(updated.displayName)
      saved()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save your profile.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm text-muted">Account email</p>
      <p className="mt-2 break-all font-bold">{profile.email}</p>
      <p className="mt-2 text-sm text-muted">
        Email {profile.emailVerified ? 'verified' : 'not yet verified'} ·
        Customer account
      </p>
      <p className="mt-2 text-xs text-muted">Joined {profile.createdAt}</p>
      <form onSubmit={submit} className="mt-7 max-w-lg space-y-4">
        <label className="block text-sm font-bold">
          Display name
          <input
            className={inputClass}
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            autoComplete="name"
          />
        </label>
        <p className="text-xs text-muted">
          Email and credentials are managed through the separate
          verification/security flows.
        </p>
        <ErrorMessage text={error} />
        <button
          className={actionClass}
          type="submit"
          disabled={busy || !name.trim()}
        >
          {busy ? 'Saving…' : 'Save display name'}
        </button>
      </form>
    </div>
  )
}
export function LiveAddresses() {
  const resource = useAccountResource<{ items: Address[]; count: number }>(
    '/v1/account/addresses',
  )
  const [editing, setEditing] = useState<Address | null | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  async function change(address: Address, remove: boolean) {
    if (
      remove &&
      !window.confirm(
        'Delete this saved address? Existing orders are unchanged.',
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      await api.request('/v1/account/addresses/' + address.id, {
        method: remove ? 'DELETE' : 'PATCH',
        ...(!remove ? { body: { isDefault: true } } : {}),
      })
      setNotice(
        remove
          ? 'Address deleted. The server selected a replacement default if needed.'
          : 'Default address updated.',
      )
      resource.reload()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The address could not be changed.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="container-shell max-w-4xl py-10">
      <h1 className="text-3xl font-black">Saved addresses</h1>
      <AccountNav />
      <p className="mb-5 text-sm text-muted">
        Private to your account. Saving a country does not guarantee an enabled
        shipping lane.
      </p>
      <ErrorMessage text={error || resource.error} />
      {notice && (
        <p role="status" className="my-4 text-sm text-primary">
          {notice}
        </p>
      )}
      <div className="mb-6 flex gap-4">
        <button
          className={actionClass}
          disabled={busy || !resource.data || resource.data.count >= 10}
          onClick={() => {
            setEditing(null)
            setError('')
          }}
        >
          Add address
        </button>
        <button
          className="text-sm font-bold text-primary"
          disabled={busy}
          onClick={resource.reload}
        >
          Refresh addresses
        </button>
      </div>
      {editing !== undefined && (
        <AddressForm
          key={editing?.id || 'new'}
          initial={editing}
          cancel={() => setEditing(undefined)}
          saved={() => {
            setEditing(undefined)
            resource.reload()
            setNotice('Address saved.')
          }}
        />
      )}
      {!resource.data ? (
        !resource.error && <p role="status">Loading your addresses…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {resource.data.items.map((address) => (
            <article
              key={address.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h2 className="font-bold">
                {address.label || 'Saved address'}
                {address.isDefault ? ' · Default' : ''}
              </h2>
              <p className="text-sm">
                {address.recipientName}
                <br />
                {address.addressLine1}
                {address.addressLine2 && (
                  <>
                    <br />
                    {address.addressLine2}
                  </>
                )}
                <br />
                {[address.city, address.region, address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
                <br />
                {address.countryCode}
              </p>
              <p className="text-sm text-muted">{address.phone}</p>
              <div className="flex flex-wrap gap-4 text-sm font-bold">
                <button
                  disabled={busy}
                  className="text-primary"
                  onClick={() => setEditing(address)}
                >
                  Edit address
                </button>
                {!address.isDefault && (
                  <button
                    disabled={busy}
                    className="text-primary"
                    onClick={() => void change(address, false)}
                  >
                    Make default
                  </button>
                )}
                <button
                  disabled={busy}
                  className="text-red-700"
                  onClick={() => void change(address, true)}
                >
                  Delete address
                </button>
              </div>
            </article>
          ))}
          {!resource.data.count && (
            <p className="py-7 text-sm text-muted">No saved addresses yet.</p>
          )}
        </div>
      )}
    </section>
  )
}
const initialAddress: AddressInput = {
  label: 'Home',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  countryCode: '',
  isDefault: false,
}
function AddressForm({
  initial,
  cancel,
  saved,
}: {
  initial: Address | null
  cancel: () => void
  saved: () => void
}) {
  const [value, setValue] = useState<AddressInput>(initial || initialAddress),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.request(
        '/v1/account/addresses' + (initial ? '/' + initial.id : ''),
        {
          method: initial ? 'PATCH' : 'POST',
          body: addressPayload(value, !initial),
        },
      )
      saved()
    } catch (error) {
      setError(
        (error instanceof Error ? error.message : 'Could not save address.') +
          ' Review the address list before repeating an uncertain create.',
      )
    } finally {
      setBusy(false)
    }
  }
  const fields: {
    key: Exclude<keyof AddressInput, 'isDefault'>
    label: string
    max: number
    required?: boolean
    autocomplete?: string
  }[] = [
    { key: 'label', label: 'Address label', max: 40, required: true },
    {
      key: 'recipientName',
      label: 'Recipient name',
      max: 120,
      required: true,
      autocomplete: 'name',
    },
    {
      key: 'phone',
      label: 'Phone (E.164)',
      max: 16,
      required: true,
      autocomplete: 'tel',
    },
    {
      key: 'addressLine1',
      label: 'Street address',
      max: 200,
      required: true,
      autocomplete: 'address-line1',
    },
    {
      key: 'addressLine2',
      label: 'Apartment / address line 2',
      max: 200,
      autocomplete: 'address-line2',
    },
    {
      key: 'city',
      label: 'City',
      max: 100,
      required: true,
      autocomplete: 'address-level2',
    },
    {
      key: 'region',
      label: 'Region / state',
      max: 100,
      autocomplete: 'address-level1',
    },
    {
      key: 'postalCode',
      label: 'Postal code',
      max: 20,
      autocomplete: 'postal-code',
    },
    {
      key: 'countryCode',
      label: 'Country code (ISO)',
      max: 2,
      required: true,
      autocomplete: 'country',
    },
  ]
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-blue-200 bg-white p-5"
    >
      <h2 className="mb-5 text-lg font-black">
        {initial ? 'Edit saved address' : 'New saved address'}
      </h2>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="block text-sm font-bold">
            {field.label}
            <input
              className={inputClass}
              required={field.required}
              maxLength={field.max}
              autoComplete={field.autocomplete}
              type={field.key === 'phone' ? 'tel' : 'text'}
              placeholder={
                field.key === 'phone'
                  ? '+12025550123'
                  : field.key === 'countryCode'
                    ? 'US'
                    : undefined
              }
              pattern={
                field.key === 'phone'
                  ? '[+][1-9][0-9]{6,14}'
                  : field.key === 'countryCode'
                    ? '[A-Z]{2}'
                    : undefined
              }
              value={value[field.key]}
              onChange={(event) =>
                setValue((previous) => ({
                  ...previous,
                  [field.key]:
                    field.key === 'countryCode'
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                }))
              }
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={value.isDefault}
            disabled={Boolean(initial?.isDefault)}
            onChange={(event) =>
              setValue((previous) => ({
                ...previous,
                isDefault: event.target.checked,
              }))
            }
          />
          Default address
        </label>
        <div className="sm:col-span-2">
          <ErrorMessage text={error} />
          <div className="flex gap-4">
            <button type="submit" className={actionClass}>
              {busy ? 'Saving…' : 'Save address'}
            </button>
            <button
              type="button"
              className="text-sm font-bold text-primary"
              onClick={cancel}
            >
              Cancel address editor
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  )
}
