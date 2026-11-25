import sys
from decimal import Decimal as D
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether)
from ca_pdf_calc import sale, inr, r

OUT = sys.argv[1]

ss = getSampleStyleSheet()
INK = colors.HexColor("#1d1d1f")
MUTED = colors.HexColor("#555555")
ACCENT = colors.HexColor("#8a3b12")
HEAD_BG = colors.HexColor("#efe7df")
GRID = colors.HexColor("#c9c2ba")
NOTE_BG = colors.HexColor("#f7f4f0")

H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=19,
                    textColor=INK, spaceBefore=10, spaceAfter=6)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15,
                    textColor=ACCENT, spaceBefore=8, spaceAfter=4)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=10, leading=13,
                    textColor=INK, spaceBefore=6, spaceAfter=3)
B = ParagraphStyle("B", parent=ss["BodyText"], fontName="Helvetica", fontSize=9, leading=12.2,
                   textColor=INK, spaceAfter=4)
SM = ParagraphStyle("SM", parent=B, fontSize=8, leading=10.4, textColor=MUTED)
BUL = ParagraphStyle("BUL", parent=B, leftIndent=12, bulletIndent=2, spaceAfter=2)
CELL = ParagraphStyle("CELL", parent=B, fontSize=7.8, leading=9.6, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
CELLR = ParagraphStyle("CELLR", parent=CELL, alignment=2)
CELLRB = ParagraphStyle("CELLRB", parent=CELLR, fontName="Helvetica-Bold")
TITLE = ParagraphStyle("TITLE", parent=H1, fontSize=19, leading=24, spaceAfter=4)


def P(t, st=B):
    return Paragraph(t, st)


def bullets(items):
    return [Paragraph(t, BUL, bulletText="•") for t in items]


def table(rows, widths, header=True, num_cols=(), bold_cols=()):
    data = []
    for i, row in enumerate(rows):
        out = []
        for j, c in enumerate(row):
            if isinstance(c, str):
                if header and i == 0:
                    st = CELLB if j not in num_cols else CELLRB
                elif j in num_cols:
                    st = CELLRB if j in bold_cols else CELLR
                else:
                    st = CELLB if j in bold_cols else CELL
                out.append(Paragraph(c, st))
            else:
                out.append(c)
        data.append(out)
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), HEAD_BG))
    t.setStyle(TableStyle(style))
    return t


def note(text):
    t = Table([[Paragraph(text, SM)]], colWidths=[174 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NOTE_BG),
                           ("BOX", (0, 0), (-1, -1), 0.4, GRID),
                           ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return t


W = 174 * mm  # usable width


def money_table(rows_spec, with_fee=False):
    """rows_spec: list of (label, status, kwargs-for-sale)."""
    if with_fee:
        hdr = ["Example", "Seller", "Ticket price", "GST on ticket", "AFA fee + GST", "Buyer pays",
               "TCS 0.5%", "TDS 0.1%", "Payout to seller"]
        widths = [16 * mm, 30 * mm, 17 * mm, 18 * mm, 19 * mm, 18 * mm, 16 * mm, 16 * mm, 24 * mm]
    else:
        hdr = ["Example", "Seller", "Price", "GST 18%", "Buyer pays", "TCS 0.5%", "TDS 0.1%",
               "Payout to seller"]
        widths = [18 * mm, 40 * mm, 18 * mm, 18 * mm, 20 * mm, 18 * mm, 18 * mm, 24 * mm]
    rows = [hdr]
    for label, status, kw in rows_spec:
        s = sale(**kw)
        if with_fee:
            rows.append([label, status, inr(s["base"]), inr(s["gst"]),
                         f"{inr(s['fee'])} + {inr(s['fee_gst'])}", inr(s["buyer_pays"]),
                         inr(s["tcs"]), inr(s["tds"]), inr(s["payout"])])
        else:
            rows.append([label, status, inr(s["base"]), inr(s["gst"]), inr(s["buyer_pays"]),
                         inr(s["tcs"]), inr(s["tds"]), inr(s["payout"])])
    nc = tuple(range(2, len(hdr)))
    return table(rows, widths, num_cols=nc, bold_cols=(len(hdr) - 1,))


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm,
                      "AforAudience - GST, TCS, TDS and refund treatment: assumptions and questions for CA - draft 11 Oct 2026")
    canvas.drawRightString(192 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


story = []

# ---------------- Title ----------------
story += [
    P("AforAudience (AFA)", ParagraphStyle("k", parent=SM, fontSize=9, textColor=ACCENT)),
    P("GST, TCS, TDS and refund treatment<br/>Assumptions and questions for our CA", TITLE),
    P("Prepared by AFA management, Pune, 11 October 2026. All amounts in INR. Draft for CA validation; "
      "this is our working understanding, not tax advice. Please mark each assumption Agree / Disagree "
      "and answer the questions in Section 9.", SM),
    Spacer(1, 6),
]

story.append(P("Summary", H2))
story += bullets([
    "<b>Money flow:</b> every payment on AFA is collected into AFA's Razorpay merchant account, settled to AFA's "
    "current account, held, and paid out to the seller 7 days after the show, net of TCS and TDS.",
    "<b>AFA's only income</b> is an audience booking fee of INR 20 + 18% GST per ticket booking. Venue owners, "
    "organisers and artists pay AFA nothing.",
    "<b>GST on each sale belongs to the seller.</b> AFA adds it to the price only when the seller has a GSTIN. "
    "AFA never pays GST on behalf of an unregistered seller.",
    "<b>AFA's tax duties as e-commerce operator:</b> collect TCS of 0.5% (CGST section 52) on taxable sales by "
    "GST-registered sellers; deduct TDS of 0.1% (Income-tax section 194-O) on sales by every resident seller, "
    "unless exempt.",
    "<b>Highest-risk open points:</b> (1) AFA's status as a marketplace merchant, not a payment aggregator; "
    "(2) whether INR 500-or-less stand-up / open-mic tickets are GST-exempt; (3) whether AFA must register in "
    "every state where a seller is GST-registered.",
])

# ---------------- 1. Business ----------------
story.append(P("1. The business and the money flow", H1))
story.append(P("AFA is a website and app for live shows in Pune, Maharashtra (stand-up comedy, open mic, theatre, "
               "music, poetry). It is a marketplace with four kinds of booking:", B))
story.append(table([
    ["#", "Booking on AFA", "Buyer (pays)", "Seller (is paid)", "AFA fee"],
    ["1", "Venue hire, e.g. 3 hours", "Organiser", "Venue owner", "None"],
    ["2", "Open-mic spot (pay-to-perform)", "Artist", "Organiser", "None"],
    ["3", "Celebrity / paid artist gig", "Organiser", "Artist", "None"],
    ["4", "Event ticket", "Audience member", "Organiser", "INR 20 + GST, paid by the audience"],
], [8 * mm, 52 * mm, 34 * mm, 34 * mm, 46 * mm]))
story.append(Spacer(1, 4))
story.append(P("<b>Flow for every booking:</b> buyer pays on AFA checkout (Razorpay) &rarr; Razorpay settles the full "
               "amount to AFA's current account in about 2 working days &rarr; AFA holds it &rarr; 7 days after the "
               "show AFA pays the seller (RazorpayX Payouts / bank transfer) after deducting TCS and TDS &rarr; AFA "
               "keeps only its audience fee.", B))
story.append(note("Why not split at Razorpay: Razorpay Route (split settlement) is available only to merchants with "
                  "domestic turnover above INR 40 lakh, under the RBI Payment Aggregator Directions, 2025. This limit "
                  "applies to every payment aggregator, not only Razorpay. Until AFA crosses INR 40 lakh, the split is "
                  "done by AFA after settlement. The same Directions include marketplaces in the definition of "
                  "\"merchant\", so a payment aggregator may settle to AFA as a marketplace."))

# ---------------- 2. Assumptions ----------------
story.append(P("2. Assumptions (please mark Agree / Disagree)", H1))
assumptions = [
    ("A1", "Payments", "AFA is a marketplace merchant of Razorpay, not a payment aggregator, provided it pays out only to "
     "KYC-verified sellers, only for bookings made on AFA, on a fixed schedule written in a seller agreement that "
     "appoints AFA as the seller's agent to collect."),
    ("A2", "Payments", "Seller money held by AFA is a liability (payable to sellers) in AFA's books, not AFA revenue. "
     "Only the INR 20 fee is AFA revenue."),
    ("A3", "GST - AFA", "AFA is an electronic commerce operator (CGST section 2(45)) and must take GST registration before "
     "the first paid booking, irrespective of turnover, because it must collect TCS (section 24)."),
    ("A4", "GST - AFA", "AFA's audience fee is AFA's own supply, taxable at 18%. It is shown separately: INR 20 + INR 3.60 "
     "GST = INR 23.60 per booking. The buyer may lower it, even to 0; GST is on the amount actually charged."),
    ("A5", "GST - seller", "GST on the venue hire, spot fee, artist fee and ticket is the seller's liability. Rate 18% "
     "when taxable. AFA adds it to the buyer's price only if the seller has given a GSTIN."),
    ("A6", "GST - seller", "Section 9(5) does not apply: venue hire, event admission, spot fees and artist fees are not "
     "notified services, so AFA never pays GST on behalf of an unregistered seller."),
    ("A7", "GST - seller", "An unregistered seller with aggregate turnover up to INR 20 lakh may supply services through "
     "AFA without registering (Notification 65/2017-CT). The seller, not AFA, monitors the threshold. AFA takes a "
     "self-declaration at onboarding."),
    ("A8", "GST - ticket", "Admission up to INR 500 per person to a circus, dance or theatrical performance including drama "
     "or ballet is exempt (Notification 12/2017-CT(R)). Above INR 500: 18% on the full price. Whether stand-up "
     "comedy and open mic count as \"theatrical performance\" is open (Q4)."),
    ("A9", "GST - ticket", "AFA's INR 20 fee is a separate supply and is not added to the ticket price when testing the "
     "INR 500 limit."),
    ("A10", "GST - spot fee", "The INR 500 exemption does not apply to an artist's spot fee: it is not admission. The spot "
     "fee is taxable at 18% when the organiser is registered, at any amount."),
    ("A11", "GST - artist", "The artist exemption (folk or classical music, dance or theatre, up to INR 1.5 lakh per "
     "performance) does not cover stand-up comedy or a celebrity gig. The INR 500 level has no effect on the "
     "artist fee."),
    ("A12", "GST - venue", "Hourly hire of a hall is renting of non-residential immovable property, 18%. If the venue owner "
     "is unregistered and the organiser is GST-registered (not composition), the organiser pays 18% under reverse "
     "charge (Notification 09/2024-CT(R), from 10 Oct 2024)."),
    ("A13", "TCS", "AFA collects TCS of 0.5% (0.25% CGST + 0.25% SGST, or 0.5% IGST) on the net value of taxable supplies "
     "(excluding GST) made through AFA by GST-registered sellers. No TCS on exempt supplies or on supplies by "
     "unregistered sellers. Filed in GSTR-8 by the 10th of the next month."),
    ("A14", "TDS", "AFA deducts TDS of 0.1% under section 194-O on the gross amount of each resident seller's sales, "
     "excluding GST shown separately, at the time of payout or credit to the seller, whichever is earlier."),
    ("A15", "TDS", "No TDS for an individual or HUF seller who has given PAN or Aadhaar and whose gross sales through AFA "
     "in the financial year do not exceed INR 5 lakh. Seller without PAN or Aadhaar: 5% (section 206AA)."),
    ("A16", "TDS", "Once TDS is deducted under 194-O, the organiser has no separate TDS duty (e.g. 194J/194C) on the same "
     "payment (section 194-O(3))."),
    ("A17", "Sellers", "PAN and Indian bank account are mandatory for every seller of a paid booking. GSTIN is optional "
     "(entered if held)."),
    ("A18", "Rounding", "Examples are per booking, rounded to the paisa (half up). Actual GSTR-8 and 26Q figures are "
     "computed on monthly totals."),
]
story.append(table([["No.", "Area", "Assumption", "CA: Agree / Disagree"]] +
                   [[a, b, c, ""] for a, b, c in assumptions],
                   [11 * mm, 22 * mm, 116 * mm, 25 * mm]))

# ---------------- 3. How to read ----------------
story.append(P("3. How the scenario tables work", H1))
story += bullets([
    "<b>Buyer pays</b> = price + GST (if the seller is registered and the supply is taxable) + AFA fee and its GST "
    "(tickets only).",
    "<b>Payout to seller</b> = price + GST collected for the seller - TCS - TDS. The seller then pays its own GST to "
    "the government and claims the TCS and TDS as credits.",
    "Tables assume a seller based in Maharashtra (CGST + SGST) who is <b>not</b> covered by the INR 5 lakh TDS "
    "exemption. If the exemption applies, TDS = 0 and the payout rises by the TDS shown. Without PAN, TDS is 5%.",
    "Event location in every scenario: Pune, Maharashtra. Sellers from other states and from outside India are in "
    "Section 5.",
])

# ---------------- 4. Scenarios ----------------
story.append(PageBreak())
story.append(P("4. The four scenarios (seller based in Maharashtra)", H1))

# S1
s1r = sale(6000, True)
s1u = sale(6000, False)
story.append(P("Scenario 1: Organiser pays venue owner (INR 6,000 for 3 hours)", H2))
story.append(money_table([
    ("6,000", "Venue owner GST-registered", dict(base=6000, registered=True)),
    ("6,000", "Venue owner not registered", dict(base=6000, registered=False)),
]))
story.append(Spacer(1, 3))
story += bullets([
    f"<b>Registered venue:</b> GST INR {inr(s1r['gst'])} = CGST {inr(s1r['cgst'])} + SGST {inr(s1r['sgst'])}. "
    f"TCS INR {inr(s1r['tcs'])}. TDS INR {inr(s1r['tds'])}. AFA pays the venue INR {inr(s1r['payout'])}. "
    "The organiser can claim input tax credit of INR 1,080.00 if registered.",
    f"<b>Unregistered venue:</b> no GST from the venue, no TCS. TDS INR {inr(s1u['tds'])} (0 if the INR 5 lakh "
    f"exemption applies). AFA pays INR {inr(s1u['payout'])}. <b>If the organiser is GST-registered</b> "
    "(not composition), the organiser itself pays INR 1,080.00 under reverse charge and claims it back as input "
    "credit. AFA has no role in that payment.",
    "No TDS-exempt case for a company or firm venue: TDS INR 6.00 always. No PAN: TDS INR 300.00 (5%).",
    "AFA fee: none. AFA still bears the payment gateway charge on INR 7,080 / 6,000 (see Section 7, item 1).",
])

# S2
story.append(P("Scenario 2: Artist pays organiser for an open-mic spot (INR 499 and INR 501)", H2))
story.append(money_table([
    ("499", "Organiser GST-registered", dict(base=499, registered=True)),
    ("501", "Organiser GST-registered", dict(base=501, registered=True)),
    ("499", "Organiser not registered", dict(base=499, registered=False)),
    ("501", "Organiser not registered", dict(base=501, registered=False)),
]))
story.append(Spacer(1, 3))
story += bullets([
    "<b>The INR 500 level makes no difference here</b> (assumption A10): 499 and 501 are both taxable at 18% when "
    "the organiser is registered, and both carry no GST when the organiser is not registered.",
    "TCS 0.5% only when the organiser is registered (INR 2.50 / 2.51). TDS 0.1% in all four rows (INR 0.50), "
    "or 0 if the organiser is an individual within the INR 5 lakh exemption.",
    "AFA fee: none.",
])

# S3
story.append(P("Scenario 3: Organiser pays a celebrity / paid artist (INR 490 and INR 510)", H2))
story.append(money_table([
    ("490", "Artist GST-registered", dict(base=490, registered=True)),
    ("510", "Artist GST-registered", dict(base=510, registered=True)),
    ("490", "Artist not registered", dict(base=490, registered=False)),
    ("510", "Artist not registered", dict(base=510, registered=False)),
]))
story.append(Spacer(1, 3))
story += bullets([
    "<b>The INR 500 level makes no difference</b> (A11). The only artist exemption is for folk or classical art "
    "forms up to INR 1.5 lakh per performance; if an artist qualifies, GST and TCS are 0 even when registered.",
    "Registered artist: TCS INR 2.45 / 2.55, TDS INR 0.49 / 0.51. Unregistered: no GST, no TCS; TDS only.",
    "The organiser pays upfront at booking; AFA holds the money and pays the artist 7 days after the show.",
    "AFA fee: none.",
])

# S4
story.append(PageBreak())
story.append(P("Scenario 4: Audience buys a ticket (INR 497 and INR 503) + AFA fee INR 20", H2))
story.append(money_table([
    ("497", "Organiser registered; show exempt (theatre / dance / drama)",
     dict(base=497, registered=True, taxable=False, afa_fee=True)),
    ("497", "Organiser registered; show not exempt (e.g. stand-up, if Q4 = No)",
     dict(base=497, registered=True, taxable=True, afa_fee=True)),
    ("503", "Organiser registered (any show)", dict(base=503, registered=True, afa_fee=True)),
    ("497", "Organiser not registered", dict(base=497, registered=False, afa_fee=True)),
    ("503", "Organiser not registered", dict(base=503, registered=False, afa_fee=True)),
], with_fee=True))
story.append(Spacer(1, 3))
a = sale(497, True, False, afa_fee=True)
b = sale(503, True, afa_fee=True)
story += bullets([
    f"<b>The INR 500 level matters here only.</b> For a registered organiser, INR 497 exempt costs the buyer "
    f"INR {inr(a['buyer_pays'])}; INR 503 costs INR {inr(b['buyer_pays'])} because 18% applies to the full INR 503. "
    "Registered organisers will price at INR 500 or below for exempt show types.",
    "No TCS on an exempt ticket (it is not a taxable supply). TCS INR 2.49 / 2.52 on taxable tickets of a registered "
    "organiser. TDS INR 0.50 in every row, or 0 within the INR 5 lakh exemption.",
    "AFA keeps INR 20.00 and pays INR 3.60 GST on its fee in every row, whatever the organiser's status.",
    "Free events: no ticket price, no AFA fee, no GST, no TCS, no TDS.",
])
story.append(note("Effect of the INR 5 lakh exemption and PAN on TDS (applies to all four scenarios): individual/HUF "
                  "seller with PAN and AFA sales up to INR 5 lakh in the year: TDS 0. Above INR 5 lakh, or a "
                  "company/firm: 0.1%. No PAN or Aadhaar: 5% (e.g. INR 300.00 on the INR 6,000 venue hire, "
                  "INR 24.95 on a INR 499 spot fee)."))

# ---------------- 5. Location ----------------
story.append(P("5. Seller based in Maharashtra, in another Indian state, or outside India", H1))
story.append(P("Place of supply for all four bookings is Pune, Maharashtra: venue hire = location of the property; "
               "event admission = where the event is held; artist performance and spot fee = location of a registered "
               "recipient, otherwise where the event is held (IGST Act section 12).", B))
loc = [
    ["Seller location", "GST on the sale", "TCS by AFA", "TDS by AFA", "Our proposal"],
    ["<b>Maharashtra</b>", "CGST 9% + SGST 9% if registered; none if not", "0.25% CGST + 0.25% SGST if registered",
     "0.1% under 194-O (exemptions as above)", "Allowed from launch"],
    ["<b>Other Indian state</b> (e.g. Bengaluru artist or organiser)",
     "IGST 18% if registered in its home state (seller state differs from place of supply). Unregistered under "
     "INR 20 lakh: none (inter-state service suppliers exempt, Notification 10/2017-IT). <b>Open:</b> an "
     "out-of-state organiser running a paid Pune event may need casual-taxable-person registration in "
     "Maharashtra (section 24(i), no threshold) - Q11.",
     "0.5% IGST if registered. <b>Open:</b> AFA may need GST registration in each state where its sellers are "
     "registered - Q10.",
     "0.1% under 194-O", "Allowed after CA answers Q10-Q11"],
    ["<b>Outside India</b> (e.g. foreign comedian or organiser)",
     "Taxable in India (place of supply Pune). Foreign artist paid by a GST-registered organiser: the organiser "
     "pays 18% under reverse charge (import of service). Foreign organiser selling tickets: compulsory "
     "non-resident taxable person registration (section 24(v)).",
     "Only if the foreign seller is GST-registered in India",
     "194-O does not apply (non-resident). Payment to a non-resident entertainer: TDS 20% + surcharge + cess "
     "(section 194E); remittance needs Form 15CA/15CB and FEMA compliance.",
     "Not on AFA at launch. An Indian organiser may book a foreign artist and pay off-platform."],
]
story.append(table(loc, [27 * mm, 50 * mm, 34 * mm, 34 * mm, 29 * mm]))

# ---------------- 6. Cancellation ----------------
story.append(PageBreak())
story.append(P("6. Cancellation and refund policy", H1))
story.append(P("Policy set by AFA management:", H3))
story += bullets([
    "<b>R1. Audience</b> gets a full refund if the ticket is cancelled at least 15 days before the event.",
    "<b>R2. Venue owner</b> may cancel a confirmed venue booking at least 15 days before the booked date; the organiser "
    "gets a full refund.",
    "<b>R3. Organiser</b> may cancel an event at least 15 days before the event; all buyers (audience tickets and "
    "artist spot fees) get a full refund.",
])
story.append(P("Gaps we have filled with assumptions (please confirm they are lawful):", H3))
story += bullets([
    "<b>R4.</b> \"Full refund\" to the audience includes the AFA fee and its GST (INR 23.60).",
    "<b>R5.</b> Audience cancelling less than 15 days before the event: no refund; the sale stands.",
    "<b>R6.</b> Venue owner or organiser cancelling less than 15 days before: not permitted except force majeure. If it "
    "happens, the buyers still get a full refund (consumer law), and AFA recovers the cost from the cancelling "
    "seller's held or future payouts under the seller agreement.",
    "<b>R7.</b> Organiser cancelling a venue booking, or a celebrity artist cancelling a gig, follows the same 15-day "
    "rule; within 15 days, the canceller bears the refund cost.",
    "<b>R8.</b> Every refund under R1-R3 happens before the payout date (7 days after the show), so the money is "
    "still held by AFA and no TDS has been deducted yet.",
])
story.append(P("Tax treatment of a full refund before payout", H3))
v = sale(6000, True)
t = sale(503, True, afa_fee=True)
story.append(table([
    ["Item", "Seller GST-registered", "Seller not registered"],
    ["Money", f"Buyer gets back everything paid, e.g. INR {inr(v['buyer_pays'])} (venue) or INR {inr(t['buyer_pays'])} "
     "(INR 503 ticket incl. AFA fee)", "Buyer gets back everything paid, e.g. INR 6,000.00 or INR 526.60"],
    ["Seller's GST", "Seller issues a credit note (section 34) for the full value; reduces its output GST",
     "Nothing - no GST was charged"],
    ["AFA fee GST", "AFA issues a credit note for INR 20.00 + 3.60 (tickets only)", "Same"],
    ["TCS", "Reduced in the same month's GSTR-8; if already filed, a negative adjustment in the next GSTR-8",
     "Nil - none was due"],
    ["TDS", "Nil - not yet deducted, because payout had not happened", "Nil"],
    ["Gateway charge", "About 2% + GST of the original payment is not returned by Razorpay; borne as per Section 7, item 1",
     "Same"],
], [27 * mm, 77 * mm, 70 * mm]))
story.append(Spacer(1, 4))
story.append(P("Partial refunds (not in the current policy, but possible as goodwill, e.g. a show cut short):", H3))
story += bullets([
    "Seller issues a credit note for the refunded part only; the part kept remains its taxable supply.",
    "TCS and TDS are computed on the amount kept. If the seller was already paid, AFA recovers the refunded amount "
    "from the next payout; TDS already deducted is adjusted against that seller's later payouts in the same year (Q15).",
])

# ---------------- 7. More conditions ----------------
story.append(P("7. Other conditions", H1))
story += bullets([
    "<b>1. Gateway charges.</b> Razorpay charges about 2% + 18% GST on every payment, and keeps it on refunds. AFA earns "
    "nothing on Scenarios 1-3, so on INR 7,080 of venue hire AFA would bear about INR 167. AFA management will decide "
    "whether the buyer pays a convenience charge, the seller bears it from the payout, or AFA absorbs it. Its GST "
    "treatment is Q16.",
    "<b>2. Composition-scheme sellers</b> cannot charge GST to buyers. We treat them like unregistered sellers for "
    "pricing, but they hold a GSTIN, so TCS may still apply (Q8).",
    "<b>3. Seller self-declaration</b> at onboarding: GSTIN, or a declaration of being unregistered with turnover "
    "under INR 20 lakh, to be updated within 7 days of registering. AFA alerts a seller whose AFA sales pass "
    "INR 15 lakh in a year.",
    "<b>4. Invoices.</b> AFA issues its own tax invoice for the INR 20 fee. For registered sellers, AFA generates the "
    "tax invoice and credit notes in the seller's name and GSTIN (Q13). Unregistered sellers: AFA issues a booking "
    "receipt only.",
    "<b>5. Filings by AFA:</b> GSTR-1 and GSTR-3B (own fee), GSTR-8 (TCS) by the 10th, 26Q (TDS) quarterly, "
    "Form 16A to sellers, annual GSTR-9B.",
    "<b>6. Chargebacks</b> raised by a buyer's bank are treated like a refund; if the seller has been paid, AFA "
    "recovers from future payouts.",
])

# ---------------- 9. AFA decisions ----------------
story.append(P("8. Decisions AFA management will take (not for the CA)", H1))
story += bullets([
    "Who bears the gateway charge in each scenario (Section 7, item 1).",
    "AFA fee shown as INR 20 + GST (assumed here) or INR 20 inclusive of GST (INR 16.95 + INR 3.05).",
    "Penalties, if any, for venue owners, organisers or artists who cancel within 15 days (R6, R7).",
    "Whether venue hire, spot fees and artist fees go live at launch or after ticketing.",
])

# ---------------- 8. Questions ----------------
story.append(PageBreak())
story.append(P("9. Questions for the CA", H1))
story.append(P("Each question states our current assumption. Please write Agree, Disagree, or the correct position "
               "(with the section or notification) in the last column.", B))
qs = [
    ("Q1", "Payments", "With all money settled to AFA's account and paid out to sellers 7 days after the show, is AFA a "
     "marketplace merchant and not a payment aggregator? What must the seller agreement contain to keep it so?", "A1"),
    ("Q2", "Payments", "Is a separate bank account (or escrow) for held seller money required or only advisable?",
     "Advisable, not required"),
    ("Q3", "GST registration", "Must AFA register before the first paid booking, irrespective of turnover?", "A3: Yes"),
    ("Q4", "Ticket GST", "Is admission up to INR 500 exempt for: (a) stand-up comedy, (b) open mic, (c) music concert, "
     "(d) poetry reading, (e) theatre? Has the exemption or the 18% rate changed after 22 Sep 2025?",
     "(e) yes; (a)-(d) unsure"),
    ("Q5", "Ticket GST", "Is the INR 20 AFA fee kept out of the INR 500 test (separate supply by a separate supplier)?",
     "A9: Yes"),
    ("Q6", "Spot fee GST", "Is the open-mic spot fee taxable at 18% at any amount (no INR 500 exemption)? Which SAC?",
     "A10: Yes"),
    ("Q7", "Venue GST", "Is hourly hall hire \"renting of immovable property\", so reverse charge applies when the venue "
     "is unregistered and the organiser registered?", "A12: Yes"),
    ("Q8", "TCS", "Confirm: no TCS on exempt supplies, on unregistered sellers, or on reverse-charge supplies. Does TCS "
     "apply to composition-scheme sellers?", "A13; composition unsure"),
    ("Q9", "AFA fee", "SAC for the AFA fee (9985 or 9983)? Place of supply for an out-of-state buyer: buyer's location "
     "(IGST) or event location?", "9985; buyer's location"),
    ("Q10", "Multi-state", "Must AFA take GST registration in every state where a GST-registered seller is located, in "
     "order to collect TCS?", "Unsure - high impact"),
    ("Q11", "Out-of-state seller", "Must an organiser registered outside Maharashtra take casual-taxable-person "
     "registration in Maharashtra for a paid Pune event?", "Unsure"),
    ("Q12", "Section 9(5)", "Confirm AFA has no section 9(5) liability for any of the four bookings, and that a "
     "self-declaration from unregistered sellers is sufficient protection.", "A6, A7: Yes"),
    ("Q13", "Invoices", "May AFA issue tax invoices and credit notes in a registered seller's name and GSTIN? Can AFA "
     "issue one consolidated fee invoice per day for B2C bookings?", "Yes; per booking"),
    ("Q14", "TDS", "Is 194-O TDS on the price excluding GST? Deducted at payout (credit) time? Confirm the INR 5 lakh "
     "exemption and the 5% no-PAN rate.", "A14, A15: Yes"),
    ("Q15", "Refunds", "Refund after TCS/TDS is filed: negative adjustment in the next GSTR-8; TDS adjusted against the "
     "same seller's later payouts in the year?", "Yes"),
    ("Q16", "Gateway", "If the gateway charge is passed to the buyer as a convenience charge, is it AFA's supply at 18%? "
     "If deducted from the seller's payout, is it AFA's supply to the seller?", "Yes in both cases"),
    ("Q17", "Refund policy", "Are rules R1-R8 lawful under the Consumer Protection (E-Commerce) Rules, 2020, provided "
     "they are shown before payment?", "Yes"),
    ("Q18", "Foreign sellers", "Confirm that excluding foreign sellers from AFA payments keeps AFA clear of section 194E, "
     "section 195 and FEMA remittance obligations.", "Yes"),
    ("Q19", "Registrations", "Besides GSTIN and TAN, what does AFA need before paid bookings (Maharashtra Professional "
     "Tax, Shops and Establishments, other)?", "GSTIN + TAN"),
]
story.append(table([["No.", "Topic", "Question", "Our assumption", "CA reply"]] +
                   [[a, b, c, d, ""] for a, b, c, d in qs],
                   [11 * mm, 22 * mm, 83 * mm, 28 * mm, 30 * mm]))

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                        bottomMargin=16 * mm, title="AforAudience - GST, TCS, TDS: assumptions and questions for CA",
                        author="AforAudience")
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print("ok")
