import { cn } from '@/lib/utils'

type ShapeProps = { className?: string }

function Shape({ className }: ShapeProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl bg-[#e7ecf6]', className)}
    />
  )
}

/** Only shown during route transitions. Fast API responses may not display it. */
export function PageSkeleton({
  variant,
}: {
  variant: 'shop' | 'product' | 'account' | 'checkout'
}) {
  const label = 'Loading content'
  return (
    <section
      className="container-shell pb-20 pt-9 sm:pt-12"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <Shape className="h-4 w-32" />
      <Shape className="mt-5 h-10 w-64 max-w-full" />
      <Shape className="mt-4 h-4 w-80 max-w-full" />
      {variant === 'product' ? (
        <div className="mt-8 grid gap-7 lg:grid-cols-2">
          <Shape className="aspect-square w-full rounded-3xl" />
          <div className="space-y-5">
            <Shape className="h-8 w-5/6" />
            <Shape className="h-7 w-1/3" />
            <Shape className="h-20 w-full" />
            <Shape className="h-12 w-full" />
            <Shape className="h-12 w-3/4" />
          </div>
        </div>
      ) : variant === 'shop' ? (
        <div className="mt-8 flex gap-6">
          <Shape className="hidden h-[430px] w-[235px] shrink-0 lg:block" />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
            {Array.from({ length: 6 }, (_, index) => (
              <Shape key={index} className="aspect-[3/4] w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <Shape className="h-14 w-full" />
            <Shape className="h-40 w-full" />
            <Shape className="h-40 w-full" />
          </div>
          <Shape className="h-[300px] w-full" />
        </div>
      )}
    </section>
  )
}
