// S1b-b1-fix (9 Nov) - the W1 holding check moved from per-segment layouts
// (WaveHoldingGate -> connection() + getServerSession() on every request,
// which made every public page dynamic and broke networkidle in ~30 e2e
// specs) into src/proxy.ts. Regression shape: on the b1 head src/proxy.ts
// doesn't exist and "/" + the held layouts import WaveHoldingGate, so this
// fails; after the fix it passes.
//
//   npx tsx scripts/launch-waves-proxy.test.ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  LAUNCHING_SOON_PATH,
  W1_HELD_PREFIXES,
  ttlCached,
  w1ProxyAction,
  w1ProxyMatcher,
} from '../src/lib/launch-waves'

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

const ROOT = join(__dirname, '..')
const APP = join(ROOT, 'src', 'app')
const PROXY = join(ROOT, 'src', 'proxy.ts')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

const deps = (w1: boolean | Error, admin: boolean | Error) => {
  const calls = { w1: 0, admin: 0 }
  return {
    calls,
    readW1Open: async () => {
      calls.w1++
      if (w1 instanceof Error) throw w1
      return w1
    },
    readIsAdmin: async () => {
      calls.admin++
      if (admin instanceof Error) throw admin
      return admin
    },
  }
}

async function main() {
  await test('open -> pass, and the session is never read', async () => {
    for (const p of ['/', '/events/', '/events/abc/', '/blog']) {
      const d = deps(true, false)
      assert.equal(await w1ProxyAction(p, d), 'next', p)
      assert.equal(d.calls.admin, 0, p)
    }
  })

  await test('closed + admin -> pass', async () => {
    for (const p of ['/', '/events/', '/venues/v1/']) assert.equal(await w1ProxyAction(p, deps(false, true)), 'next', p)
  })

  await test('closed + non-admin -> rewrite on every held path', async () => {
    for (const p of ['/', '/events', '/events/', '/artists/a1/', '/careers/', '/wall-of-fame/x']) {
      assert.equal(await w1ProxyAction(p, deps(false, false)), 'rewrite', p)
    }
  })

  await test('closed + session read error -> treated as non-admin (rewrite)', async () => {
    assert.equal(await w1ProxyAction('/events/', deps(false, new Error('bad jwt'))), 'rewrite')
  })

  await test('W1 read error -> pass (same as isW1OpenForDisplay)', async () => {
    const d = deps(new Error('db down'), false)
    assert.equal(await w1ProxyAction('/events/', d), 'next')
    assert.equal(d.calls.admin, 0)
  })

  await test('closed: non-held paths pass without any read', async () => {
    for (const p of ['/login/', '/about/', '/dashboard/', '/api/x', '/eventsx', LAUNCHING_SOON_PATH, LAUNCHING_SOON_PATH + '/']) {
      const d = deps(false, false)
      assert.equal(await w1ProxyAction(p, d), 'next', p)
      assert.equal(d.calls.w1 + d.calls.admin, 0, p)
    }
  })

  await test('ttlCached: one fetch inside the TTL, refetch after, errors not cached', async () => {
    let t = 1000
    let n = 0
    let fail = false
    const c = ttlCached(async () => {
      n++
      if (fail) throw new Error('x')
      return n
    }, 30_000, () => t)
    assert.equal(await c.get(), 1)
    t += 29_999
    assert.equal(await c.get(), 1)
    t += 1
    assert.equal(await c.get(), 2)
    t += 30_000
    fail = true
    await assert.rejects(c.get())
    fail = false
    assert.equal(await c.get(), 4)
    c.clear()
    assert.equal(await c.get(), 5)
  })

  await test('src/proxy.ts matcher equals the held list (one source of truth)', () => {
    assert.ok(existsSync(PROXY), 'src/proxy.ts is missing')
    const src = readFileSync(PROXY, 'utf8')
    const m = src.match(/matcher:\s*\[([\s\S]*?)\]/)
    assert.ok(m, 'no matcher array literal in src/proxy.ts')
    const listed = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
    assert.deepEqual(listed, w1ProxyMatcher())
    assert.equal(w1ProxyMatcher().length, W1_HELD_PREFIXES.length + 1)
  })

  await test('matcher never covers api, _next, .well-known, static or always-reachable routes', () => {
    for (const entry of w1ProxyMatcher()) {
      for (const bad of ['/api', '/_next', '/.well-known', '/login', '/register', '/dashboard', '/about', '/contact', '/sw.js', '/manifest', '/launching-soon']) {
        assert.ok(!entry.startsWith(bad), `${entry} covers ${bad}`)
      }
    }
  })

  await test('src/proxy.ts uses the shared decision and the static rewrite target', () => {
    const src = readFileSync(PROXY, 'utf8')
    assert.ok(src.includes('w1ProxyAction('), 'proxy must call w1ProxyAction')
    assert.ok(src.includes('LAUNCHING_SOON_PATH'), 'proxy must rewrite to LAUNCHING_SOON_PATH')
    assert.ok(src.includes('getToken'), 'admin check must use next-auth/jwt getToken (no DB)')
    assert.ok(!src.includes('getServerSession'), 'proxy must not call getServerSession')
  })

  await test('/launching-soon is a static noindex page rendering LaunchHoldingPage', () => {
    const page = join(APP, LAUNCHING_SOON_PATH.slice(1), 'page.tsx')
    assert.ok(existsSync(page), `missing ${page}`)
    const src = readFileSync(page, 'utf8')
    assert.ok(src.includes('LaunchHoldingPage'))
    assert.ok(/index:\s*false/.test(src), 'must be noindex')
    assert.ok(!/connection\(|getServerSession|cookies\(|headers\(/.test(src), 'must stay static')
  })

  await test('"/" and the held segments no longer use WaveHoldingGate or connection()', () => {
    const files = [join(APP, 'page.tsx')]
    for (const prefix of W1_HELD_PREFIXES) {
      for (const d of [join(APP, prefix.slice(1)), join(APP, '(public)', prefix.slice(1))]) {
        if (existsSync(d)) walk(d, files)
      }
    }
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!src.includes('WaveHoldingGate'), `${f} imports WaveHoldingGate`)
      assert.ok(!/\bconnection\(\)/.test(src), `${f} calls connection()`)
      assert.ok(!src.includes('shouldShowHoldingPage'), `${f} calls shouldShowHoldingPage`)
    }
    assert.ok(/export const revalidate = 300/.test(readFileSync(join(APP, 'page.tsx'), 'utf8')), '"/" keeps ISR 300')
  })

  console.log(`\n${passed} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
