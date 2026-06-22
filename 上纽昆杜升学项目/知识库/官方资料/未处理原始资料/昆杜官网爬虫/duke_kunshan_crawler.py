#!/usr/bin/env python3
"""
Crawl Duke Kunshan University's public website into AI-friendly JSON.

Default source: https://www.dukekunshan.edu.cn/sitemap_index.xml

Output shape:
  output/
    manifest.json
    all_pages.jsonl
    pages/<slug-or-hash>.json
    images/<page-id>/<image-file>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree as ET

import requests
from lxml import html


DEFAULT_START = "https://www.dukekunshan.edu.cn/sitemap_index.xml"
DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; DKUContentCrawler/1.0; +local-archive)"
TEXT_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "figcaption")
DROP_XPATH = (
    "//script",
    "//style",
    "//noscript",
    "//svg",
    "//form",
    "//iframe",
    "//nav",
    "//header",
    "//footer",
    "//*[contains(concat(' ', normalize-space(@class), ' '), ' elementor-location-header ')]",
    "//*[contains(concat(' ', normalize-space(@class), ' '), ' elementor-location-footer ')]",
    "//*[contains(concat(' ', normalize-space(@class), ' '), ' menu ')]",
)


@dataclass(frozen=True)
class SitemapUrl:
    url: str
    lastmod: str | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    parsed = parsed._replace(fragment="")
    if parsed.path != "/" and parsed.path.endswith("/"):
        parsed = parsed._replace(path=parsed.path.rstrip("/"))
    return urlunparse(parsed)


def same_site(url: str, allowed_hosts: set[str]) -> bool:
    return urlparse(url).netloc.lower() in allowed_hosts


def safe_name(value: str, fallback: str, max_len: int = 90) -> str:
    value = re.sub(r"https?://", "", value)
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-._")
    value = re.sub(r"-{2,}", "-", value)
    if not value:
        value = fallback
    return value[:max_len].strip("-._") or fallback


def page_id_for(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/") or "home"
    slug = safe_name(path.replace("/", "__"), "page")
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    return f"{slug}-{digest}"


def guess_extension(content_type: str | None, url: str) -> str:
    ext = Path(urlparse(url).path).suffix.lower()
    if ext and len(ext) <= 6:
        return ext
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext:
            return ".jpg" if ext == ".jpe" else ext
    return ".bin"


def make_session(user_agent: str) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        }
    )
    return session


def fetch(session: requests.Session, url: str, timeout: int = 30) -> requests.Response:
    response = session.get(url, timeout=timeout, allow_redirects=True)
    response.raise_for_status()
    return response


def parse_xml_urls(xml_text: str) -> tuple[str, list[SitemapUrl]]:
    root = ET.fromstring(xml_text.encode("utf-8"))
    tag = root.tag.rsplit("}", 1)[-1]
    urls: list[SitemapUrl] = []
    for node in root:
        node_tag = node.tag.rsplit("}", 1)[-1]
        if node_tag not in {"sitemap", "url"}:
            continue
        loc = None
        lastmod = None
        for child in node:
            child_tag = child.tag.rsplit("}", 1)[-1]
            if child_tag == "loc":
                loc = clean_text(child.text)
            elif child_tag == "lastmod":
                lastmod = clean_text(child.text)
        if loc:
            urls.append(SitemapUrl(loc, lastmod or None))
    return tag, urls


def collect_from_sitemap(
    session: requests.Session,
    sitemap_url: str,
    allowed_hosts: set[str],
    delay: float,
    max_sitemaps: int = 200,
) -> tuple[list[SitemapUrl], list[str]]:
    queue = [sitemap_url]
    seen_sitemaps: set[str] = set()
    page_urls: dict[str, SitemapUrl] = {}
    sitemap_urls: list[str] = []

    while queue:
        current = canonicalize_url(queue.pop(0))
        if current in seen_sitemaps:
            continue
        if len(seen_sitemaps) >= max_sitemaps:
            raise RuntimeError(f"Too many sitemaps; stopped at {max_sitemaps}")
        seen_sitemaps.add(current)
        sitemap_urls.append(current)
        response = fetch(session, current)
        tag, items = parse_xml_urls(response.text)
        if tag == "sitemapindex":
            for item in items:
                if same_site(item.url, allowed_hosts):
                    queue.append(item.url)
        elif tag == "urlset":
            for item in items:
                if same_site(item.url, allowed_hosts):
                    page_urls[canonicalize_url(item.url)] = item
        if delay:
            time.sleep(delay)

    return list(page_urls.values()), sitemap_urls


def read_robots(session: requests.Session, base_url: str, user_agent: str) -> RobotFileParser:
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        response = fetch(session, robots_url, timeout=15)
        rp.parse(response.text.splitlines())
    except Exception:
        rp.parse([])
    return rp


def choose_content_root(doc: html.HtmlElement) -> html.HtmlElement:
    candidates = []
    xpath_selectors = [
        "//main",
        "//article",
        "//*[contains(concat(' ', normalize-space(@class), ' '), ' elementor-location-single ')]",
        "//*[contains(concat(' ', normalize-space(@class), ' '), ' elementor ')]",
        "//*[@id='content']",
        "//*[contains(concat(' ', normalize-space(@class), ' '), ' site-content ')]",
    ]
    for selector in xpath_selectors:
        matches = doc.xpath(selector)
        for match in matches:
            text_len = len(clean_text(match.text_content()))
            if text_len:
                candidates.append((text_len, match))
    if not candidates:
        body = doc.find("body")
        return body if body is not None else doc
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def extract_meta(doc: html.HtmlElement, url: str) -> dict:
    def first_xpath(expr: str) -> str:
        values = doc.xpath(expr)
        if isinstance(values, str):
            return clean_text(values)
        if not values:
            return ""
        return clean_text(values[0])

    title = first_xpath("string(//meta[@property='og:title']/@content)") or first_xpath("string(//title)")
    description = first_xpath("string(//meta[@name='description']/@content)") or first_xpath(
        "string(//meta[@property='og:description']/@content)"
    )
    canonical = first_xpath("string(//link[@rel='canonical']/@href)") or url
    language = first_xpath("string(//html/@lang)")
    published = first_xpath("string(//meta[@property='article:published_time']/@content)")
    modified = first_xpath("string(//meta[@property='article:modified_time']/@content)")
    og_image = first_xpath("string(//meta[@property='og:image']/@content)")
    return {
        "title": title,
        "description": description,
        "canonical_url": urljoin(url, canonical),
        "language": language,
        "published_time": published,
        "modified_time": modified,
        "og_image": urljoin(url, og_image) if og_image else "",
    }


def extract_text_blocks(root: html.HtmlElement) -> list[dict]:
    blocks = []
    for element in root.iter(*TEXT_TAGS):
        text = clean_text(element.text_content())
        if len(text) < 2:
            continue
        if text.lower() in {"menu", "search", "read more", "learn more"}:
            continue
        blocks.append({"type": element.tag.lower(), "text": text})
    return blocks


def best_srcset_url(value: str | None) -> str:
    if not value:
        return ""
    candidates = []
    for part in value.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        url = bits[0]
        score = 0
        if len(bits) > 1:
            descriptor = bits[1]
            if descriptor.endswith("w") and descriptor[:-1].isdigit():
                score = int(descriptor[:-1])
            elif descriptor.endswith("x"):
                try:
                    score = int(float(descriptor[:-1]) * 1000)
                except ValueError:
                    score = 0
        candidates.append((score, url))
    if not candidates:
        return ""
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def extract_images(root: html.HtmlElement, page_url: str, og_image: str = "") -> list[dict]:
    images = []
    seen: set[str] = set()

    def add_image(src: str, alt: str = "", caption: str = "", source: str = "img") -> None:
        if not src or src.startswith("data:"):
            return
        absolute = canonicalize_url(urljoin(page_url, src))
        if absolute in seen:
            return
        seen.add(absolute)
        images.append(
            {
                "url": absolute,
                "alt": clean_text(alt),
                "caption": clean_text(caption),
                "source": source,
                "local_path": "",
                "download_status": "pending",
            }
        )

    if og_image:
        add_image(og_image, source="og:image")

    for img in root.xpath(".//img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        srcset_best = best_srcset_url(img.get("srcset") or img.get("data-srcset"))
        candidates = [srcset_best or src]
        alt = img.get("alt") or ""
        caption = ""
        figure = img.getparent()
        while figure is not None and figure.tag.lower() != "figure":
            figure = figure.getparent()
        if figure is not None:
            captions = figure.xpath(".//figcaption")
            if captions:
                caption = captions[0].text_content()
        for candidate in candidates:
            add_image(candidate or "", alt=alt, caption=caption)

    for node in root.xpath(".//*[@style]"):
        style = node.get("style") or ""
        for match in re.finditer(r"url\\(['\\\"]?([^)'\\\"]+)['\\\"]?\\)", style):
            add_image(match.group(1), source="background")

    return images


def extract_links(root: html.HtmlElement, page_url: str, allowed_hosts: set[str]) -> list[dict]:
    links = []
    seen: set[str] = set()
    for anchor in root.xpath(".//a[@href]"):
        href = anchor.get("href")
        if not href or href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        absolute = canonicalize_url(urljoin(page_url, href))
        if absolute in seen:
            continue
        seen.add(absolute)
        links.append(
            {
                "url": absolute,
                "text": clean_text(anchor.text_content()),
                "internal": same_site(absolute, allowed_hosts),
            }
        )
    return links


def strip_unwanted(doc: html.HtmlElement) -> None:
    for expr in DROP_XPATH:
        for node in doc.xpath(expr):
            parent = node.getparent()
            if parent is not None:
                parent.remove(node)


def page_type_from_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    if not path:
        return "home"
    return path.split("/", 1)[0]


def parse_page(html_text: str, url: str, allowed_hosts: set[str], sitemap_lastmod: str | None) -> dict:
    doc = html.fromstring(html_text)
    doc.make_links_absolute(url)
    meta = extract_meta(doc, url)
    strip_unwanted(doc)
    root = choose_content_root(doc)
    blocks = extract_text_blocks(root)
    text = "\n".join(block["text"] for block in blocks)
    images = extract_images(root, url, meta.get("og_image", ""))
    links = extract_links(root, url, allowed_hosts)
    return {
        "id": page_id_for(url),
        "url": url,
        "canonical_url": meta["canonical_url"],
        "page_type": page_type_from_url(url),
        "title": meta["title"],
        "description": meta["description"],
        "language": meta["language"],
        "published_time": meta["published_time"],
        "modified_time": meta["modified_time"],
        "sitemap_lastmod": sitemap_lastmod,
        "text": text,
        "text_blocks": blocks,
        "images": images,
        "links": links,
        "word_count_estimate": len(re.findall(r"\w+", text)),
        "crawled_at": now_iso(),
    }


def download_images(
    session: requests.Session,
    page: dict,
    image_dir: Path,
    max_bytes: int,
    delay: float,
    global_cache: dict[str, dict],
) -> None:
    page_image_dir = image_dir / page["id"]
    page_image_dir.mkdir(parents=True, exist_ok=True)
    for image in page["images"]:
        url = image["url"]
        if url in global_cache:
            image.update(global_cache[url])
            image["deduplicated"] = True
            continue
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
        cached_files = list((image_dir / "_shared").glob(f"*-{digest}.*"))
        if cached_files:
            cached_path = cached_files[0]
            cached_meta = {
                "local_path": str(cached_path.relative_to(image_dir.parent)),
                "bytes": cached_path.stat().st_size,
                "download_status": "ok",
                "cached_from_disk": True,
            }
            global_cache[url] = cached_meta
            image.update(cached_meta)
            continue
        try:
            response = session.get(url, stream=True, timeout=30)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if not content_type.lower().split(";")[0].strip().startswith("image/"):
                image["download_status"] = "skipped"
                image["error"] = f"not an image response: {content_type or 'unknown content-type'}"
                global_cache[url] = {
                    "local_path": "",
                    "download_status": image["download_status"],
                    "error": image["error"],
                }
                continue
            ext = guess_extension(content_type, url)
            base = safe_name(Path(urlparse(url).path).stem, "image", 50)
            file_path = image_dir / "_shared" / f"{base}-{digest}{ext}"
            file_path.parent.mkdir(parents=True, exist_ok=True)
            total = 0
            with file_path.open("wb") as fh:
                for chunk in response.iter_content(chunk_size=65536):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > max_bytes:
                        raise RuntimeError(f"image exceeds max bytes ({max_bytes})")
                    fh.write(chunk)
            image["local_path"] = str(file_path.relative_to(image_dir.parent))
            image["content_type"] = content_type
            image["bytes"] = total
            image["download_status"] = "ok"
            global_cache[url] = {
                "local_path": image["local_path"],
                "content_type": content_type,
                "bytes": total,
                "download_status": "ok",
            }
        except Exception as exc:
            image["download_status"] = "error"
            image["error"] = str(exc)
            global_cache[url] = {
                "local_path": "",
                "download_status": "error",
                "error": str(exc),
            }
        if delay:
            time.sleep(delay)


def discover_by_links(
    session: requests.Session,
    seeds: Iterable[str],
    allowed_hosts: set[str],
    robots: RobotFileParser,
    user_agent: str,
    limit: int,
    delay: float,
) -> list[SitemapUrl]:
    queue = list(seeds)
    seen = {canonicalize_url(url) for url in queue}
    results: dict[str, SitemapUrl] = {}
    while queue and len(results) < limit:
        url = canonicalize_url(queue.pop(0))
        if not robots.can_fetch(user_agent, url):
            continue
        try:
            response = fetch(session, url)
        except Exception:
            continue
        content_type = response.headers.get("content-type", "")
        if "html" not in content_type.lower():
            continue
        results[url] = SitemapUrl(url)
        try:
            doc = html.fromstring(response.text)
            for href in doc.xpath("//a/@href"):
                if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
                    continue
                absolute = canonicalize_url(urljoin(url, href))
                if same_site(absolute, allowed_hosts) and absolute not in seen:
                    seen.add(absolute)
                    queue.append(absolute)
        except Exception:
            pass
        if delay:
            time.sleep(delay)
    return list(results.values())


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def crawl(args: argparse.Namespace) -> None:
    output_dir = Path(args.output).resolve()
    pages_dir = output_dir / "pages"
    images_dir = output_dir / "images"
    pages_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    session = make_session(args.user_agent)
    allowed_hosts = {host.strip().lower() for host in args.allowed_host if host.strip()}
    robots = read_robots(session, args.start, args.user_agent)

    page_items: list[SitemapUrl]
    sitemap_urls: list[str] = []
    if args.mode in {"sitemap", "both"}:
        page_items, sitemap_urls = collect_from_sitemap(session, args.start, allowed_hosts, args.delay)
    else:
        page_items = []

    if args.mode in {"links", "both"}:
        seeds = [args.seed or f"https://{next(iter(allowed_hosts))}/"]
        link_items = discover_by_links(
            session,
            seeds,
            allowed_hosts,
            robots,
            args.user_agent,
            args.max_pages,
            args.delay,
        )
        by_url = {canonicalize_url(item.url): item for item in page_items}
        for item in link_items:
            by_url.setdefault(canonicalize_url(item.url), item)
        page_items = list(by_url.values())

    page_items = page_items[: args.max_pages] if args.max_pages else page_items
    all_pages_path = output_dir / "all_pages.jsonl"
    stats = {
        "started_at": now_iso(),
        "start": args.start,
        "allowed_hosts": sorted(allowed_hosts),
        "mode": args.mode,
        "sitemaps": sitemap_urls,
        "pages_discovered": len(page_items),
        "pages_ok": 0,
        "pages_error": 0,
        "images_ok": 0,
        "images_error": 0,
        "errors": [],
    }
    global_image_cache: dict[str, dict] = {}

    with all_pages_path.open("w", encoding="utf-8") as jsonl:
        for index, item in enumerate(page_items, start=1):
            url = canonicalize_url(item.url)
            if not robots.can_fetch(args.user_agent, url):
                stats["errors"].append({"url": url, "error": "blocked by robots.txt"})
                stats["pages_error"] += 1
                continue
            try:
                response = fetch(session, url)
                content_type = response.headers.get("content-type", "")
                if "html" not in content_type.lower():
                    continue
                page = parse_page(response.text, url, allowed_hosts, item.lastmod)
                if args.download_images:
                    download_images(session, page, images_dir, args.max_image_bytes, args.delay, global_image_cache)
                page["sequence"] = index
                page_path = pages_dir / f"{page['id']}.json"
                write_json(page_path, page)
                jsonl.write(json.dumps(page, ensure_ascii=False) + "\n")
                jsonl.flush()
                stats["pages_ok"] += 1
                stats["images_ok"] += sum(1 for image in page["images"] if image["download_status"] == "ok")
                stats["images_error"] += sum(1 for image in page["images"] if image["download_status"] == "error")
                print(f"[{index}/{len(page_items)}] OK {url} ({len(page['images'])} images)")
            except Exception as exc:
                stats["pages_error"] += 1
                stats["errors"].append({"url": url, "error": str(exc)})
                print(f"[{index}/{len(page_items)}] ERROR {url}: {exc}", file=sys.stderr)
            if args.delay:
                time.sleep(args.delay)

    stats["finished_at"] = now_iso()
    stats["unique_image_urls_seen"] = len(global_image_cache)
    write_json(output_dir / "manifest.json", stats)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Crawl Duke Kunshan University website into JSON.")
    parser.add_argument("--start", default=DEFAULT_START, help="Sitemap URL to start from.")
    parser.add_argument("--seed", default="https://www.dukekunshan.edu.cn/", help="Seed URL for link crawl mode.")
    parser.add_argument("--output", default="duke_kunshan_site", help="Output directory.")
    parser.add_argument(
        "--allowed-host",
        action="append",
        default=["www.dukekunshan.edu.cn", "dukekunshan.edu.cn"],
        help="Allowed host. Repeat to add more.",
    )
    parser.add_argument("--mode", choices=["sitemap", "links", "both"], default="sitemap")
    parser.add_argument("--max-pages", type=int, default=0, help="0 means no explicit page limit.")
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between requests in seconds.")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
    parser.add_argument("--download-images", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--max-image-bytes", type=int, default=25_000_000)
    return parser


if __name__ == "__main__":
    crawl(build_parser().parse_args())
