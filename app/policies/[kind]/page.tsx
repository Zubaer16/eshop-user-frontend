import { PolicyPage } from '@/components/store/store-content'
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string }>
}) {
  const { kind } = await params
  return <PolicyPage key={kind} kind={kind} />
}
