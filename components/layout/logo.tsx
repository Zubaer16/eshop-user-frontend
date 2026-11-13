'use client'
import Image from 'next/image'
import { useStoreConfiguration } from '@/components/store/store-content'
import { imageUrl } from '@/lib/api/catalog'
import Link from 'next/link'

export function Logo({ light = false }: { light?: boolean }) {
  const store = useStoreConfiguration(),
    name = store.data?.profile.storeName || 'eShop',
    logo = imageUrl(store.data?.branding.logo?.url)
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5"
      aria-label={name + ' home'}
    >
      <Image
        src={logo || '/logo-mark.svg'}
        width={39}
        height={39}
        alt=""
        priority
        unoptimized={Boolean(logo)}
      />
      <span
        className={`max-[360px]:hidden text-[21px] font-extrabold tracking-[-.07em] sm:text-[23px] ${light ? 'text-white' : 'text-ink'}`}
      >
        {name}
        <span className="text-primary">.</span>
      </span>
    </Link>
  )
}
