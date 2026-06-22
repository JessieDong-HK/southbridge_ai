# NYU Shanghai Official Site Crawl

Source: https://shanghai.nyu.edu/

This archive stores public NYU Shanghai website content in AI-friendly JSON.

- `all_pages.jsonl`: one page per line, best for batch AI processing.
- `all_pages.json`: same pages as a JSON array.
- `pages/`: individual page JSON files.
- `images/_shared/`: downloaded images. Each page's `images[]` array points to the shared local path with `local_path`.
- `manifest.json`: counts and crawl metadata.

Counts:

- Pages: 2569
- Image references: 17577
- Unique image URLs: 8127
- Low-text/list pages: 435
- Image status: {"downloaded": 4498, "error": 3542, "skipped_too_large": 86, "skipped_non_image": 1}

Notes:

- The site did not expose a sitemap, so content was discovered from public internal links.
- Some public links returned 403, 404, timeout, or 500 from the website; inaccessible pages are not included as content pages.
- Video and gallery areas contain many repeated list pages. They are preserved where crawled, but the crawl was stopped once video index expansion became mostly repetitive.
