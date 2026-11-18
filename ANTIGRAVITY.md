# Workspace Rules & Architecture: matmatera-site

## Critical Rule for All Sessions
**Always run `git pull origin main` before editing any files in this repository.**

### Why
An automated GitHub Actions workflow (`.github/workflows/publish-art.yml`) periodically syncs new paintings from Google Drive ("matmatera-incoming") directly to the `main` branch. Pulling `origin main` at the start of every session prevents merge conflicts and ensures your local workspace is always up-to-date with newly published artwork.

## Titling Rule
**Never give works numbered series titles** (e.g. "Figure Study I, II, III" or "Study 1, 2, 3"). Removing one piece leaves a visible gap in the sequence. Repeated subjects share a plain title (e.g. "Figure Study") or get a descriptive title from Mat.

---

## Automated Publishing Pipeline (Google Drive -> GitHub -> Netlify)

1. **Incoming Folder**: `matmatera-incoming` in Google Drive.
2. **Metadata Notes** (include a `Title:` line, or the title is guessed from the file name): Uploading an image along with a `.txt`, `.md`, or `.json` file of the same name (or key-value lines: `Title`, `Medium`, `Dimensions`, `Section`, `Alt`) triggers ingestion.
   - Default Section: `Paintings` (maps to `#oils` in `artwork.html` and adds to `index.html`).
   - Other Sections: `Pastels` (`#pastels`), `Drawings` (`#charcoal`), `Digital` (`#digital`).
3. **Image Optimization**:
   - Resized so the longest edge is at most 1600px.
   - Saved as `.webp` (quality 82) into the section's folder: `assets/paintings/`, `assets/pastels/`, `assets/drawings/` or `assets/digital/`.
4. **HTML Injection**:
   - Prepends a `<figure class="work">` block to the top of `<div class="works">` in the matching section in `artwork.html` (and `index.html` if oil painting).
5. **Google Drive Archival**:
   - Processed files are automatically moved into a `processed/` subfolder in Google Drive so they are never imported twice.
6. **Deployment**:
   - Commits and pushes directly to `main`, which automatically triggers a live deploy on Netlify.
