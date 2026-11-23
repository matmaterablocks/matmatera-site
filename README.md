# matmatera.com

Mat Matera's art portfolio: a plain static site (HTML, CSS, JS) with no build step.

- `index.html` is Home, `artwork.html` is Artwork, `info.html` is Info, and `thanks.html` is the page shown after the inquiry form is sent.
- Images live in `assets/`, one folder per section: `paintings/`, `pastels/`, `drawings/` and `digital/`, plus `info/` for the Info page.
- Contact on Info is an email link (mailto:matmatera@gmail.com); there is no form.
- Every push to `main` deploys automatically through Cloudflare Pages (project `matmatera-site`, build command copies the site files into `dist/`). DNS and the domain registration are also at Cloudflare.
- Grid images use 800px and 1200px copies made by `scripts/make_thumbs.py`; the Drive sync runs it automatically.
- The Design page isn't on the live site yet. It's still in the Claude artifact "Website rebuild takeover" and will be added later.
