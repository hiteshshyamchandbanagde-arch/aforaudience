// Stamps public/sw.js's CACHE_VERSION with the current build's commit SHA
// before every build - runs automatically via the "prebuild" npm hook.
//
// Why this exists (session 36, 26 Jul): the SW's own header comment says
// "Bump CACHE_VERSION whenever cached routes or the precache list
// change - the version string is the *only* thing that expires old
// caches." That was a manual step, and it hadn't been bumped since
// 14 Jul despite dozens of feature PRs landing since - meaning any
// device that ever hit the navigation-request cache fallback (even a
// single brief network hiccup) could keep being served a week-plus-old
// page indefinitely, silently, with no error. Confirmed live: an
// Artist's Edit Profile page was missing a field that's been in the
// code since 23 Jul.
//
// Fix: derive the version automatically from the build itself instead
// of relying on someone remembering to bump a string. Vercel sets
// VERCEL_GIT_COMMIT_SHA for every build; local/dev builds (no such env
// var) fall back to a timestamp so this never throws locally.
const fs = require('fs')
const path = require('path')

const swPath = path.join(__dirname, '..', 'public', 'sw.js')
const sw = fs.readFileSync(swPath, 'utf8')

const sha = process.env.VERCEL_GIT_COMMIT_SHA
const version = sha ? `git-${sha.slice(0, 10)}` : `local-${Date.now()}`

const pattern = /const CACHE_VERSION = '[^']*';/
if (!pattern.test(sw)) {
  console.warn('[stamp-sw-version] CACHE_VERSION pattern not found in public/sw.js - left unchanged. If sw.js was rewritten, update this script\'s pattern to match.')
  process.exit(0)
}

fs.writeFileSync(swPath, sw.replace(pattern, `const CACHE_VERSION = '${version}';`))
console.log(`[stamp-sw-version] CACHE_VERSION -> ${version}`)
