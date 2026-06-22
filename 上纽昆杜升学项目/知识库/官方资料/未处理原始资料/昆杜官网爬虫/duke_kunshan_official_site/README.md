# Duke Kunshan University Website Crawl

Source site: https://www.dukekunshan.edu.cn/

Generated from the site's public Yoast sitemap:
https://www.dukekunshan.edu.cn/sitemap_index.xml

## Contents

- `manifest.json`: crawl summary, sitemap list, page/image counts, errors.
- `all_pages.jsonl`: one JSON object per page, convenient for AI batch processing.
- `all_pages.json`: all page records as one JSON array.
- `pages/*.json`: one pretty-printed JSON file per crawled page.
- `images/_shared/*`: downloaded images referenced by page JSON records.

## Page JSON Fields

- `id`: stable local page id.
- `url`: crawled URL.
- `canonical_url`: canonical URL from page metadata when available.
- `page_type`: first URL path segment, useful for filtering.
- `title`, `description`, `language`: page metadata.
- `published_time`, `modified_time`, `sitemap_lastmod`: available date metadata.
- `text`: extracted page text joined by newlines.
- `text_blocks`: structured text blocks with tag type, such as `h1`, `p`, `li`.
- `images`: image records for that page. `local_path` points to the downloaded local file when `download_status` is `ok`.
- `links`: internal/external links found in the extracted content area.
- `word_count_estimate`: approximate word/token-like count of `text`.
- `crawled_at`: crawl timestamp.

## Final Counts

- Pages discovered: 680
- Pages successfully saved: 680
- Page failures: 0
- Image files saved locally: 837
- Image references with local files: 2548
- Image download errors: 2
- Non-image metadata URLs skipped: 4

Two image URLs on `https://www.dukekunshan.edu.cn/about/scholarships` returned HTTP 500 during download. They remain listed in that page's JSON with `download_status: "error"` and no `local_path`.

Some sitemap URLs are menu/template/category/tag pages because they are included in the public sitemap. They are intentionally preserved so downstream processing can decide whether to keep or discard them.
