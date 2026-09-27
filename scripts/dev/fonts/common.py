"""Shared helpers for the dev-only font scripts in scripts/dev/fonts/.

Nothing in src/ imports this folder, and neither CI nor the build runs it.
See src/fonts/README.md for how and when to run the scripts.
"""
import io
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
FONTS_DIR = os.path.join(REPO, "src", "fonts")


def load_config():
    with open(os.path.join(HERE, "fonts.json"), encoding="utf8") as f:
        return json.load(f)


def key(font):
    return f"{font['family']}|{font['style']}"


def source_name(font):
    return os.path.basename(font["source"])


def read_ref_bytes(font, ref_git=None, ref_dir=None):
    """The reference woff2 for a font: from a git revision (default) or a directory."""
    if ref_dir:
        with open(os.path.join(ref_dir, font["out"]), "rb") as f:
            return f.read()
    rev = ref_git or "HEAD"
    return subprocess.run(
        ["git", "show", f"{rev}:src/fonts/{font['out']}"],
        cwd=REPO, check=True, capture_output=True,
    ).stdout


def bytes_io(data):
    return io.BytesIO(data)


def to_unicode_range(cps):
    cps = sorted(cps)
    out, i = [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append(f"U+{cps[i]:X}" if i == j else f"U+{cps[i]:X}-{cps[j]:X}")
        i = j + 1
    return ",".join(out)


def parse_codepoints(spec):
    """'U+20B9,U+0900-097F' -> set of ints."""
    out = set()
    for part in spec.split(","):
        part = part.strip().upper().replace("U+", "")
        if not part:
            continue
        if "-" in part:
            lo, hi = (int(x, 16) for x in part.split("-"))
        else:
            lo = hi = int(part, 16)
        out.update(range(lo, hi + 1))
    return out
