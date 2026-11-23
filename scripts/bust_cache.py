"""Add ?v=<content hash> to the stylesheet and script links in every page, so browsers fetch a changed
CSS or JS file right away instead of using a cached copy for up to an hour. Run after editing CSS or JS:
    python3 scripts/bust_cache.py
"""
import hashlib, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
def ver(name):
    return hashlib.sha256((root / name).read_bytes()).hexdigest()[:8]

pat = re.compile(r'((?:href|src)=")([a-z]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')
for page in sorted(root.glob('*.html')):
    s = page.read_text()
    t = pat.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={ver(m.group(2))}{m.group(3)}' if (root / m.group(2)).exists() else m.group(0), s)
    if t != s:
        page.write_text(t)
        print('updated', page.name)
