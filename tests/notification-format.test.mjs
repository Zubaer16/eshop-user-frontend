import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  notificationBody,
  notificationTime,
} from '../lib/notification-format.ts'

test('notification times render readable elapsed time and handle invalid values', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  assert.equal(notificationTime('2026-11-16T11:50:00Z', now), '10 minutes ago')
  assert.equal(notificationTime('2026-11-15T12:00:00Z', now), 'yesterday')
  assert.equal(notificationTime('invalid', now), 'Time unavailable')
  assert.equal(notificationTime('2026-11-16T13:00:00Z', now), 'Just now')
})

test('notification presentation shortens order references and preserves other content', () => {
  assert.equal(
    notificationBody(
      'Your order a9e58af3-e469-488f-b9ae-6632a6d465c8 has been placed.',
    ),
    'Your order #A9E58AF3 has been placed.',
  )
  assert.equal(
    notificationBody('Your package is on its way.'),
    'Your package is on its way.',
  )
})
