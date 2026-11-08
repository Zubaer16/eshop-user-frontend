'use client'
import { isPreviewMode } from '@/lib/integration-mode'
export function AccountLayout({
  preview,
  children,
}: {
  preview: React.ReactNode
  children: React.ReactNode
}) {
  return isPreviewMode ? preview : children
}
