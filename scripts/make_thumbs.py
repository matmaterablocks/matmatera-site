"""
Make 800px- and 1200px-wide versions of every artwork image and point the page
thumbnails at it with srcset, so the grids stop downloading full-size files.

The full-size file stays where it is and is still what the large view opens
(the <a class="zoom" href> is left untouched).

Run from the repo root:  python scripts/make_thumbs.py
Safe to run again: existing thumbnails are skipped, existing srcsets are rewritten.
"""
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
THUMB_WIDTHS = (800, 1200)   # 800 for desktop grids, 1200 for high-density phones
PAGES = ["index.html", "artwork.html", "info.html"]

# How wide a grid image is drawn: 3 columns from 960px (max layout 1240px),
# 2 columns from 560px, 1 column below that.
GRID_SIZES = "(min-width: 1240px) 380px, (min-width: 960px) 31vw, (min-width: 560px) 48vw, 92vw"
LEAD_SIZES = "(min-width: 960px) 720px, 92vw"


def is_thumb(path: Path) -> bool:
    return any(path.stem.endswith(f"-{tw}") for tw in THUMB_WIDTHS)


def make_thumbs(src: Path) -> list:
    """Write each smaller width the original is wider than. Returns the widths made."""
    made = []
    with Image.open(src) as im:
        w, h = im.size
        for tw in THUMB_WIDTHS:
            if w <= tw * 1.15:   # not worth a version barely smaller than the original
                continue
            dest = src.with_name(f"{src.stem}-{tw}{src.suffix}")
            if not dest.exists():
                im.resize((tw, round(h * tw / w)), Image.Resampling.LANCZOS).save(
                    dest, "WEBP", quality=80, method=6
                )
            made.append(tw)
    return made


def srcset_attrs(src: str, width: int, widths: list, lead: bool) -> str:
    base = src[: -len(".webp")]
    parts = [f"{base}-{tw}.webp {tw}w" for tw in widths] + [f"{src} {width}w"]
    sizes = LEAD_SIZES if lead else GRID_SIZES
    return f' srcset="{", ".join(parts)}" sizes="{sizes}"'


IMG_RE = re.compile(r'<img src="(assets/[^"]+\.webp)"([^>]*?)>')


def rewrite_page(path: Path, has_thumb: set) -> int:
    html = path.read_text(encoding="utf-8")
    count = 0

    def repl(m):
        nonlocal count
        src, rest = m.group(1), m.group(2)
        rest = re.sub(r'\s(srcset|sizes)="[^"]*"', "", rest)
        if 'width="' not in rest:
            # Fill in missing dimensions so the page doesn't jump while images load
            with Image.open(ROOT / src) as im:
                w, h = im.size
            rest = rest.replace(' loading=', f' width="{w}" height="{h}" style="--w:{w}px" loading=', 1) \
                if ' loading=' in rest else f' width="{w}" height="{h}" style="--w:{w}px"' + rest
        if src not in has_thumb:
            return f'<img src="{src}"{rest}>'
        width = int(re.search(r'width="(\d+)"', rest).group(1))
        # The Home lead image is the first one in .lead
        lead = 'loading="lazy"' not in rest and path.name == "index.html"
        count += 1
        return f'<img src="{src}"{srcset_attrs(src, width, has_thumb[src], lead)}{rest}>'

    new = IMG_RE.sub(repl, html)
    if new != html:
        path.write_text(new, encoding="utf-8")
    return count


def main():
    has_thumb = {}
    for f in sorted((ROOT / "assets").glob("*/*.webp")):
        if is_thumb(f):
            continue
        widths = make_thumbs(f)
        if widths:
            has_thumb[f.relative_to(ROOT).as_posix()] = widths
    for page in PAGES:
        n = rewrite_page(ROOT / page, has_thumb)
        print(f"{page}: {n} images given srcset")


if __name__ == "__main__":
    main()
