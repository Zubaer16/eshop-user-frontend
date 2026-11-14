'use client'

import Link from '@/components/ui/app-link'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiCopy } from '@/hooks/use-ui-copy'

export default function NotFound() {
  const t = useUiCopy()
  return (
    <div className="container-shell flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-blue-50 text-primary">
        <SearchX size={36} />
      </div>
      <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-primary">
        404 · {t.notFound}
      </p>
      <h1 className="mt-3 text-3xl font-extrabold">{t.missingTitle}</h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-muted">
        {t.missingDescription}
      </p>
      <Button asChild className="mt-7">
        <Link href="/">
          <ArrowLeft size={17} /> {t.backHome}
        </Link>
      </Button>
    </div>
  )
}
