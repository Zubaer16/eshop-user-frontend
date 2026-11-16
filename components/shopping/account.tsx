'use client'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { PendingButton, PendingIndicator } from '@/components/ui/pending-button'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '@/lib/api/client'
import { useAccountResource } from '@/components/account/use-account-resource'
import type { Profile } from '@/lib/api/shopping'
import { actionClass, inputClass, ErrorMessage } from './cart'

export function AccountHome() {
  const resource = useAccountResource<Profile>('/v1/account/profile')
  const [notice, setNotice] = useState('')
  return (
    <section className="container-shell max-w-4xl py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-black">Your account</h1>
        {resource.data && resource.loading && (
          <PendingIndicator label="Updating your profile" />
        )}
      </div>
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
          key={resource.data.id}
          profile={resource.data}
          saved={() => {
            setNotice('Display name saved.')
            resource.reload()
          }}
        />
      ) : (
        !resource.error && (
          <ContentSkeleton variant="form" label="Loading your profile" />
        )
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
  const edited = useRef(false)
  useEffect(() => {
    if (!edited.current) setName(profile.displayName)
  }, [profile.displayName])
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await api.request<Profile>('/v1/account/profile', {
        method: 'PATCH',
        body: { displayName: name.trim() },
      })
      edited.current = false
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
            onChange={(event) => {
              edited.current = true
              setName(event.target.value)
            }}
            disabled={busy}
            autoComplete="name"
          />
        </label>
        <p className="text-xs text-muted">
          Email and credentials are managed through the separate
          verification/security flows.
        </p>
        <ErrorMessage text={error} />
        <PendingButton
          busy={busy}
          pendingLabel="Saving display name…"
          className={actionClass}
          type="submit"
          disabled={busy || !name.trim()}
        >
          Save display name
        </PendingButton>
      </form>
    </div>
  )
}

export { Addresses } from './address-book'
