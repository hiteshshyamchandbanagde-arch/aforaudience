import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib"
import QRCode from "qrcode"

// ---------------------------------------------------------------------------
// Ticket PDF generator.
//
// Design brief: editorial / theater-program feel, not utility / boarding-pass.
// A first ticket is a memorable moment for the audience — the PDF should
// feel like a keepsake. Playfair-esque serif for headings, warm Paper
// background, Ember accents, generous whitespace.
//
// Fonts: pdf-lib only ships with the 14 standard PDF fonts (Helvetica,
// Times-Roman, Courier + bold/italic variants). No Playfair Display
// available without embedding a custom TTF, which would balloon the
// serverless function size and slow cold starts. Times-Roman + Bold gets
// us 80% of the editorial feel at zero cost. If we later care enough,
// we can embed Playfair as a compressed subset — Checkpoint 3.5 or later.
//
// QR code encodes the raw booking ID. Not signed, not tokenized — this
// is the same value that appears in text on the ticket, so a check-in
// scanner can trust it as-is (once check-in exists, that scanner will
// live inside our own app and authenticate against our API). Anti-forge
// happens at scan time via DB lookup, not at PDF-generation time.
//
// Everything is a single page, A4 portrait. The layout is deliberately
// robust to long event titles (wraps) and long venue names (truncates
// with ellipsis rather than overflowing).
// ---------------------------------------------------------------------------

// AforAudience palette, expressed as pdf-lib rgb() values (0..1).
const COLOR = {
  ink: rgb(0.055, 0.047, 0.039),   // #0E0C0A — primary text
  paper: rgb(0.969, 0.953, 0.933), // #F7F3EE — page background
  ember: rgb(0.784, 0.267, 0.102), // #C8441A — brand accent
  mist: rgb(0.910, 0.886, 0.851),  // #E8E2D9 — divider
  sage: rgb(0.290, 0.404, 0.255),  // #4A6741 — confirmed pill
  bodyMuted: rgb(0.4, 0.38, 0.36), // slightly warm grey
} as const

const PAGE_W = 595 // A4 portrait in points
const PAGE_H = 842

export type TicketData = {
  bookingId: string
  eventTitle: string
  eventDate: Date
  eventStartTime: string
  eventEndTime: string
  venueName: string | null
  venueCity: string | null
  seats: Record<string, number>
  totalAmount: number
  subtotalAmount: number
  bookingFeeAmount: number
  attendeeName: string
  purchasedAt: Date
}

export async function generateTicketPdf(t: TicketData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`AforAudience — ${t.eventTitle}`)
  doc.setAuthor("AforAudience")
  doc.setCreator("AforAudience")
  doc.setProducer("AforAudience")

  const page = doc.addPage([PAGE_W, PAGE_H])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: COLOR.paper,
  })

  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Top brand bar ─────────────────────────────────────────────────────
  // Ember "A" + wordmark, small QA/live indicator (removed for prod
  // portability — the doc doesn't need to know which env issued it).
  const marginX = 48
  let cursorY = PAGE_H - 60

  page.drawText("A", {
    x: marginX,
    y: cursorY,
    size: 28,
    font: serifBold,
    color: COLOR.ember,
  })
  page.drawText("forAudience", {
    x: marginX + serifBold.widthOfTextAtSize("A", 28) + 2,
    y: cursorY,
    size: 22,
    font: serifBold,
    color: COLOR.ink,
  })

  // Tagline, right-aligned
  const tagline = "Where art finds its crowd"
  const taglineSize = 10
  const taglineWidth = sans.widthOfTextAtSize(tagline, taglineSize)
  page.drawText(tagline, {
    x: PAGE_W - marginX - taglineWidth,
    y: cursorY + 8,
    size: taglineSize,
    font: sans,
    color: COLOR.bodyMuted,
  })

  cursorY -= 20
  drawHairline(page, marginX, cursorY, PAGE_W - marginX * 2)

  // ── "Admit One" section ───────────────────────────────────────────────
  cursorY -= 44
  page.drawText("ADMIT ONE", {
    x: marginX,
    y: cursorY,
    size: 10,
    font: sansBold,
    color: COLOR.ember,
    // pdf-lib doesn't do letter-spacing natively; workaround via manual
    // char-by-char draw isn't worth it for one line.
  })
  cursorY -= 4
  drawUnderline(page, marginX, cursorY, sansBold.widthOfTextAtSize("ADMIT ONE", 10))

  // ── Event title (may wrap) ────────────────────────────────────────────
  cursorY -= 46
  const titleSize = 30
  const titleMaxWidth = PAGE_W - marginX * 2 - 180 // reserve right side for QR
  const titleLines = wrap(t.eventTitle, serifBold, titleSize, titleMaxWidth, 2)
  for (const line of titleLines) {
    page.drawText(line, {
      x: marginX,
      y: cursorY,
      size: titleSize,
      font: serifBold,
      color: COLOR.ink,
    })
    cursorY -= titleSize + 4
  }

  // ── Event date/time/venue (all italic-ish via serif regular) ──────────
  cursorY -= 12
  const dateStr = formatDate(t.eventDate)
  page.drawText(dateStr, {
    x: marginX,
    y: cursorY,
    size: 13,
    font: serif,
    color: COLOR.bodyMuted,
  })
  cursorY -= 18
  const timeStr = `${t.eventStartTime} — ${t.eventEndTime}`
  page.drawText(timeStr, {
    x: marginX,
    y: cursorY,
    size: 13,
    font: serif,
    color: COLOR.bodyMuted,
  })
  if (t.venueName) {
    cursorY -= 18
    const venueStr = t.venueCity ? `${t.venueName}, ${t.venueCity}` : t.venueName
    page.drawText(truncate(venueStr, sans, 12, titleMaxWidth), {
      x: marginX,
      y: cursorY,
      size: 12,
      font: sans,
      color: COLOR.bodyMuted,
    })
  }

  // ── QR code, top-right ────────────────────────────────────────────────
  // Encoded value = booking ID. Scanned at venue check-in (future work);
  // the scanner authenticates the lookup server-side, so we don't need
  // to sign anything client-side.
  const qrPngBytes = await QRCode.toBuffer(t.bookingId, {
    type: "png",
    width: 320, // rendered at 320 for crisp print; drawn much smaller
    margin: 1,
    color: {
      dark: "#0E0C0A",
      light: "#F7F3EE",
    },
  })
  const qrImage = await doc.embedPng(qrPngBytes)
  const qrDrawSize = 130
  const qrX = PAGE_W - marginX - qrDrawSize
  const qrY = PAGE_H - 60 - 32 - qrDrawSize + 8 // sits below tagline
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrDrawSize,
    height: qrDrawSize,
  })
  // Caption under QR
  const qrCaption = "Scan at the door"
  const qrCaptionWidth = sans.widthOfTextAtSize(qrCaption, 9)
  page.drawText(qrCaption, {
    x: qrX + qrDrawSize / 2 - qrCaptionWidth / 2,
    y: qrY - 14,
    size: 9,
    font: sans,
    color: COLOR.bodyMuted,
  })

  // ── Divider ───────────────────────────────────────────────────────────
  cursorY -= 36
  drawHairline(page, marginX, cursorY, PAGE_W - marginX * 2)

  // ── Details grid: attendee / seats / amount / booking id ──────────────
  cursorY -= 30
  const col1X = marginX
  const col2X = marginX + 200
  drawDetail(page, sansBold, sans, col1X, cursorY, "ATTENDEE", t.attendeeName)

  // Amount displayed on the ticket. When a booking fee was applied,
  // break it out honestly so the attendee sees where the money went.
  // When there's no fee, just show "AMOUNT PAID" like before.
  if (t.bookingFeeAmount > 0) {
    drawDetail(
      page,
      sansBold,
      sans,
      col2X,
      cursorY,
      "TICKET",
      `INR ${t.subtotalAmount.toLocaleString("en-IN")}`
    )
  } else {
    drawDetail(
      page,
      sansBold,
      sans,
      col2X,
      cursorY,
      "AMOUNT PAID",
      t.totalAmount > 0 ? `INR ${t.totalAmount.toLocaleString("en-IN")}` : "Free entry"
    )
  }
  cursorY -= 54

  const seatSummary = Object.entries(t.seats)
    .filter(([, q]) => Number(q) > 0)
    .map(([s, q]) => `${s} x ${q}`)
    .join(", ")
  drawDetail(page, sansBold, sans, col1X, cursorY, "SEATS", seatSummary || "General")
  if (t.bookingFeeAmount > 0) {
    drawDetail(
      page,
      sansBold,
      sans,
      col2X,
      cursorY,
      "BOOKING FEE",
      `INR ${t.bookingFeeAmount.toLocaleString("en-IN")}`
    )
  } else {
    drawDetail(page, sansBold, sans, col2X, cursorY, "PURCHASED",
      formatDate(t.purchasedAt)
    )
  }
  cursorY -= 54

  // If we had to sacrifice PURCHASED above to fit BOOKING FEE, show
  // TOTAL PAID + PURCHASED on this row instead of just BOOKING ID.
  if (t.bookingFeeAmount > 0) {
    drawDetail(
      page,
      sansBold,
      sans,
      col1X,
      cursorY,
      "TOTAL PAID",
      `INR ${t.totalAmount.toLocaleString("en-IN")}`
    )
    drawDetail(page, sansBold, sans, col2X, cursorY, "PURCHASED",
      formatDate(t.purchasedAt)
    )
    cursorY -= 54
  }

  drawDetail(page, sansBold, sans, col1X, cursorY, "BOOKING ID", t.bookingId, 9)

  // ── Bottom band: house rules / footer ─────────────────────────────────
  const footerY = 90
  drawHairline(page, marginX, footerY + 46, PAGE_W - marginX * 2)

  const rulesLines = [
    "Present this ticket at the venue. Screen or print is fine.",
    "Doors typically open 15 minutes before showtime.",
    "Non-transferable. One entry per booking, up to the seat count shown above.",
  ]
  let ry = footerY + 30
  for (const line of rulesLines) {
    page.drawText(line, {
      x: marginX,
      y: ry,
      size: 9,
      font: sans,
      color: COLOR.bodyMuted,
    })
    ry -= 12
  }

  // Very bottom brand line
  page.drawText("aforaudience.com  ·  info@aforaudience.com", {
    x: marginX,
    y: 40,
    size: 9,
    font: sans,
    color: COLOR.bodyMuted,
  })
  const rightSlug = "Where art finds its crowd."
  const rightSlugWidth = serif.widthOfTextAtSize(rightSlug, 10)
  page.drawText(rightSlug, {
    x: PAGE_W - marginX - rightSlugWidth,
    y: 40,
    size: 10,
    font: serif,
    color: COLOR.ember,
  })

  return await doc.save()
}

// ── helpers ─────────────────────────────────────────────────────────────

function drawHairline(page: PDFPage, x: number, y: number, w: number) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: 0.6,
    color: COLOR.mist,
  })
}

function drawUnderline(page: PDFPage, x: number, y: number, w: number) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: 1.4,
    color: COLOR.ember,
  })
}

function drawDetail(
  page: PDFPage,
  labelFont: PDFFont,
  valueFont: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
  valueSize = 13
) {
  page.drawText(label, {
    x,
    y: y + 20,
    size: 8,
    font: labelFont,
    color: COLOR.ember,
  })
  page.drawText(truncate(value, valueFont, valueSize, 240), {
    x,
    y,
    size: valueSize,
    font: valueFont,
    color: COLOR.ink,
  })
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const w of words) {
    const trial = current ? current + " " + w : w
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      if (current) lines.push(current)
      current = w
      if (lines.length === maxLines - 1) break
    } else {
      current = trial
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  // If we truncated, ellipsis on the last line.
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]
    if (font.widthOfTextAtSize(last + "…", size) > maxWidth) {
      lines[maxLines - 1] = truncate(last, font, size, maxWidth)
    }
  }
  return lines.length ? lines : [text]
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let s = text
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxWidth) {
    s = s.slice(0, -1)
  }
  return s + "…"
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
