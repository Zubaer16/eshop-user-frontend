import { LivePolicy } from '@/components/store/live-store'
import { isPreviewMode } from '@/lib/integration-mode'
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string }>
}) {
  const { kind } = await params
  if (isPreviewMode)
    return (
      <p className="container-shell py-14">
        This section is available in live mode.
      </p>
    )
  return <LivePolicy key={kind} kind={kind} />
}
