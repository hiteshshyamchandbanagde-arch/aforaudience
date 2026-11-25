// BUG-2610-023 - self-tests for src/lib/poster-url.ts: a poster's link is
// built from the origin it was requested on, not NEXTAUTH_URL (which on QA
// still named the old aforaudience.vercel.app host). Run with tsx:
//
//   npx tsx scripts/poster-url.test.ts
import assert from 'node:assert/strict'
import { publicEventUrl, requestOrigin } from '../src/lib/poster-url'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

process.env.NEXTAUTH_URL = 'https://aforaudience.vercel.app'

test('the request host wins over NEXTAUTH_URL', () => {
  const req = new Request('https://qa.aforaudience.com/api/posters/artist/p1', { headers: { host: 'qa.aforaudience.com' } })
  assert.equal(publicEventUrl('evt1', req), 'https://qa.aforaudience.com/events/evt1')
})

test("behind Vercel's proxy, x-forwarded-host and -proto name the deployment", () => {
  const req = new Request('http://localhost:3000/api/posters/artist/p1', {
    headers: { host: 'localhost:3000', 'x-forwarded-host': 'aforaudience-abc123.vercel.app', 'x-forwarded-proto': 'https' },
  })
  assert.equal(requestOrigin(req), 'https://aforaudience-abc123.vercel.app')
  assert.equal(publicEventUrl('evt1', req), 'https://aforaudience-abc123.vercel.app/events/evt1')
})

test('a comma-separated forwarded list uses the first hop', () => {
  const req = new Request('http://x/api', { headers: { 'x-forwarded-host': 'a.example.com, b.internal', 'x-forwarded-proto': 'https,http' } })
  assert.equal(requestOrigin(req), 'https://a.example.com')
})

test('no host header: the URL origin', () => {
  // undici fills nothing in for a bare Request, so the URL's own origin is used.
  const req = new Request('https://preview.example.com/api/posters/organiser/e1')
  assert.equal(publicEventUrl('e1', req), 'https://preview.example.com/events/e1')
})

test('no request: NEXTAUTH_URL, then the QA domain', () => {
  assert.equal(publicEventUrl('e1'), 'https://aforaudience.vercel.app/events/e1')
  delete process.env.NEXTAUTH_URL
  assert.equal(publicEventUrl('e1'), 'https://qa.aforaudience.com/events/e1')
})

console.log(`\n${passed} passed`)
