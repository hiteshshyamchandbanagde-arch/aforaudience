"""Download the pinned upstream TTFs (and each family's OFL.txt) from google/fonts.

Usage:
  python scripts/dev/fonts/fetch_sources.py <workdir> [--no-verify]

Writes <workdir>/src/<file>.ttf and <workdir>/src/OFL-<dir>.txt. Each TTF is
checked against the sha256 in fonts.json; --no-verify skips that, for an
upgrade where you have just changed a font's `commit` and not yet its hash
(the script prints the new hash to paste in).
"""
import hashlib
import os
import sys
import urllib.parse
import urllib.request

from common import load_config, source_name

def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    verify = "--no-verify" not in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    dest = os.path.join(args[0], "src")
    os.makedirs(dest, exist_ok=True)
    cfg = load_config()
    bad = 0
    ofl_done = set()
    for font in cfg["fonts"]:
        url = f"{cfg['upstream']}/{font['commit']}/{urllib.parse.quote(font['source'])}"
        data = fetch(url)
        digest = hashlib.sha256(data).hexdigest()
        ok = digest == font["sha256"]
        with open(os.path.join(dest, source_name(font)), "wb") as f:
            f.write(data)
        status = "ok" if ok else ("HASH CHANGED" if not verify else "HASH MISMATCH")
        print(f"{source_name(font)}: {len(data)} bytes, sha256 {digest} [{status}]")
        if verify and not ok:
            bad += 1
        family_dir = os.path.dirname(font["source"])
        if (font["commit"], family_dir) not in ofl_done:
            ofl_done.add((font["commit"], family_dir))
            ofl = fetch(f"{cfg['upstream']}/{font['commit']}/{family_dir}/OFL.txt")
            with open(os.path.join(dest, f"OFL-{os.path.basename(family_dir)}.txt"), "wb") as f:
                f.write(ofl)
    if bad:
        sys.exit(f"{bad} file(s) did not match fonts.json's sha256")

if __name__ == "__main__":
    main()
