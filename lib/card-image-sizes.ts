type ImageDimensions = { width?: number; height?: number } | null | undefined

export function cardImageSizes(
  image: ImageDimensions,
  layout: 'grid' | 'catalog' = 'grid',
) {
  const aspect =
    image?.width && image.height ? image.width / image.height : 1.03
  const scale = Math.min(1, aspect / 1.03).toFixed(4)
  const padding = (32 * Math.min(1, aspect)).toFixed(4)
  const size = (slot: string) => `calc((${slot}) * ${scale} - ${padding}px)`
  const large =
    layout === 'catalog'
      ? '(min(100vw - 80px, 1240px) - 303px) / 3'
      : '(min(100vw - 80px, 1240px) - 60px) / 4'
  const desktop =
    layout === 'catalog' ? '(100vw - 367px) / 3' : '(100vw - 104px) / 3'
  return [
    `(min-width: 1280px) ${size(large)}`,
    `(min-width: 1024px) ${size(desktop)}`,
    `(min-width: 768px) ${size('(100vw - 104px) / 3')}`,
    `(min-width: 640px) ${size('(100vw - 52px) / 2')}`,
    size('(100vw - 44px) / 2'),
  ].join(', ')
}
