// GEN-2610-001 - contrast of every text colour on the light documents
// users receive: the ticket email (its inline styles, parsed from the
// real renderer's output) and the ticket PDF (every drawText call the
// real generator makes, captured from pdf-lib). Small text must be
// >= 4.5:1 on what it sits on; large text (>= 24px, or >= 18.66px bold;
// in PDF points 18pt / 14pt bold) and fills/bars are exempt. Both run on
// the default token values, the same values the resolver returns when
// the DB has no edits. Same plain Node + assert convention as the other
// scripts/*.test.ts:
//
//   npx tsx scripts/document-contrast.test.ts
//
// Needs node_modules (pdf-lib, resend, prisma client). email.ts and
// ticket-pdf.ts import the resolver's server half, which builds a Prisma
// client at import time; it is never queried here (colours are passed
// in), so a placeholder DATABASE_URL is enough when none is set.
import assert from 'node:assert/strict'
import { PDFPage } from 'pdf-lib'
import { DEFAULT_TOKEN_VALUES, composeRgba, contrastRatio, resolveColorValue } from '../src/lib/design-tokens'

process.env.DATABASE_URL ??= 'postgresql://placeholder@localhost:5432/none'

const SMALL_MIN = 4.5
// What a mail client paints behind text that sets no background.
const MAIL_CLIENT_GROUND = '#FFFFFF' // token-ok(hex-color-literal): assumed mail-client page, test only

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

function defaults<K extends string>(keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>
  for (const k of keys) out[k] = resolveColorValue(DEFAULT_TOKEN_VALUES, k)
  return out
}

type TextUse = { where: string; fg: string; bg: string; px: number; bold: boolean }
function isLargePx(px: number, bold: boolean) {
  return px >= 24 || (bold && px >= 18.66)
}
function smallFailures(uses: TextUse[]) {
  return uses
    .filter((u) => !isLargePx(u.px, u.bold))
    .map((u) => ({ ...u, ratio: contrastRatio(u.fg, u.bg) }))
    .filter((u) => u.ratio === null || u.ratio < SMALL_MIN)
    .map((u) => `${u.where}: ${u.fg} on ${u.bg} at ${u.px}px${u.bold ? ' bold' : ''} = ${u.ratio?.toFixed(2)}:1`)
}

// --- email: walk the inline styles ------------------------------------------

function parseStyle(attrs: string): Record<string, string> {
  const m = attrs.match(/style="([^"]*)"/)
  const out: Record<string, string> = {}
  if (!m) return out
  for (const decl of m[1].split(';')) {
    const i = decl.indexOf(':')
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim()
  }
  return out
}

// The renderer's HTML is our own template: no void elements, no comments,
// every tag closed. Colour, size and weight inherit; the ground is the
// nearest ancestor with a background.
function emailTextUses(html: string): TextUse[] {
  type Ctx = { color: string; bg: string; px: number; bold: boolean; tag: string }
  const stack: Ctx[] = [{ color: '#000000', bg: MAIL_CLIENT_GROUND, px: 16, bold: false, tag: '#root' }] // token-ok(hex-color-literal): mail-client default text, test only
  const uses: TextUse[] = []
  const re = /<(\/?)([a-zA-Z]+)([^>]*)>|([^<]+)/g
  for (let m; (m = re.exec(html)); ) {
    const top = stack[stack.length - 1]
    if (m[4] !== undefined) {
      const text = m[4].replace(/&[a-z#0-9]+;/g, 'x').trim()
      if (text) uses.push({ where: `email "${text.slice(0, 40)}"`, fg: top.color, bg: top.bg, px: top.px, bold: top.bold })
      continue
    }
    const tag = m[2].toLowerCase()
    if (m[1]) {
      assert.equal(top.tag, tag, `unbalanced </${tag}> in the email HTML`)
      stack.pop()
      continue
    }
    const s = parseStyle(m[3])
    const size = s['font-size']?.match(/^([\d.]+)px$/)
    const weight = s['font-weight']
    stack.push({
      tag,
      color: s.color ?? top.color,
      bg: s.background ?? s['background-color'] ?? top.bg,
      px: size ? Number(size[1]) : top.px,
      bold: tag === 'strong' || tag === 'b' ? true : weight ? Number(weight) >= 700 || weight === 'bold' : top.bold,
    })
  }
  assert.equal(stack.length, 1, 'unclosed tags in the email HTML')
  return uses
}

// --- pdf: capture what the generator draws -----------------------------------

type PdfColor = { red: number; green: number; blue: number }
function pdfCss(color: PdfColor, opacity = 1) {
  return composeRgba(Math.round(color.red * 255), Math.round(color.green * 255), Math.round(color.blue * 255), opacity)
}

async function main() {
  const { EMAIL_TOKENS, emailColorsFrom, renderTicketEmailHtml } = await import('../src/lib/email')
  const { TICKET_PDF_TOKENS, ticketPdfColorsFrom, generateTicketPdf } = await import('../src/lib/ticket-pdf')

  const emailInput = {
    attendeeName: 'Asha Rao',
    eventTitle: 'Mic Gala 100',
    eventDateHuman: 'Sat, 10 Oct 2026, 7:00 PM',
    venueLine: 'The Studio, Jaipur',
    seatsSummary: 'C4, C6',
    totalAmount: 1060,
    subtotalAmount: 1000,
    bookingFeeAmount: 60,
    bookingId: 'cm-test-booking',
    ticketCode: 'AFA-TEST-0001',
  }
  const emailUses = emailTextUses(renderTicketEmailHtml(emailInput, emailColorsFrom(defaults(EMAIL_TOKENS))))

  await test('email: every small-text colour pair is at least 4.5:1', () => {
    assert.ok(emailUses.length > 15, `walker found only ${emailUses.length} text runs`)
    assert.deepEqual(smallFailures(emailUses), [])
  })

  await test('email: labels keep an orange tint (not plain ink) and sit on the cream card', () => {
    const when = emailUses.find((u) => u.where === 'email "WHEN"')
    assert.ok(when, 'WHEN label not found')
    assert.equal(when.bg, resolveColorValue(DEFAULT_TOKEN_VALUES, '--afa-cream'))
    const [r, , b] = [parseInt(when.fg.slice(1, 3), 16), 0, parseInt(when.fg.slice(5, 7), 16)]
    assert.ok(r > b, `label ${when.fg} lost its orange tint`)
  })

  await test('email: the free-entry variant passes too', () => {
    const html = renderTicketEmailHtml({ ...emailInput, totalAmount: 0, subtotalAmount: 0, bookingFeeAmount: 0, venueLine: null, ticketCode: null }, emailColorsFrom(defaults(EMAIL_TOKENS)))
    assert.deepEqual(smallFailures(emailTextUses(html)), [])
  })

  // pdf-lib draws through PDFPage; wrap its two draw methods to record
  // the colour, opacity, size and font of every call.
  const drawn: { kind: 'text' | 'rect'; text?: string; color?: PdfColor; opacity?: number; size?: number; font?: string; width?: number; height?: number }[] = []
  const origText = PDFPage.prototype.drawText
  const origRect = PDFPage.prototype.drawRectangle
  PDFPage.prototype.drawText = function (text, options = {}) {
    drawn.push({ kind: 'text', text, color: options.color as PdfColor, opacity: options.opacity, size: options.size, font: options.font?.name })
    return origText.call(this, text, options)
  }
  PDFPage.prototype.drawRectangle = function (options = {}) {
    drawn.push({ kind: 'rect', color: options.color as PdfColor, opacity: options.opacity, width: options.width, height: options.height })
    return origRect.call(this, options)
  }
  const pdfColors = ticketPdfColorsFrom(defaults(TICKET_PDF_TOKENS))
  try {
    await generateTicketPdf(
      {
        bookingId: 'cm-test-booking',
        ticketCode: 'AFA-TEST-0001',
        eventTitle: 'Mic Gala 100',
        eventDate: new Date('2026-10-10T13:30:00Z'),
        eventStartTime: '7:00 PM',
        eventEndTime: '9:00 PM',
        venueName: 'The Studio',
        venueCity: 'Jaipur',
        seats: {},
        seatLabels: ['C4', 'C6'],
        totalAmount: 1060,
        subtotalAmount: 1000,
        bookingFeeAmount: 60,
        attendeeName: 'Asha Rao',
        purchasedAt: new Date('2026-10-04T10:00:00Z'),
        companions: [{ name: 'Ravi', status: 'ACCEPTED' }],
      },
      pdfColors
    )
  } finally {
    PDFPage.prototype.drawText = origText
    PDFPage.prototype.drawRectangle = origRect
  }

  const paperRect = drawn.find((d) => d.kind === 'rect')!
  const paper = pdfCss(paperRect.color!, paperRect.opacity)
  const pdfUses: TextUse[] = drawn
    .filter((d) => d.kind === 'text')
    .map((d) => ({
      where: `pdf "${d.text!.slice(0, 40)}"`,
      fg: pdfCss(d.color!, d.opacity ?? 1),
      bg: paper,
      px: (d.size! * 4) / 3, // points to CSS px
      bold: /Bold/.test(d.font ?? ''),
    }))

  await test('pdf: every small-text colour pair is at least 4.5:1 on the paper', () => {
    assert.equal(paper, pdfCss(pdfColors.paper.color as unknown as PdfColor, pdfColors.paper.opacity))
    assert.ok(pdfUses.length > 15, `captured only ${pdfUses.length} text draws`)
    assert.deepEqual(smallFailures(pdfUses), [])
  })

  await test('pdf: the primary fill stays on the underline bar (fills are exempt)', () => {
    const fill = pdfCss(pdfColors.accent.color as unknown as PdfColor, pdfColors.accent.opacity)
    assert.ok(drawn.some((d) => d.kind === 'rect' && d.height === 1.4 && pdfCss(d.color!, d.opacity) === fill), 'underline no longer uses the primary fill')
  })

  await test('large-text exemption: 24px, 18.66px bold; not 18px bold or 23px regular', () => {
    assert.equal(isLargePx(24, false), true)
    assert.equal(isLargePx(18.66, true), true)
    assert.equal(isLargePx(18, true), false)
    assert.equal(isLargePx(23, false), false)
  })

  console.log(`\n${passed} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
