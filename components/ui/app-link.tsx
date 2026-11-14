'use client'
import NextLink, { useLinkStatus } from 'next/link'
import {
  forwardRef,
  useEffect,
  useId,
  type ComponentPropsWithoutRef,
} from 'react'
import { useNavigationSignals } from '@/components/layout/navigation-provider'

function LinkPending() {
  const { pending } = useLinkStatus()
  const { begin, end } = useNavigationSignals()
  const id = useId()
  useEffect(() => {
    if (pending) begin(id)
    else end(id)
    return () => end(id)
  }, [pending, id, begin, end])
  return null
}
const AppLink = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<typeof NextLink>
>(function AppLink({ children, ...props }, ref) {
  return (
    <NextLink {...props} ref={ref}>
      {children}
      <LinkPending />
    </NextLink>
  )
})
export default AppLink
