import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://follow.art/';
const OUTPUT_DIR = 'docs/research';

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Extract detailed text content and styles for each major section
  const sections = await page.evaluate(() => {
    const results = [];

    // 1. Hero Section
    const hero = document.querySelector('.intro--show, .intro');
    if (hero) {
      const titleEl = hero.querySelector('.intro__title, h1');
      const subtitleEl = hero.querySelector('.intro__subtitle, h2, .intro__description');
      results.push({
        name: 'Hero',
        title: titleEl?.textContent?.trim(),
        titleStyles: titleEl ? (() => {
          const cs = getComputedStyle(titleEl);
          return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, color: cs.color, letterSpacing: cs.letterSpacing };
        })() : null,
        subtitle: subtitleEl?.textContent?.trim(),
      });
    }

    // 2. All section titles/headings
    document.querySelectorAll('h1, h2, h3, h4, .section__title, [class*="title"]').forEach(el => {
      const cs = getComputedStyle(el);
      const text = el.textContent?.trim();
      if (text && text.length > 3 && text.length < 200) {
        results.push({
          name: 'Heading',
          text,
          tag: el.tagName,
          styles: {
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            color: cs.color,
            letterSpacing: cs.letterSpacing,
            marginBottom: cs.marginBottom,
          }
        });
      }
    });

    return results;
  });

  fs.writeFileSync('docs/research/TEXT_STYLES.json', JSON.stringify(sections, null, 2));
  console.log('✓ Text styles extracted (' + sections.length + ' items)');

  // Extract the main CSS by grabbing all stylesheets
  const cssText = await page.evaluate(() => {
    let result = '';
    document.querySelectorAll('style').forEach(s => result += s.textContent + '\n');
    return result.slice(0, 100000);
  });

  fs.writeFileSync('docs/research/inline-styles.css', cssText);
  console.log('✓ Inline styles extracted (' + cssText.length + ' chars)');

  // Extract detailed header content
  const headerContent = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const links = [...header.querySelectorAll('a')].map(a => ({
      text: a.textContent?.trim(),
      href: a.href,
      styles: (() => {
        const cs = getComputedStyle(a);
        return { fontSize: cs.fontSize, color: cs.color, padding: cs.padding };
      })()
    }));
    return { links };
  });
  fs.writeFileSync('docs/research/HEADER.json', JSON.stringify(headerContent, null, 2));
  console.log('✓ Header content extracted');

  // Extract footer
  const footer = await page.evaluate(() => {
    const footer = document.querySelector('footer, .section-10__footer, [class*="footer"]');
    if (!footer) return null;
    return { text: footer.textContent?.trim().slice(0, 1000), html: footer.outerHTML?.slice(0, 2000) };
  });
  fs.writeFileSync('docs/research/FOOTER.json', JSON.stringify(footer, null, 2));
  console.log('✓ Footer extracted');

  // Get CSS custom properties (design tokens)
  const cssVars = await page.evaluate(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const vars = {};
    // Common custom properties
    const props = [
      '--color-primary', '--color-secondary', '--color-accent',
      '--font-heading', '--font-body',
      '--ui-orange', '--ui-green', '--ui-background'
    ];
    props.forEach(p => {
      const v = cs.getPropertyValue(p);
      if (v) vars[p] = v;
    });
    return vars;
  });
  fs.writeFileSync('docs/research/CSS_VARS.json', JSON.stringify(cssVars, null, 2));

  console.log('\n=== DEEP EXTRACTION COMPLETE ===');
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
