import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'https://follow.art/';
const OUTPUT_DIR = 'docs/research';
const SCREENSHOTS_DIR = 'docs/design-references';

// Ensure directories exist
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Navigating to', URL, '...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait a bit for any animations to settle
  await page.waitForTimeout(3000);

  console.log('Page loaded. Extracting...');

  // 1. Full page screenshot (desktop)
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'full-page-desktop.png'),
    fullPage: true
  });
  console.log('✓ Full-page desktop screenshot saved');

  // 2. Extract global design tokens
  const designTokens = await page.evaluate(() => {
    // Colors
    const bodyStyles = getComputedStyle(document.body);
    const allElements = [...document.body.querySelectorAll('*')].slice(0, 300);
    const colors = new Set();
    const bgColors = new Set();
    allElements.forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)') colors.add(cs.color);
      if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgColors.add(cs.backgroundColor);
    });

    // Fonts
    const fonts = new Set();
    allElements.forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.fontFamily) fonts.add(cs.fontFamily);
    });

    // Favicons / SEO
    const favicons = [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({
      href: l.href,
      sizes: l.getAttribute('sizes'),
      rel: l.rel
    }));

    return {
      bodyBackground: bodyStyles.backgroundColor,
      bodyColor: bodyStyles.color,
      colors: [...colors].slice(0, 60),
      bgColors: [...bgColors].slice(0, 40),
      fonts: [...fonts],
      favicons,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    };
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'DESIGN_TOKENS.json'),
    JSON.stringify(designTokens, null, 2)
  );
  console.log('✓ Design tokens extracted');

  // 3. Extract page topology - all major sections
  const topology = await page.evaluate(() => {
    // Find all direct children of body and main semantic sections
    const sections = [];

    // Look for semantic sections, header, footer, main
    const semanticTags = ['header', 'main', 'footer', 'section', 'nav', 'article'];
    semanticTags.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.height > 20) { // Skip tiny/empty elements
          const cs = getComputedStyle(el);
          sections.push({
            tag,
            classes: el.className?.toString().slice(0, 150),
            id: el.id || null,
            position: cs.position,
            top: Math.round(rect.top),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            zIndex: cs.zIndex,
            isSticky: cs.position === 'sticky' || cs.position === 'fixed',
            childCount: el.children.length,
            textPreview: el.textContent?.trim().slice(0, 100)
          });
        }
      });
    });

    // Also scan for major div-based sections (by large height or special classes)
    document.querySelectorAll('div[class*="section"], div[class*="Section"], div[class*="hero"], div[class*="Hero"], div[class*="feature"], div[class*="Feature"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 100) {
        sections.push({
          tag: 'div (named section)',
          classes: el.className?.toString().slice(0, 200),
          id: el.id || null,
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          textPreview: el.textContent?.trim().slice(0, 100)
        });
      }
    });

    return sections.sort((a, b) => a.top - b.top);
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'PAGE_TOPOLOGY.json'),
    JSON.stringify(topology, null, 2)
  );
  console.log('✓ Page topology extracted (' + topology.length + ' sections)');

  // 4. Extract detailed component structure for each major section
  const componentDetails = [];
  for (let i = 0; i < topology.length; i++) {
    const section = topology[i];
    const selector = section.id
      ? `#${section.id}`
      : (section.tag.startsWith('div')
          ? `${section.tag.split(' ')[0]}.${section.classes.split(' ')[0]}`
          : section.tag);

    try {
      const detail = await page.evaluate(({ idx, tag, selector }) => {
        const el = document.querySelector(tag + (selector.includes('.') ? selector : ''));
        if (!el) {
          // Try finding by position
          const all = [...document.querySelectorAll('header, section, footer, nav, article, main')];
          const found = all[idx];
          if (!found) return { error: 'Element not found' };
          return extractComponent(found, idx);
        }
        return extractComponent(el, idx);

        function extractComponent(el, idx) {
          const rect = el.getBoundingClientRect();
          const cs = getComputedStyle(el);

          function walkChildren(element, depth = 0) {
            if (depth > 3) return null;
            const children = [...element.children].slice(0, 15);
            return {
              tag: element.tagName.toLowerCase(),
              classes: element.className?.toString().slice(0, 150),
              styles: {
                display: cs.display,
                position: cs.position,
                padding: cs.padding,
                margin: cs.margin,
                maxWidth: cs.maxWidth,
                backgroundColor: cs.backgroundColor,
                borderRadius: cs.borderRadius,
                boxShadow: cs.boxShadow,
                gap: cs.gap,
              },
              textPreview: element.textContent?.trim().slice(0, 150),
              childCount: element.children.length,
              children: children.map(c => {
                const ccs = getComputedStyle(c);
                return {
                  tag: c.tagName.toLowerCase(),
                  classes: c.className?.toString().slice(0, 100),
                  styles: {
                    fontSize: ccs.fontSize,
                    fontWeight: ccs.fontWeight,
                    color: ccs.color,
                    display: ccs.display,
                    padding: ccs.padding,
                    margin: ccs.margin,
                    borderRadius: ccs.borderRadius,
                    background: ccs.background,
                    backgroundImage: ccs.backgroundImage !== 'none' ? ccs.backgroundImage.slice(0, 100) : null,
                    transform: ccs.transform !== 'none' ? ccs.transform : null,
                    opacity: ccs.opacity !== '1' ? ccs.opacity : null,
                    position: ccs.position,
                    boxShadow: ccs.boxShadow !== 'none' ? ccs.boxShadow : null,
                    gap: ccs.gap,
                    flexDirection: ccs.flexDirection,
                  },
                  textPreview: c.textContent?.trim().slice(0, 100),
                  childCount: c.children.length,
                  hasImg: c.querySelectorAll('img').length,
                  hasVideo: c.querySelectorAll('video').length,
                  hasSvg: c.querySelectorAll('svg').length,
                };
              })
            };
          }

          return walkChildren(el);
        }
      }, { idx: i, tag: section.tag, selector: section.classes?.split(' ')[0] || '' });

      componentDetails.push({ index: i, ...section, detail });
    } catch(e) {
      componentDetails.push({ index: i, ...section, detail: { error: e.message } });
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'COMPONENT_DETAILS.json'),
    JSON.stringify(componentDetails, null, 2)
  );
  console.log('✓ Component details extracted');

  // 5. Extract all images
  const images = await page.evaluate(() => {
    return [...document.querySelectorAll('img')].map(img => ({
      src: img.src || img.currentSrc,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      parentClasses: img.parentElement?.className?.slice(0, 100),
      position: getComputedStyle(img).position,
    }));
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'IMAGES.json'),
    JSON.stringify(images, null, 2)
  );
  console.log('✓ Images extracted (' + images.length + ' images)');

  // 6. Extract all videos
  const videos = await page.evaluate(() => {
    return [...document.querySelectorAll('video')].map(v => ({
      src: v.src || [...v.querySelectorAll('source')].map(s => s.src),
      poster: v.poster,
      autoplay: v.autoplay,
      loop: v.loop,
      muted: v.muted,
      width: v.videoWidth,
      height: v.videoHeight,
    }));
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'VIDEOS.json'),
    JSON.stringify(videos, null, 2)
  );
  console.log('✓ Videos extracted (' + videos.length + ' videos)');

  // 7. Mobile screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'full-page-mobile.png'),
    fullPage: true
  });
  console.log('✓ Full-page mobile screenshot saved');

  // 8. Extract the full HTML (simplified)
  const html = await page.content();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'page-source.html'), html);
  console.log('✓ Page HTML saved');

  // 9. Extract all inline SVGs
  const svgs = await page.evaluate(() => {
    return [...document.querySelectorAll('svg')].slice(0, 30).map(svg => {
      const clone = svg.cloneNode(true);
      return {
        outerHTML: clone.outerHTML?.slice(0, 2000),
        width: svg.getAttribute('width'),
        height: svg.getAttribute('height'),
        viewBox: svg.getAttribute('viewBox'),
        classes: svg.className?.toString(),
      };
    });
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'SVGS.json'),
    JSON.stringify(svgs, null, 2)
  );
  console.log('✓ SVGs extracted (' + svgs.length + ' inline SVGs)');

  console.log('\n=== EXTRACTION COMPLETE ===');
  console.log('Output files in docs/research/ and docs/design-references/');

  await browser.close();
}

main().catch(err => {
  console.error('Extraction failed:', err.message);
  process.exit(1);
});
