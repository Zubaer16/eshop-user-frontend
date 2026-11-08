'use client'
import { isPreviewMode } from '@/lib/integration-mode'
import { AuthPreview } from '@/components/account/auth-preview'
import { SignInForm } from './sign-in-form'
export function AuthEntry({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return isPreviewMode ? (
    <AuthPreview mode={mode} />
  ) : (
    <SignInForm key={mode} register={mode === 'sign-up'} />
  )
}
