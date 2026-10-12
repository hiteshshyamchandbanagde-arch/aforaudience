from decimal import Decimal as D, ROUND_HALF_UP

GST = D("0.18")
TCS = D("0.005")
TDS = D("0.001")
AFA_FEE = D("20")


def r(x):
    return x.quantize(D("0.01"), rounding=ROUND_HALF_UP)


def inr(x):
    x = r(D(x))
    neg = x < 0
    s = f"{abs(x):,.2f}"
    # Indian grouping
    whole, frac = s.replace(",", "").split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return ("-" if neg else "") + whole + "." + frac


def sale(base, registered, taxable=True, tds_applies=True, afa_fee=False):
    """One sale through AFA. base = seller's price before GST.
    registered: seller GST-registered. taxable: supply not exempt.
    tds_applies: seller not covered by the Rs 5 lakh individual exemption.
    Returns dict of all amounts."""
    base = D(base)
    gst = r(base * GST) if (registered and taxable) else D("0")
    tcs = r(base * TCS) if (registered and taxable) else D("0")
    tds = r(base * TDS) if tds_applies else D("0")
    fee = AFA_FEE if afa_fee else D("0")
    fee_gst = r(fee * GST)
    buyer_pays = base + gst + fee + fee_gst
    seller_gross = base + gst
    payout = seller_gross - tcs - tds
    return dict(base=base, gst=gst, cgst=r(gst / 2), sgst=gst - r(gst / 2), tcs=tcs, tds=tds,
                fee=fee, fee_gst=fee_gst, buyer_pays=buyer_pays, seller_gross=seller_gross,
                payout=payout, afa_keeps=fee)


if __name__ == "__main__":
    cases = [
        ("S1 venue reg", 6000, True, True, True, False),
        ("S1 venue unreg", 6000, False, True, True, False),
        ("S2 499 reg", 499, True, True, True, False),
        ("S2 501 reg", 501, True, True, True, False),
        ("S2 499 unreg", 499, False, True, True, False),
        ("S3 490 reg", 490, True, True, True, False),
        ("S3 510 reg", 510, True, True, True, False),
        ("S4 497 reg exempt", 497, True, False, True, True),
        ("S4 497 reg taxable", 497, True, True, True, True),
        ("S4 503 reg", 503, True, True, True, True),
        ("S4 497 unreg", 497, False, True, True, True),
        ("S4 503 unreg", 503, False, True, True, True),
    ]
    for name, b, reg, tx, td, fee in cases:
        s = sale(b, reg, tx, td, fee)
        print(name, {k: inr(v) for k, v in s.items()})
