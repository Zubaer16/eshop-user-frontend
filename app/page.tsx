import { StoreHome } from '@/components/store/store-content'
import { publicHomepage } from '@/lib/api/public-catalog'

export const revalidate = 30

export default async function Page() {
  const initial = await publicHomepage().catch(() => null)
  return <StoreHome initial={initial} expiresAt={Date.now() + 30000} />
}
