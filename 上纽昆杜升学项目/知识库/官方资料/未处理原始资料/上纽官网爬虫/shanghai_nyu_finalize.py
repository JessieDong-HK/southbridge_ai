#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import mimetypes
import os
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests


UA = "Mozilla/5.0 (compatible; ShanghaiNYUContentArchive/1.0; +local-archive)"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_name(value: str, fallback: str = "file", max_len: int = 80) -> str:
    value = re.sub(r"https?://", "", value)
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-._")
    value = re.sub(r"-{2,}", "-", value)
    return (value[:max_len].strip("-._") or fallback)


def ext_for(url: str, content_type: str | None = None) -> str:
    ext = Path(urlparse(url).path).suffix.lower()
    if ext and len(ext) <= 6:
        return ext
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guessed:
            return ".jpg" if guessed == ".jpe" else guessed
    return ".bin"


def image_filename(url: str, content_type: str | None = None) -> str:
    parsed = urlparse(url)
    stem = safe_name(Path(parsed.path).stem, "image", 52)
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    return f"{stem}-{digest}{ext_for(url, content_type)}"


def load_pages(root: Path) -> list[dict]:
    pages = []
    for path in sorted((root / "pages").glob("*.json")):
        with path.open("r", encoding="utf-8") as f:
            obj = json.load(f)
        obj["_file"] = path
        pages.append(obj)
    return pages


def write_pages(root: Path, pages: list[dict]) -> None:
    clean_pages = []
    for obj in pages:
        path = obj.pop("_file")
        with path.open("w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        clean_pages.append(obj)

    clean_pages.sort(key=lambda x: (x.get("sequence", 10**9), x.get("canonical_url") or x.get("url") or ""))
    with (root / "all_pages.jsonl").open("w", encoding="utf-8") as f:
        for obj in clean_pages:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
    with (root / "all_pages.json").open("w", encoding="utf-8") as f:
        json.dump(clean_pages, f, ensure_ascii=False, indent=2)


def collect_images(pages: list[dict]) -> list[str]:
    seen = {}
    for obj in pages:
        for image in obj.get("images") or []:
            url = image.get("url")
            if url and url.startswith(("http://", "https://")):
                seen.setdefault(url, None)
    return list(seen)


def download_one(args: tuple[str, Path, int]) -> tuple[str, dict]:
    url, image_dir, max_bytes = args
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"})
    try:
        with session.get(url, timeout=(8, 20), stream=True, allow_redirects=True) as r:
            r.raise_for_status()
            content_type = r.headers.get("content-type", "")
            if content_type and not content_type.lower().startswith("image/"):
                return url, {"download_status": "skipped_non_image", "content_type": content_type}
            total_header = r.headers.get("content-length")
            if total_header and int(total_header) > max_bytes:
                return url, {
                    "download_status": "skipped_too_large",
                    "bytes": int(total_header),
                    "content_type": content_type,
                }
            name = image_filename(url, content_type)
            dest = image_dir / name
            tmp = image_dir / f".{name}.tmp"
            size = 0
            with tmp.open("wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > max_bytes:
                        tmp.unlink(missing_ok=True)
                        return url, {
                            "download_status": "skipped_too_large",
                            "bytes": size,
                            "content_type": content_type,
                        }
                    f.write(chunk)
            tmp.replace(dest)
            return url, {
                "download_status": "downloaded",
                "local_path": str(dest.relative_to(image_dir.parent)),
                "bytes": size,
                "content_type": content_type,
            }
    except Exception as exc:
        return url, {"download_status": "error", "error": str(exc)[:300]}


def download_images(root: Path, pages: list[dict], workers: int, max_bytes: int, limit: int) -> dict:
    image_dir = root / "images" / "_shared"
    image_dir.mkdir(parents=True, exist_ok=True)
    urls = collect_images(pages)
    if limit:
        urls = urls[:limit]

    results = {}
    started = time.time()
    with cf.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(download_one, (url, image_dir, max_bytes)) for url in urls]
        for idx, fut in enumerate(cf.as_completed(futures), 1):
            url, info = fut.result()
            results[url] = info
            if idx % 250 == 0:
                elapsed = time.time() - started
                print(f"images {idx}/{len(urls)} ({elapsed:.1f}s)", flush=True)

    for obj in pages:
        for image in obj.get("images") or []:
            url = image.get("url")
            if url in results:
                image.update(results[url])
            elif url:
                image["download_status"] = image.get("download_status") or "not_downloaded"
    return Counter(info.get("download_status", "unknown") for info in results.values())


def summarize(root: Path, pages: list[dict], image_status: Counter) -> dict:
    page_types = Counter(obj.get("page_type") or "" for obj in pages)
    image_refs = sum(len(obj.get("images") or []) for obj in pages)
    unique_images = len(collect_images(pages))
    low_text = sum(1 for obj in pages if len(obj.get("text") or "") < 80)
    manifest = {
        "source": "https://shanghai.nyu.edu/",
        "site": "NYU Shanghai / 上海纽约大学官网",
        "generated_at": now_iso(),
        "crawl_note": "The public site has no sitemap; pages were discovered by following internal links from the English and Chinese homepage. The crawl was stopped when video pages began expanding mostly repetitive video index links.",
        "page_count": len(pages),
        "low_text_page_count": low_text,
        "image_reference_count": image_refs,
        "unique_image_url_count": unique_images,
        "image_download_status": dict(image_status),
        "page_type_counts": dict(page_types.most_common()),
        "files": {
            "all_pages_jsonl": "all_pages.jsonl",
            "all_pages_json": "all_pages.json",
            "page_json_dir": "pages/",
            "image_dir": "images/_shared/",
        },
    }
    with (root / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    readme = f"""# NYU Shanghai Official Site Crawl

Source: https://shanghai.nyu.edu/

This archive stores public NYU Shanghai website content in AI-friendly JSON.

- `all_pages.jsonl`: one page per line, best for batch AI processing.
- `all_pages.json`: same pages as a JSON array.
- `pages/`: individual page JSON files.
- `images/_shared/`: downloaded images. Each page's `images[]` array points to the shared local path with `local_path`.
- `manifest.json`: counts and crawl metadata.

Counts:

- Pages: {manifest['page_count']}
- Image references: {manifest['image_reference_count']}
- Unique image URLs: {manifest['unique_image_url_count']}
- Low-text/list pages: {manifest['low_text_page_count']}
- Image status: {json.dumps(manifest['image_download_status'], ensure_ascii=False)}

Notes:

- The site did not expose a sitemap, so content was discovered from public internal links.
- Some public links returned 403, 404, timeout, or 500 from the website; inaccessible pages are not included as content pages.
- Video and gallery areas contain many repeated list pages. They are preserved where crawled, but the crawl was stopped once video index expansion became mostly repetitive.
"""
    (root / "README.md").write_text(readme, encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="outputs/shanghai_nyu_official_site")
    parser.add_argument("--workers", type=int, default=24)
    parser.add_argument("--max-image-bytes", type=int, default=5_000_000)
    parser.add_argument("--image-limit", type=int, default=0)
    parser.add_argument("--skip-images", action="store_true")
    args = parser.parse_args()

    root = Path(args.root)
    pages = load_pages(root)
    image_status = Counter()
    if not args.skip_images:
        image_status = download_images(root, pages, args.workers, args.max_image_bytes, args.image_limit)
    write_pages(root, pages)
    manifest = summarize(root, pages, image_status)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
