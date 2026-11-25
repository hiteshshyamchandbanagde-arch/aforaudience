// Per-file literal count using the exact same RULES check-design-tokens.js
// and the ratchet use - so a before/after diff always agrees with what
// the real ratchet run will show. Usage: node scripts/dev/count-file.js <file>
//
// GEN-2609-119 - counts the way the ratchet's countLines does: a token-ok
// exempts only the rules it names (GEN-2609-117), and bare-button reads
// the line above. This script still imported the pre-117 `tokenOkReason`
// and threw on every run.
const fs = require('fs')
const { RULES, parseTokenOk } = require('../check-design-tokens')

const file = process.argv[2]
const text = fs.readFileSync(file, 'utf8')
const counts = {}
for (const rule of RULES) counts[rule.name] = 0
let total = 0
let prevLine = ''
for (const line of text.split('\n')) {
  const above = prevLine
  prevLine = line
  const ok = parseTokenOk(line)
  const exempt = ok && ok.rules ? ok.rules : []
  for (const rule of RULES) {
    if (rule.isExemptFile && rule.isExemptFile(file)) continue
    if (exempt.includes(rule.name)) continue
    const literals = rule.extract ? rule.extract(line, above) : (rule.test(line, above) ? [line] : [])
    counts[rule.name] += literals.length
    total += literals.length
  }
}
console.log(file)
for (const rule of RULES) console.log(`  ${rule.name}: ${counts[rule.name]}`)
console.log(`  TOTAL: ${total}`)
