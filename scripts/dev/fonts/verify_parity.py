"""Glyph-parity check: reference woff2 files vs the ones in src/fonts/ (or --new-dir).

Usage:
  python scripts/dev/fonts/verify_parity.py [--ref-git REV | --ref-dir DIR] [--new-dir DIR] [--only "Family|style"]

Reference defaults to git HEAD's src/fonts/, so after rebuilding into the
working tree this compares "before" (committed) with "after" (rebuilt).
For every font in fonts.json, every codepoint the reference maps, at every
weight in fonts.json:
  1. the new file maps the codepoint,
  2. decomposed outline identical (coordinates rounded to 1/100 unit),
  3. advance width identical.
Then HarfBuzz shaping, glyph outlines + advances + offsets run by run, of
(a) each font's full codepoint string and (b) for the Noto families, every
string in src/lib/i18n/dictionaries/<locale>.ts (the runs of characters the
font maps above U+007F). Then hhea / OS/2 vertical metrics and unitsPerEm.

A rebuild at the same upstream version must report 0 differences. After a
version upgrade differences are expected: read them, then look at the
pages that use the font before committing. Exits 1 if anything differs.
"""
import argparse
import io
import os
import re
import subprocess
import sys

import uharfbuzz as hb
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

from common import FONTS_DIR, REPO, bytes_io, key, load_config, read_ref_bytes

METRICS = [("head", "unitsPerEm"), ("hhea", "ascent"), ("hhea", "descent"), ("hhea", "lineGap"),
           ("OS/2", "sTypoAscender"), ("OS/2", "sTypoDescender"), ("OS/2", "sTypoLineGap"),
           ("OS/2", "usWinAscent"), ("OS/2", "usWinDescent"), ("OS/2", "fsSelection")]


class F:
    def __init__(self, data):
        self.tt = TTFont(bytes_io(data), lazy=False)
        buf = io.BytesIO()
        self.tt.flavor = None
        self.tt.save(buf)
        self.blob = hb.Blob(buf.getvalue())
        self.cmap = self.tt.getBestCmap()
        self.order = self.tt.getGlyphOrder()
        self.var = "fvar" in self.tt
        self.cache = {}

    def outline(self, name, w):
        k = (name, w)
        if k not in self.cache:
            g = self.tt.getGlyphSet(location={"wght": w} if self.var else None)
            pen = DecomposingRecordingPen(g)
            g[name].draw(pen)
            rec = tuple((op, tuple((round(x, 2), round(y, 2)) for x, y in args)) for op, args in pen.value)
            self.cache[k] = (rec, round(g[name].width, 2))
        return self.cache[k]

    def shape(self, text, w):
        font = hb.Font(hb.Face(self.blob))
        if self.var:
            font.set_variations({"wght": w})
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(font, buf, {})
        return [(self.outline(self.order[i.codepoint], w)[0], p.x_advance, p.x_offset, p.y_offset)
                for i, p in zip(buf.glyph_infos, buf.glyph_positions)]


def dict_strings(locale):
    path = os.path.join(REPO, "src", "lib", "i18n", "dictionaries", f"{locale}.ts")
    src = open(path, encoding="utf8").read()
    return sorted({s for pair in re.findall(r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'', src) for s in pair if s})


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ref-git")
    p.add_argument("--ref-dir")
    p.add_argument("--new-dir", default=FONTS_DIR)
    p.add_argument("--only", action="append", default=[])
    a = p.parse_args()

    total = 0
    for font in load_config()["fonts"]:
        k = key(font)
        if a.only and k not in a.only:
            continue
        try:
            old = F(read_ref_bytes(font, a.ref_git, a.ref_dir))
        except (OSError, subprocess.CalledProcessError):
            print(f"SKIP {k}: no reference file (new family?)")
            continue
        with open(os.path.join(a.new_dir, font["out"]), "rb") as fh:
            new = F(fh.read())
        errs = []
        n_cp = n_shape = 0
        cps = sorted(old.cmap)
        for w in font["weights"]:
            for cp in cps:
                if cp not in new.cmap:
                    if w == font["weights"][0]:
                        errs.append(f"U+{cp:04X} missing")
                    continue
                if old.outline(old.cmap[cp], w) != new.outline(new.cmap[cp], w):
                    errs.append(f"U+{cp:04X} w{w} outline/advance differs")
                n_cp += 1
            text = "".join(chr(c) for c in cps if c >= 0x20 and c != 0x7F and not 0x80 <= c <= 0x9F and c in new.cmap)
            if old.shape(text, w) != new.shape(text, w):
                errs.append(f"w{w} full-codepoint-string shaping differs")
            n_shape += 1
        if font["locale"]:
            script = "".join(re.escape(chr(c)) for c in cps if c > 0x7F)
            runs = sorted({r for s in dict_strings(font["locale"]) for r in re.findall(f"[{script}]+", s)})
            for w in font["weights"]:
                for run in runs:
                    if old.shape(run, w) != new.shape(run, w):
                        errs.append(f"w{w} shaping differs: {run!r}")
                    n_shape += 1
        for table, field in METRICS:
            ov, nv = getattr(old.tt[table], field), getattr(new.tt[table], field)
            if ov != nv:
                errs.append(f"{table}.{field} {ov} -> {nv}")
        added = sorted(set(new.cmap) - set(old.cmap))
        total += len(errs)
        note = f", {len(added)} codepoint(s) added" if added else ""
        print(f"{'PASS' if not errs else 'FAIL'} {k}: {n_cp} codepoint x weight checks, {n_shape} shaping runs{note}, {len(errs)} difference(s)")
        for e in errs[:12]:
            print(f"    {e}")
        if len(errs) > 12:
            print(f"    ... {len(errs) - 12} more")
    print(f"TOTAL DIFFERENCES: {total}")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
