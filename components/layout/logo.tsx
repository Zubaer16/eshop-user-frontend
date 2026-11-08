import Image from 'next/image'
import Link from 'next/link'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5"
      aria-label="eShop home"
    >
      <Image src="/logo-mark.svg" width={39} height={39} alt="" priority />
      <span
        className={`max-[360px]:hidden text-[21px] font-extrabold tracking-[-.07em] sm:text-[23px] ${light ? 'text-white' : 'text-ink'}`}
      >
        eShop<span className="text-primary">.</span>
      </span>
    </Link>
  )
}
