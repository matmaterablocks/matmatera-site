# matmatera.com

Mat Matera's art portfolio: a plain static site (HTML, CSS, JS) with no build step.

- `index.html` is the front page and holds all the artwork (Paintings, Pastels, Drawings, Digital), with the current show as a pop-up card and a line at the top. `artwork.html` only redirects old links to it. `info.html` is Info, and `thanks.html` is the page shown after the inquiry form is sent.
- The show card closes itself for good after its last day: set `data-until` on `<dialog id="show">` in `index.html` when the show changes.
- Images live in `assets/`, one folder per section: `paintings/`, `pastels/`, `drawings/` and `digital/`, plus `info/` for the Info page.
- Contact on Info is an email link (mailto:matmatera@gmail.com); there is no form.
- Every push to `main` deploys automatically through Cloudflare Pages (project `matmatera-site`, build command copies the site files into `dist/`). DNS and the domain registration are also at Cloudflare.
- Grid images use 800px and 1200px copies made by `scripts/make_thumbs.py`; the Drive sync runs it automatically.
- The Design page isn't on the live site yet. It's still in the Claude artifact "Website rebuild takeover" and will be added later.
