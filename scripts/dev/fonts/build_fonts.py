"""Build the self-hosted woff2 files in src/fonts/ (BUG-2609-062).

Usage:
  python scripts/dev/fonts/build_fonts.py <workdir> [--out DIR] [--ref-git REV | --ref-dir DIR]
                                          [--only "Family|style"] [--add "Family|style=U+XXXX,U+YYYY-ZZZZ"]

<workdir>/src/ holds the upstream TTFs (fetch_sources.py puts them there).
For each font in fonts.json: pin wdth to 100, limit wght to the served range,
subset to the codepoint set, unhinted, woff2, into --out (default src/fonts).

The codepoint set is the cmap of the current file for that font, read from
git (--ref-git, default HEAD) or a folder (--ref-dir). Those cmaps are
exactly the sets Google's served files rendered when these were first built
(for Noto: the script file's full cmap, which includes U+0020). --add grows
a set; it can be repeated. A new Noto codepoint also needs adding to that
family's unicodeRange in src/app/layout.tsx (the script prints the range).

Run with PYTHONHASHSEED=0 for reproducible bytes: the source's head.modified
is kept, so the same inputs give byte-identical woff2 files.
"""
import argparse
import io
import os
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

from common import FONTS_DIR, bytes_io, key, load_config, parse_codepoints, read_ref_bytes, source_name, to_unicode_range


def instance(f, wght):
    """wdth -> 100, wght -> the served range. Skipped when that's a no-op:
    re-running the instancer re-optimises gvar and drifts outlines by
    fractions of a unit (caught by the parity check)."""
    if "fvar" not in f:
        return f
    limits = {}
    for a in f["fvar"].axes:
        if a.axisTag == "wdth":
            limits["wdth"] = 100
        elif a.axisTag == "wght":
            limits["wght"] = instancer.AxisTriple(wght[0], a.defaultValue, wght[1]) if a.defaultValue >= wght[0] else (wght[0], wght[1])
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in f["fvar"].axes}
    if "wdth" not in axes and axes.get("wght") == tuple(map(float, wght)):
        limits = None
    if limits:
        f = instancer.instantiateVariableFont(f, limits)
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return TTFont(buf, lazy=False, recalcTimestamp=False)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("workdir")
    p.add_argument("--out", default=FONTS_DIR)
    p.add_argument("--ref-git")
    p.add_argument("--ref-dir")
    p.add_argument("--only", action="append", default=[])
    p.add_argument("--add", action="append", default=[])
    a = p.parse_args()
    if os.environ.get("PYTHONHASHSEED") != "0":
        print("warning: PYTHONHASHSEED is not 0, output bytes may not be reproducible", file=sys.stderr)

    additions = {}
    for spec in a.add:
        fam, _, cps = spec.partition("=")
        additions.setdefault(fam, set()).update(parse_codepoints(cps))

    for font in load_config()["fonts"]:
        k = key(font)
        if a.only and k not in a.only:
            continue
        try:
            ref_cps = set(TTFont(bytes_io(read_ref_bytes(font, a.ref_git, a.ref_dir))).getBestCmap().keys())
        except (OSError, subprocess.CalledProcessError):
            if not additions.get(k):
                sys.exit(f"{k}: no current file to read a codepoint set from; give one with --add")
            print(f"{k}: no current file, codepoint set is --add only")
            ref_cps = set()
        cps = ref_cps | additions.get(k, set())

        f = TTFont(os.path.join(a.workdir, "src", source_name(font)), lazy=False, recalcTimestamp=False)
        if font["wght"]:
            f = instance(f, font["wght"])

        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.name_languages = ["*"]
        opts.hinting = False
        opts.notdef_outline = True
        opts.glyph_names = False
        opts.flavor = "woff2"
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=cps)
        sub.subset(f)

        dest = os.path.join(a.out, font["out"])
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        f.flavor = "woff2"
        f.recalcTimestamp = False  # keep the source's head.modified: reproducible bytes
        f.save(dest)

        got = set(TTFont(dest).getBestCmap().keys())
        missing = sorted(cps - got)
        line = f"{font['out']}: {os.path.getsize(dest)} bytes, {len(got)} codepoints"
        if missing:
            line += f", NOT IN SOURCE: {', '.join(f'U+{c:04X}' for c in missing[:10])}"
        print(line)
        if additions.get(k) and font["locale"]:
            print(f"  add to layout.tsx unicodeRange for {font['family']}: {to_unicode_range(additions[k])}")


if __name__ == "__main__":
    main()
