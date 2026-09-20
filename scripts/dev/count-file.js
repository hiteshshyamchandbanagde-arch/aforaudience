// Per-file literal count using the exact same RULES check-design-tokens.js
// and the ratchet use - so a before/after diff always agrees with what
// the real ratchet run will show. Usage: node scripts/dev/count-file.js <file>
const fs = require('fs')
const { RULES, tokenOkReason } = require('../check-design-tokens')

const file = process.argv[2]
const text = fs.readFileSync(file, 'utf8')
const counts = {}
for (const rule of RULES) counts[rule.name] = 0
let total = 0
for (const line of text.split('\n')) {
  if (tokenOkReason(line)) continue
  for (const rule of RULES) {
    if (rule.isExemptFile && rule.isExemptFile(file)) continue
    const literals = rule.extract ? rule.extract(line) : (rule.test(line) ? [line] : [])
    counts[rule.name] += literals.length
    total += literals.length
  }
}
console.log(file)
for (const rule of RULES) console.log(`  ${rule.name}: ${counts[rule.name]}`)
console.log(`  TOTAL: ${total}`)
