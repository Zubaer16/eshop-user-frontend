import { spawnSync } from 'node:child_process'

const argument = process.argv.indexOf('--api-origin')
if (argument < 0 || !process.argv[argument + 1])
  throw new Error(
    'Supply --api-origin with the trusted HTTPS Backend origin; tests make public server-side GETs only.',
  )
const origin = new URL(process.argv[argument + 1])
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('A bare HTTPS Backend origin is required.')
const env = {
  ...process.env,
  NEXT_PUBLIC_ESHOP_API_URL: origin.origin,
  ESHOP_API_URL: origin.origin,
  NEXT_TELEMETRY_DISABLED: '1',
}
for (const args of [
  ['node_modules/next/dist/bin/next', 'build'],
  [
    'node_modules/playwright/cli.js',
    'test',
    '--config=playwright.config.mjs',
    ...(process.argv.includes('--headed') ? ['--headed'] : []),
  ],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}
