// S1b-a (Hitesh, 9 Nov) - route-level self-tests for the launch wave gates.
// Route handlers need a session + DB, so (like otp-signup-verify.test.ts)
// this reads each gated route's source and checks:
//   1. it calls the gate for the right wave,
//   2. the gate runs before the first DB write in that handler,
//   3. the gate's refusal is returned as the 403 WAVE_CLOSED body.
// Combined with launch-waves.test.ts (which proves waveBlock returns the
// 403 WAVE_CLOSED body when the injected flag is off, null when on, and
// that ADMIN bypasses) this covers "each gated route refuses when its flag
// is off and is unchanged when on" without ever writing the QA
// PlatformSettings row. Regression shape: on origin/qa no route calls the
// gate, so this fails; on the branch it passes.
//
//   npx tsx scripts/launch-waves-routes.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const WRITE_RE = /prisma\.\w+\.(create|createMany|upsert|update|updateMany)\(|\$transaction\(/

/** Source of the exported handler `method`, up to the next top-level export. */
function handlerSource(src: string, method: string): string {
  const start = src.indexOf(`export async function ${method}(`)
  assert.ok(start >= 0, `no ${method} handler`)
  const next = src.indexOf('\nexport ', start + 1)
  return next < 0 ? src.slice(start) : src.slice(start, next)
}

type Gate = { file: string; method: string; wave: 'W1' | 'W2' | 'W3' | 'W4'; call?: RegExp }

export const GATES: Gate[] = [
  { file: 'src/app/api/auth/register/route.ts', method: 'POST', wave: 'W1' },
]

for (const g of GATES) {
  test(`${g.wave} gate on ${g.method} ${g.file} runs before any DB write`, () => {
    const body = handlerSource(read(g.file), g.method)
    const call = g.call ?? new RegExp(`launchWaveBlock\\(\\s*"?'?${g.wave}`)
    const gateAt = body.search(call)
    assert.ok(gateAt >= 0, `${g.file} does not call the ${g.wave} gate`)
    const writeAt = body.search(WRITE_RE)
    if (writeAt >= 0) assert.ok(gateAt < writeAt, `${g.file}: ${g.wave} gate runs after a DB write`)
    // The refusal is sent as-is (status 403, body with code WAVE_CLOSED).
    assert.match(body.slice(gateAt), /NextResponse\.json\(\s*\w+\.body,\s*\{\s*status:\s*\w+\.status\s*\}\s*\)/)
  })
}

test('W1 gate on Google adapter.createUser runs before prisma.user.create', () => {
  const src = read('src/lib/auth.ts')
  const start = src.indexOf('createUser: async')
  assert.ok(start >= 0)
  const body = src.slice(start, src.indexOf('prisma.user.create', start))
  assert.match(body, /isWaveOpen\(.*?"W1"\)\)\s*throw new WaveClosedError\("W1"\)/)
})

test('only register + Google adapter create users (any new path must be gated)', () => {
  const { execSync } = require('node:child_process') as typeof import('node:child_process')
  const out = execSync(`grep -rlE "prisma\\.user\\.(create|upsert)\\(" src || true`, { cwd: ROOT }).toString().trim().split('\n').filter(Boolean).sort()
  assert.deepEqual(out, ['src/app/api/auth/register/route.ts', 'src/lib/auth.ts'])
})

console.log(`\n${passed} passed`)
