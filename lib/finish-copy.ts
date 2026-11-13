/** English copy for the storefront presentation. */
const englishCopy = {
  quantity: 'Qty',
  highlight1: 'Made for discovery',
  highlight1Desc: 'Explore everyday categories',
  highlight3: 'Made for global discovery',
  highlight3Desc: 'USD prices across destinations',
  categoryEyebrow: 'FIND YOUR THING',
  categoryLink: 'All categories',
  collectionEyebrow: 'THE GOOD STUFF',
  collectionTitle: 'Products to explore',
  promoEyebrow: 'SOMETHING GOOD',
  promoTitle: 'A little refresh for your everyday.',
  promoDesc:
    'Explore practical finds across fashion, tech, home and more—all in one thoughtfully designed store.',
  promoLink: 'Discover offers',
} as const

export function finishCopy(_locale?: 'en') {
  void _locale
  return englishCopy
}
