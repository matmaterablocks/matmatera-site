#!/usr/bin/env python3
"""
sync_drive_artwork.py

Automated sync script that monitors the Google Drive folder "matmatera-incoming"
for new paintings/artwork images and accompanying metadata notes.

For each new artwork:
  1. Downloads and converts image to optimized .webp (max 1600px longest edge, q=82)
  2. Saves into assets/art/<slug>.webp
  3. Inserts a new <figure class="work"> at the top of the matching section in artwork.html
     (and in index.html if it is an oil painting / Paintings section)
  4. Moves processed Drive files into a "processed" subfolder inside "matmatera-incoming"
"""

import io
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageOps

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    print("Google client libraries not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/drive"]
ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_ART_DIR = ROOT_DIR / "assets" / "art"
ARTWORK_HTML = ROOT_DIR / "artwork.html"
INDEX_HTML = ROOT_DIR / "index.html"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp", ".heic"}
NOTE_EXTENSIONS = {".txt", ".json", ".md"}


def slugify(text: str) -> str:
    """Convert text to a clean lowercase URL/filename slug."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    slug = re.sub(r"[-\s]+", "-", text)
    return slug or "untitled"


def escape_html(text: str) -> str:
    """HTML-escape strings matching the existing site's entity style."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )


def get_drive_service():
    """Authenticate and return the Google Drive API service."""
    creds_env = os.environ.get("GOOGLE_DRIVE_CREDENTIALS", "").strip()
    if not creds_env:
        cred_file = ROOT_DIR / "credentials.json"
        if cred_file.exists():
            creds_env = cred_file.read_text(encoding="utf-8")

    if not creds_env:
        print("[Notice] GOOGLE_DRIVE_CREDENTIALS environment variable is not set.")
        print("Please configure GOOGLE_DRIVE_CREDENTIALS with your Google Service Account JSON.")
        return None

    try:
        if creds_env.startswith("{"):
            info = json.loads(creds_env)
            credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        else:
            credentials = service_account.Credentials.from_service_account_file(creds_env, scopes=SCOPES)
        return build("drive", "v3", credentials=credentials)
    except Exception as e:
        print(f"[Error] Failed to initialize Google Drive service: {e}")
        return None


def find_or_create_folder(service, name: str, parent_id: Optional[str] = None) -> Optional[str]:
    """Find a folder by name, optionally under parent_id, or create it if under parent."""
    query_parts = [
        f"name = '{name}'",
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false",
    ]
    if parent_id:
        query_parts.append(f"'{parent_id}' in parents")

    q = " and ".join(query_parts)
    results = service.files().list(
        q=q,
        fields="files(id, name)",
        spaces="drive",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()
    files = results.get("files", [])

    if files:
        return files[0]["id"]

    if parent_id:
        # Create subfolder inside parent
        meta = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        created = service.files().create(
            body=meta,
            fields="id",
            supportsAllDrives=True,
        ).execute()
        return created.get("id")

    return None


def list_folder_contents(service, folder_id: str) -> List[Dict]:
    """List all non-folder, non-trashed files directly inside folder_id."""
    q = f"'{folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    items = []
    page_token = None

    while True:
        resp = service.files().list(
            q=q,
            fields="nextPageToken, files(id, name, mimeType, size)",
            spaces="drive",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            pageToken=page_token,
        ).execute()
        items.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return items


def download_file_bytes(service, file_meta: Dict) -> bytes:
    """Download file content into bytes, handling Google Docs if needed."""
    file_id = file_meta["id"]
    mime_type = file_meta.get("mimeType", "")

    if mime_type == "application/vnd.google-apps.document":
        req = service.files().export_media(fileId=file_id, mimeType="text/plain")
    else:
        req = service.files().get_media(fileId=file_id, supportsAllDrives=True)

    stream = io.BytesIO()
    downloader = MediaIoBaseDownload(stream, req)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    return stream.getvalue()


def parse_metadata(raw_text: str, fallback_title: str) -> Dict[str, str]:
    """
    Parse metadata from JSON or key-value text lines.
    Expected fields: Title, Medium, Dimensions, Section, Alt.
    """
    data = {
        "title": fallback_title,
        "medium": "Oil on wood",
        "dimensions": "",
        "section": "Paintings",
        "alt": "",
    }

    raw = raw_text.strip()
    if not raw:
        return data

    # Attempt JSON parsing
    if raw.startswith("{") and raw.endswith("}"):
        try:
            parsed = json.loads(raw)
            for k, v in parsed.items():
                k_lower = k.lower().strip()
                if k_lower in data and v:
                    data[k_lower] = str(v).strip()
            return data
        except json.JSONDecodeError:
            pass

    # Key-value line parsing
    for line in raw.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.lower().strip()
        val = val.strip()
        if not val:
            continue
        if key in ("title", "name"):
            data["title"] = val
        elif key in ("medium", "media", "material"):
            data["medium"] = val
        elif key in ("dimensions", "dimension", "size"):
            data["dimensions"] = val
        elif key in ("section", "category", "type"):
            data["section"] = val
        elif key in ("alt", "description", "caption"):
            data["alt"] = val

    return data


def optimize_image(image_bytes: bytes, dest_path: Path) -> Tuple[int, int]:
    """
    Optimize and convert image to .webp (max 1600px longest edge, quality 82).
    Returns (width, height) of the saved image.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = ImageOps.exif_transpose(img)

        # Scale down if longest edge exceeds 1600px
        max_edge = 1600
        w, h = img.size
        longest = max(w, h)
        if longest > max_edge:
            scale = max_edge / longest
            new_w = max(1, round(w * scale))
            new_h = max(1, round(h * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Convert modes if needed for WebP
        if img.mode in ("CMYK", "P"):
            img = img.convert("RGB")

        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest_path, "WEBP", quality=82, method=6)

        return img.size


def resolve_section_id(section_name: str) -> str:
    """Map human section name to section id in artwork.html."""
    s = section_name.lower().strip()
    if "pastel" in s:
        return "pastels"
    elif "charcoal" in s or "draw" in s:
        return "charcoal"
    elif "digital" in s:
        return "digital"
    return "oils"


def build_figure_html(slug: str, title: str, medium: str, alt: str, width: int, height: int) -> str:
    """Construct HTML figure block matching the existing site pattern."""
    esc_slug = escape_html(slug)
    esc_title = escape_html(title)
    esc_medium = escape_html(medium)
    esc_alt = escape_html(alt)

    return (
        f'<figure class="work">'
        f'<a class="zoom" href="assets/art/{esc_slug}.webp" data-title="{esc_title}" data-medium="{esc_medium}">'
        f'<img src="assets/art/{esc_slug}.webp" alt="{esc_alt}" width="{width}" height="{height}" '
        f'style="--w:{width}px" loading="lazy" decoding="async"></a>'
        f'<figcaption><span class="t">{esc_title}</span><span class="m">{esc_medium}</span></figcaption>'
        f"</figure>"
    )


def insert_into_artwork_html(figure_html: str, section_id: str) -> bool:
    """Insert figure entry at top of section in artwork.html."""
    if not ARTWORK_HTML.exists():
        print(f"[Error] {ARTWORK_HTML} not found.")
        return False

    content = ARTWORK_HTML.read_text(encoding="utf-8")

    # Match section and its inner <div class="works">
    pattern = rf'(<section\b[^>]*\bid=["\']{re.escape(section_id)}["\'][^>]*>[\s\S]*?<div class="works">)(\s*)'
    match = re.search(pattern, content)
    if not match:
        print(f"[Error] Could not find <div class=\"works\"> inside section id '{section_id}' in artwork.html.")
        return False

    replacement = f"{match.group(1)}\n{figure_html}\n"
    new_content = content[: match.start()] + replacement + content[match.end() :]
    ARTWORK_HTML.write_text(new_content, encoding="utf-8")
    return True


def insert_into_index_html(figure_html: str) -> bool:
    """Insert figure entry at top of Paintings section in index.html."""
    if not INDEX_HTML.exists():
        print(f"[Error] {INDEX_HTML} not found.")
        return False

    content = INDEX_HTML.read_text(encoding="utf-8")

    pattern = r'(<section\b[^>]*aria-labelledby=["\']paintings["\'][^>]*>[\s\S]*?<div class="works">)(\s*)'
    match = re.search(pattern, content)
    if not match:
        # Fallback search for section with Paintings heading
        pattern = r'(<h2\b[^>]*id=["\']paintings["\'][^>]*>[\s\S]*?<div class="works">)(\s*)'
        match = re.search(pattern, content)
        if not match:
            print("[Error] Could not find Paintings <div class=\"works\"> in index.html.")
            return False

    replacement = f"{match.group(1)}\n{figure_html}\n"
    new_content = content[: match.start()] + replacement + content[match.end() :]
    INDEX_HTML.write_text(new_content, encoding="utf-8")
    return True


def move_file_to_processed(service, file_id: str, incoming_folder_id: str, processed_folder_id: str):
    """Move a file from matmatera-incoming into the processed subfolder."""
    service.files().update(
        fileId=file_id,
        addParents=processed_folder_id,
        removeParents=incoming_folder_id,
        fields="id, parents",
        supportsAllDrives=True,
    ).execute()


def sync():
    """Main workflow: scan incoming folder, process artworks, update site."""
    service = get_drive_service()
    if not service:
        # Exit with 0 so unattended workflows don't fail before credentials are provided
        sys.exit(0)

    incoming_id = find_or_create_folder(service, "matmatera-incoming")
    if not incoming_id:
        print("[Notice] Folder 'matmatera-incoming' not found in Google Drive.")
        print("Please create 'matmatera-incoming' and share it with your service account email.")
        sys.exit(0)

    processed_id = find_or_create_folder(service, "processed", parent_id=incoming_id)
    if not processed_id:
        print("[Error] Failed to find or create 'processed' subfolder.")
        sys.exit(1)

    items = list_folder_contents(service, incoming_id)
    if not items:
        print("No new files found in 'matmatera-incoming'.")
        return

    # Categorize images and notes
    image_files = []
    note_files = {}

    for item in items:
        name = item["name"]
        ext = Path(name).suffix.lower()
        base = Path(name).stem.lower().strip()

        if ext in IMAGE_EXTENSIONS or item.get("mimeType", "").startswith("image/"):
            image_files.append(item)
        elif ext in NOTE_EXTENSIONS or item.get("mimeType") == "application/vnd.google-apps.document":
            note_files[base] = item

    if not image_files:
        print("No new image files found in 'matmatera-incoming'.")
        return

    print(f"Found {len(image_files)} image(s) to process.")
    processed_count = 0

    for img_item in image_files:
        img_name = img_item["name"]
        stem = Path(img_name).stem
        base_clean = stem.lower().strip()

        # Find matching note or single note fallback
        note_item = note_files.get(base_clean)
        if not note_item and len(note_files) == 1 and len(image_files) == 1:
            note_item = list(note_files.values())[0]

        note_text = ""
        if note_item:
            try:
                note_bytes = download_file_bytes(service, note_item)
                note_text = note_bytes.decode("utf-8", errors="replace")
            except Exception as e:
                print(f"[Warning] Failed to download note {note_item['name']}: {e}")

        # Derive human-friendly title from filename if note doesn't specify
        human_title = re.sub(r"[-_]+", " ", stem).strip().title()
        metadata = parse_metadata(note_text, fallback_title=human_title)

        title = metadata["title"]
        medium = metadata["medium"]
        section = metadata["section"]
        dimensions = metadata["dimensions"]
        alt = metadata["alt"]

        if not alt:
            alt = f"{medium} painting by Mat Matera titled {title}"
            if dimensions:
                alt += f" ({dimensions})"

        slug_base = slugify(title) or slugify(stem)
        slug = slug_base
        dest_path = ASSETS_ART_DIR / f"{slug}.webp"

        # Avoid filename collisions with existing assets
        counter = 2
        while dest_path.exists():
            slug = f"{slug_base}-{counter}"
            dest_path = ASSETS_ART_DIR / f"{slug}.webp"
            counter += 1

        print(f"Downloading {img_name}...")
        img_bytes = download_file_bytes(service, img_item)

        print(f"Optimizing to WebP ({dest_path.name})...")
        width, height = optimize_image(img_bytes, dest_path)

        section_id = resolve_section_id(section)
        figure_html = build_figure_html(slug, title, medium, alt, width, height)

        print(f"Updating artwork.html (section: {section_id})...")
        insert_into_artwork_html(figure_html, section_id)

        if section_id == "oils":
            print("Updating index.html (Paintings)...")
            insert_into_index_html(figure_html)

        # Move Drive files to processed subfolder
        print(f"Moving {img_name} to 'processed' subfolder...")
        move_file_to_processed(service, img_item["id"], incoming_id, processed_id)

        if note_item:
            print(f"Moving note {note_item['name']} to 'processed' subfolder...")
            move_file_to_processed(service, note_item["id"], incoming_id, processed_id)

        processed_count += 1
        print(f"Successfully published '{title}' ({slug}.webp)!")

    print(f"\nCompleted sync: {processed_count} artwork(s) published.")


if __name__ == "__main__":
    sync()
