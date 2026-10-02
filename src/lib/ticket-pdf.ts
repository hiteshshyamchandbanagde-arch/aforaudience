import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, type RGB } from "pdf-lib"
import QRCode from "qrcode"
import { resolveDesignColors, toPdfRgb } from "@/lib/design-tokens.server"

// ---------------------------------------------------------------------------
// Ticket PDF generator.
//
// Design brief: editorial / theater-program feel, not utility / boarding-pass.
// A first ticket is a memorable moment for the audience — the PDF should
// feel like a keepsake. Playfair-esque serif for headings, warm paper
// background, accent-coloured labels, generous whitespace.
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

// GEN-2609-119 - the palette comes from the design tokens, resolved when
// the PDF is generated (pdf-lib has no CSS engine, so no var()). The
// ticket stays a light, printable page: ink on a cream paper, with the
// labels and rules in the primary action colour. Each entry is a pdf-lib
// colour plus an opacity, spread straight into a draw call.
type Paint = { color: RGB; opacity: number }
function paint(value: string, alpha = 1): Paint {
  const p = toPdfRgb(value)
  return { color: rgb(p.r, p.g, p.b), opacity: p.opacity * alpha }
}

// Quieter text and the hairlines are the ink at a lower opacity, so they
// follow an ink edit instead of needing colours of their own. On the
// default cream these land on the old warm grey and divider.
const MUTED_ALPHA = 0.62
const HAIRLINE_ALPHA = 0.064

// The coloured "A" of the wordmark is the logo and keeps its own value.
const LOGO_A = "#C8441A" // token-ok(hex-color-literal): logo, fixed by design
// The QR keeps fixed dark modules on a light ground, whatever the paper
// becomes, so it always scans.
const QR_DARK = "#0E0C0A" // token-ok(hex-color-literal): QR modules, fixed so the code always scans
const QR_LIGHT = "#F7F3EE" // token-ok(hex-color-literal): QR ground, fixed so the code always scans

export const TICKET_PDF_TOKENS = ["--afa-ink", "--afa-cream", "--afa-fill-solid"] as const
export function ticketPdfColorsFrom(c: Record<(typeof TICKET_PDF_TOKENS)[number], string>) {
  return {
    ink: paint(c["--afa-ink"]),
    paper: paint(c["--afa-cream"]),
    accent: paint(c["--afa-fill-solid"]),
    bodyMuted: paint(c["--afa-ink"], MUTED_ALPHA),
    hairline: paint(c["--afa-ink"], HAIRLINE_ALPHA),
    logoA: paint(LOGO_A),
  }
}
export type TicketPdfColors = ReturnType<typeof ticketPdfColorsFrom>
export async function loadTicketPdfColors(): Promise<TicketPdfColors> {
  return ticketPdfColorsFrom(await resolveDesignColors(TICKET_PDF_TOKENS))
}

const PAGE_W = 595 // A4 portrait in points
const PAGE_H = 842

export type TicketData = {
  bookingId: string
  // BUG-2609-053 - printed as TICKET REF (what the customer reads out at
  // the door or quotes to support). The QR still encodes bookingId so
  // tickets issued before this keep scanning; check-in accepts either.
  ticketCode: string | null
  eventTitle: string
  eventDate: Date
  eventStartTime: string
  eventEndTime: string
  venueName: string | null
  venueCity: string | null
  seats: Record<string, number>
  seatLabels?: string[]
  totalAmount: number
  subtotalAmount: number
  bookingFeeAmount: number
  attendeeName: string
  purchasedAt: Date
  // Session 65 (Hitesh feedback) - companion tags for this booking, so
  // anyone who sees the ticket (printed, screenshotted, forwarded) can
  // see who else is expected, same PENDING/ACCEPTED/DECLINED status
  // already shown at checkout. attendeeName above already establishes
  // who booked it (the "main user"); this just lists who's tagged
  // alongside them. Optional/omittable - older TicketData construction
  // sites (if any) don't need to change.
  companions?: { name: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' }[]
}

// `colors` is for callers that already hold a resolved palette; left
// out, the tokens are read here.
export async function generateTicketPdf(t: TicketData, colors?: TicketPdfColors): Promise<Uint8Array> {
  const COLOR = colors ?? (await loadTicketPdfColors())
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
    ...COLOR.paper,
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
    ...COLOR.logoA,
  })
  page.drawText("forAudience", {
    x: marginX + serifBold.widthOfTextAtSize("A", 28) + 2,
    y: cursorY,
    size: 22,
    font: serifBold,
    ...COLOR.ink,
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
    ...COLOR.bodyMuted,
  })

  cursorY -= 20
  drawHairline(page, COLOR, marginX, cursorY, PAGE_W - marginX * 2)

  // ── "Admit One/N" section ─────────────────────────────────────────────
  // BUG-2608-031 - this used to hardcode "ADMIT ONE" regardless of how
  // many seats/tickets the booking actually covers. Same numbered-vs-GA
  // duality used elsewhere (bookings/[id]/companions/route.ts,
  // bookings/my/route.ts): numbered venues count real seatLabels,
  // GA sums the seats quantity map.
  const admitCount =
    t.seatLabels && t.seatLabels.length > 0
      ? t.seatLabels.length
      : Object.values(t.seats || {}).reduce((sum, q) => sum + Number(q || 0), 0) || 1
  const admitText = admitCount <= 1 ? "ADMIT ONE" : `ADMIT ${admitCount}`
  cursorY -= 44
  page.drawText(admitText, {
    x: marginX,
    y: cursorY,
    size: 10,
    font: sansBold,
    ...COLOR.accent,
    // pdf-lib doesn't do letter-spacing natively; workaround via manual
    // char-by-char draw isn't worth it for one line.
  })
  cursorY -= 4
  drawUnderline(page, COLOR, marginX, cursorY, sansBold.widthOfTextAtSize(admitText, 10))

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
      ...COLOR.ink,
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
    ...COLOR.bodyMuted,
  })
  cursorY -= 18
  const timeStr = `${t.eventStartTime} — ${t.eventEndTime}`
  page.drawText(timeStr, {
    x: marginX,
    y: cursorY,
    size: 13,
    font: serif,
    ...COLOR.bodyMuted,
  })
  if (t.venueName) {
    cursorY -= 18
    const venueStr = t.venueCity ? `${t.venueName}, ${t.venueCity}` : t.venueName
    page.drawText(truncate(venueStr, sans, 12, titleMaxWidth), {
      x: marginX,
      y: cursorY,
      size: 12,
      font: sans,
      ...COLOR.bodyMuted,
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
      dark: QR_DARK,
      light: QR_LIGHT,
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
    ...COLOR.bodyMuted,
  })

  // ── Divider ───────────────────────────────────────────────────────────
  cursorY -= 36
  drawHairline(page, COLOR, marginX, cursorY, PAGE_W - marginX * 2)

  // ── Details grid: attendee / seats / amount / booking id ──────────────
  cursorY -= 30
  const col1X = marginX
  const col2X = marginX + 200
  drawDetail(page, COLOR, sansBold, sans, col1X, cursorY, "ATTENDEE", t.attendeeName)

  // Amount displayed on the ticket. When a booking fee was applied,
  // break it out honestly so the attendee sees where the money went.
  // When there's no fee, just show "AMOUNT PAID" like before.
  if (t.bookingFeeAmount > 0) {
    drawDetail(
      page,
      COLOR,
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
      COLOR,
      sansBold,
      sans,
      col2X,
      cursorY,
      "AMOUNT PAID",
      t.totalAmount > 0 ? `INR ${t.totalAmount.toLocaleString("en-IN")}` : "Free entry"
    )
  }
  cursorY -= 54

  const seatSummary = t.seatLabels && t.seatLabels.length > 0
    ? t.seatLabels.join(", ")
    : Object.entries(t.seats)
        .filter(([, q]) => Number(q) > 0)
        .map(([s, q]) => `${s} x ${q}`)
        .join(", ")
  drawDetail(page, COLOR, sansBold, sans, col1X, cursorY, "SEATS", seatSummary || "General")
  if (t.bookingFeeAmount > 0) {
    drawDetail(
      page,
      COLOR,
      sansBold,
      sans,
      col2X,
      cursorY,
      "BOOKING FEE",
      `INR ${t.bookingFeeAmount.toLocaleString("en-IN")}`
    )
  } else {
    drawDetail(page, COLOR, sansBold, sans, col2X, cursorY, "PURCHASED",
      formatDate(t.purchasedAt)
    )
  }
  cursorY -= 54

  // If we had to sacrifice PURCHASED above to fit BOOKING FEE, show
  // TOTAL PAID + PURCHASED on this row instead of just BOOKING ID.
  if (t.bookingFeeAmount > 0) {
    drawDetail(
      page,
      COLOR,
      sansBold,
      sans,
      col1X,
      cursorY,
      "TOTAL PAID",
      `INR ${t.totalAmount.toLocaleString("en-IN")}`
    )
    drawDetail(page, COLOR, sansBold, sans, col2X, cursorY, "PURCHASED",
      formatDate(t.purchasedAt)
    )
    cursorY -= 54
  }

  drawDetail(page, COLOR, sansBold, sans, col1X, cursorY, "TICKET REF", t.ticketCode ?? t.bookingId, t.ticketCode ? 13 : 9)

  // ── Going with (companion tags), if any ─────────────────────────────
  // Only PENDING/ACCEPTED shown - a DECLINED tag means that person isn't
  // coming, so listing them here would read as a guest list rather than
  // "who's actually expected". attendeeName above already establishes
  // who booked this ticket.
  const goingWith = (t.companions ?? []).filter((c) => c.status !== "DECLINED")
  if (goingWith.length > 0) {
    cursorY -= 40
    const goingWithLabel = "GOING WITH"
    page.drawText(goingWithLabel, {
      x: col1X,
      y: cursorY + 14,
      size: 8,
      font: sansBold,
      ...COLOR.accent,
    })
    const goingWithValue = goingWith
      .map((c) => `${c.name} ${c.status === "PENDING" ? "(pending)" : "(confirmed)"}`)
      .join(", ")
    const goingWithLines = wrap(goingWithValue, sans, 11, PAGE_W - marginX * 2, 2)
    let gwy = cursorY - 4
    for (const line of goingWithLines) {
      page.drawText(line, {
        x: col1X,
        y: gwy,
        size: 11,
        font: sans,
        ...COLOR.ink,
      })
      gwy -= 15
    }
  }

  // ── Bottom band: house rules / footer ─────────────────────────────────
  const footerY = 90
  drawHairline(page, COLOR, marginX, footerY + 46, PAGE_W - marginX * 2)

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
      ...COLOR.bodyMuted,
    })
    ry -= 12
  }

  // Very bottom brand line
  page.drawText("aforaudience.com  ·  info@aforaudience.com", {
    x: marginX,
    y: 40,
    size: 9,
    font: sans,
    ...COLOR.bodyMuted,
  })
  const rightSlug = "Where art finds its crowd."
  const rightSlugWidth = serif.widthOfTextAtSize(rightSlug, 10)
  page.drawText(rightSlug, {
    x: PAGE_W - marginX - rightSlugWidth,
    y: 40,
    size: 10,
    font: serif,
    ...COLOR.accent,
  })

  return await doc.save()
}

// ── helpers ─────────────────────────────────────────────────────────────

function drawHairline(page: PDFPage, COLOR: TicketPdfColors, x: number, y: number, w: number) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: 0.6,
    ...COLOR.hairline,
  })
}

function drawUnderline(page: PDFPage, COLOR: TicketPdfColors, x: number, y: number, w: number) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: 1.4,
    ...COLOR.accent,
  })
}

function drawDetail(
  page: PDFPage,
  COLOR: TicketPdfColors,
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
    ...COLOR.accent,
  })
  page.drawText(truncate(value, valueFont, valueSize, 240), {
    x,
    y,
    size: valueSize,
    font: valueFont,
    ...COLOR.ink,
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
