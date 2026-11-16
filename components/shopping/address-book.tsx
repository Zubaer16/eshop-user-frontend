'use client'
import { useState, type FormEvent } from 'react'
import { api } from '@/lib/api/client'
import { useAccountResource } from '@/components/account/use-account-resource'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { PendingButton, PendingIndicator } from '@/components/ui/pending-button'
import {
  addressPayload,
  type Address,
  type AddressInput,
} from '@/lib/api/shopping'
import { actionClass, inputClass, ErrorMessage } from './cart'
import {
  Briefcase,
  CheckCircle2,
  Home,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  X,
} from 'lucide-react'

export function Addresses() {
  const resource = useAccountResource<{ items: Address[]; count?: number }>(
    '/v1/account/addresses',
  )
  const [editing, setEditing] = useState<Address | null | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')

  const addresses = resource.data?.items ?? []
  const orderedAddresses = [...addresses].sort(
    (left, right) => Number(right.isDefault) - Number(left.isDefault),
  )
  const addressCount = resource.data?.count ?? addresses.length
  const defaultCount = addresses.filter((address) => address.isDefault).length
  const atLimit = addressCount >= 10

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
    setNotice('')
    try {
      await api.request('/v1/account/addresses/' + address.id, {
        method: remove ? 'DELETE' : 'PATCH',
        ...(!remove ? { body: { isDefault: true } } : {}),
      })
      setNotice(
        remove
          ? 'Address deleted. The server selected a replacement default if needed.'
          : 'Default delivery address updated.',
      )
      resource.reload()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The address could not be changed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="saved-addresses-title"
      className="container-shell w-full py-8 sm:py-10"
    >
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-primary">
            <MapPin size={15} aria-hidden="true" />
            Address book
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              id="saved-addresses-title"
              className="text-3xl font-black tracking-tight sm:text-4xl"
            >
              Saved addresses
            </h1>
            {resource.data && resource.loading && (
              <PendingIndicator label="Updating saved addresses" />
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Manage the delivery addresses saved to your account.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`${actionClass} gap-2`}
            disabled={
              busy || !resource.data || atLimit || editing !== undefined
            }
            onClick={() => {
              setError('')
              setNotice('')
              setEditing(null)
            }}
          >
            <Plus size={17} aria-hidden="true" />
            Add address
          </button>
          <PendingButton
            busy={resource.loading}
            pendingLabel="Refreshing…"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-primary transition hover:border-primary/30 hover:bg-blue-50 disabled:opacity-50"
            disabled={busy}
            onClick={resource.reload}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </PendingButton>
        </div>
      </div>

      <ErrorMessage text={error || resource.error} />

      {resource.error && (
        <button
          type="button"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-blue-50"
          onClick={resource.reload}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Retry loading addresses
        </button>
      )}

      {notice && (
        <p
          role="status"
          className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {notice}
        </p>
      )}

      {editing !== undefined && (
        <AddressForm
          key={editing?.id || 'new'}
          initial={editing}
          cancel={() => {
            setEditing(undefined)
            setError('')
          }}
          saved={() => {
            setEditing(undefined)
            resource.reload()
            setNotice('Address saved successfully.')
            setError('')
          }}
        />
      )}

      {!resource.data ? (
        !resource.error && (
          <ContentSkeleton variant="list" label="Loading your addresses" />
        )
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-sm font-extrabold text-[#17233d]">
                Your delivery addresses
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Keep up to 10 addresses for faster checkout.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#43516d]">
                {addressCount} of 10 saved
              </span>
              {defaultCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-primary">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {defaultCount} default
                </span>
              )}
            </div>
          </div>

          {atLimit && (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You have reached the 10-address limit. Delete an address before
              adding another.
            </p>
          )}

          {addresses.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:px-8">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                <MapPin size={25} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-black text-[#17233d]">
                No saved addresses yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Add a delivery address to make checkout quicker. You can save
                home, work, or any other delivery location.
              </p>
              <button
                type="button"
                className={`${actionClass} mt-5 gap-2`}
                disabled={busy || editing !== undefined}
                onClick={() => {
                  setError('')
                  setNotice('')
                  setEditing(null)
                }}
              >
                <Plus size={17} aria-hidden="true" />
                Add your first address
              </button>
            </div>
          ) : (
            <div
              className={
                addresses.length > 1
                  ? 'grid gap-4 sm:grid-cols-2'
                  : 'grid grid-cols-1 gap-4'
              }
            >
              {orderedAddresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  busy={busy || editing !== undefined}
                  onEdit={() => {
                    setError('')
                    setNotice('')
                    setEditing(address)
                  }}
                  onMakeDefault={() => void change(address, false)}
                  onDelete={() => void change(address, true)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function countryDisplayName(countryCode: string) {
  const code = countryCode.trim().toUpperCase()
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

function AddressCard({
  address,
  busy,
  onEdit,
  onMakeDefault,
  onDelete,
}: {
  address: Address
  busy: boolean
  onEdit: () => void
  onMakeDefault: () => void
  onDelete: () => void
}) {
  const label = address.label || 'Saved address'
  const normalizedLabel = label.toLowerCase()
  const AddressIcon =
    normalizedLabel.includes('office') ||
    normalizedLabel.includes('work') ||
    normalizedLabel.includes('business')
      ? Briefcase
      : normalizedLabel.includes('home')
        ? Home
        : MapPin
  const locality = [address.city, address.region, address.postalCode]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="flex h-full flex-col gap-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(20,32,58,0.035)] transition hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(36,89,232,0.07)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            <AddressIcon size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-muted">
              Delivery address
            </p>
            <h2 className="mt-1 break-words text-base font-black text-[#17233d]">
              {label}
            </h2>
          </div>
        </div>
        {address.isDefault && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-extrabold text-primary">
            <CheckCircle2 size={13} aria-hidden="true" />
            Default
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.72fr)]">
        <div className="min-w-0">
          <p className="font-bold text-[#26334d]">{address.recipientName}</p>
          <address className="mt-2 space-y-0.5 break-words text-sm not-italic leading-6 text-[#4c5a75]">
            <p>{address.addressLine1}</p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            {locality && <p>{locality}</p>}
            <p className="font-medium text-[#26334d]">
              {countryDisplayName(address.countryCode)}
              <span className="ml-1 text-xs text-muted">
                ({address.countryCode.toUpperCase()})
              </span>
            </p>
          </address>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-[#4c5a75] sm:self-start">
          <Phone
            size={16}
            className="mt-0.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">
              Contact phone
            </p>
            <a
              href={`tel:${address.phone}`}
              className="mt-1 inline-block break-all font-semibold text-[#26334d] hover:text-primary"
            >
              {address.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-primary transition hover:text-blue-800 disabled:opacity-50"
          onClick={onEdit}
        >
          <Pencil size={15} aria-hidden="true" />
          Edit address
        </button>
        {!address.isDefault && (
          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-[#43516d] transition hover:text-primary disabled:opacity-50"
            onClick={onMakeDefault}
          >
            <Star size={15} aria-hidden="true" />
            Make default
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-red-700 transition hover:text-red-800 disabled:opacity-50"
          onClick={onDelete}
        >
          <Trash2 size={15} aria-hidden="true" />
          Delete address
        </button>
      </div>
    </article>
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
  const [value, setValue] = useState<AddressInput>(() =>
    initial ? { ...initial } : { ...initialAddress },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    } catch (failure) {
      setError(
        (failure instanceof Error
          ? failure.message
          : 'Could not save address.') +
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
    placeholder?: string
    hint?: string
  }[] = [
    {
      key: 'label',
      label: 'Address label',
      max: 40,
      required: true,
      autocomplete: 'off',
      placeholder: 'Home, Office, or another label',
    },
    {
      key: 'recipientName',
      label: 'Recipient name',
      max: 120,
      required: true,
      autocomplete: 'name',
      placeholder: 'Full name of the recipient',
    },
    {
      key: 'phone',
      label: 'Phone number',
      max: 16,
      required: true,
      autocomplete: 'tel',
      placeholder: '+8801740117690',
      hint: 'Use international E.164 format, including the + country prefix.',
    },
    {
      key: 'addressLine1',
      label: 'Street address',
      max: 200,
      required: true,
      autocomplete: 'address-line1',
      placeholder: 'Home, road, and street',
    },
    {
      key: 'addressLine2',
      label: 'Apartment / address line 2',
      max: 200,
      autocomplete: 'address-line2',
      placeholder: 'Apartment, floor, unit (optional)',
    },
    {
      key: 'city',
      label: 'City',
      max: 100,
      required: true,
      autocomplete: 'address-level2',
      placeholder: 'City or town',
    },
    {
      key: 'region',
      label: 'Region / state',
      max: 100,
      autocomplete: 'address-level1',
      placeholder: 'Region, state, or district',
    },
    {
      key: 'postalCode',
      label: 'Postal code',
      max: 20,
      autocomplete: 'postal-code',
      placeholder: 'Postal code (optional)',
    },
    {
      key: 'countryCode',
      label: 'Country code (ISO)',
      max: 2,
      required: true,
      autocomplete: 'country',
      placeholder: 'BD',
      hint: 'Enter the 2-letter ISO country code, for example BD.',
    },
  ]

  return (
    <form
      aria-labelledby="address-form-title"
      onSubmit={submit}
      className="mb-6 rounded-[22px] border border-blue-200 bg-white p-5 shadow-[0_8px_28px_rgba(36,89,232,0.07)] sm:p-7"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-primary">
            {initial ? 'Update address' : 'New delivery location'}
          </p>
          <h2
            id="address-form-title"
            className="mt-1 text-xl font-black tracking-tight text-[#17233d] sm:text-2xl"
          >
            {initial ? 'Edit delivery address' : 'Add a delivery address'}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">
            {initial
              ? 'Update the saved details for this delivery location.'
              : 'Add a home, work, or other address to use during checkout.'}
          </p>
        </div>
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary sm:flex">
          <MapPin size={23} aria-hidden="true" />
        </span>
      </div>

      <fieldset disabled={busy} className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.key}
            htmlFor={`address-${field.key}`}
            className="block min-w-0 text-sm font-bold text-[#26334d]"
          >
            {field.label}
            <input
              id={`address-${field.key}`}
              className={inputClass}
              required={field.required}
              maxLength={field.max}
              autoComplete={field.autocomplete}
              type={field.key === 'phone' ? 'tel' : 'text'}
              inputMode={field.key === 'phone' ? 'tel' : 'text'}
              placeholder={field.placeholder}
              aria-describedby={
                field.hint ? `address-${field.key}-hint` : undefined
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
            {field.hint && (
              <span
                id={`address-${field.key}-hint`}
                className="mt-1.5 block text-xs font-normal leading-5 text-muted"
              >
                {field.hint}
              </span>
            )}
          </label>
        ))}

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-[#26334d] sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={value.isDefault}
            disabled={Boolean(initial?.isDefault)}
            onChange={(event) =>
              setValue((previous) => ({
                ...previous,
                isDefault: event.target.checked,
              }))
            }
          />
          <span>
            Set as default delivery address
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Use this address as the preselected option at checkout.
            </span>
          </span>
        </label>
      </fieldset>

      <ErrorMessage text={error} />

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#43516d] transition hover:bg-slate-50 disabled:opacity-50"
          onClick={cancel}
        >
          <X size={16} aria-hidden="true" />
          Cancel
        </button>
        <PendingButton
          busy={busy}
          pendingLabel="Saving address…"
          type="submit"
          className={`${actionClass} gap-2 sm:ml-auto`}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          Save address
        </PendingButton>
      </div>
    </form>
  )
}
