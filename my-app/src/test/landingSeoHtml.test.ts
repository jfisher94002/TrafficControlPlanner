import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const thisDir = dirname(fileURLToPath(import.meta.url))
const indexHtmlPath = resolve(thisDir, '../../index.html')
const indexHtml = readFileSync(indexHtmlPath, 'utf8')
const documentFromHtml = new DOMParser().parseFromString(indexHtml, 'text/html')

function getMetaContent(name: string, value: string): string | null {
  return documentFromHtml
    .querySelector(`meta[${name}="${value}"]`)
    ?.getAttribute('content') ?? null
}

describe('landing page SEO HTML contract', () => {
  it('declares canonical and social URLs consistently', () => {
    const canonical = documentFromHtml.querySelector('link[rel="canonical"]')?.getAttribute('href')
    const ogUrl = getMetaContent('property', 'og:url')

    // URLs use %VITE_SITE_URL% template — substituted at build time, not test time
    expect(canonical).toContain('%VITE_SITE_URL%')
    expect(ogUrl).toBe(canonical)
  })

  it('declares a consistent Open Graph and Twitter preview image', () => {
    const ogImage = getMetaContent('property', 'og:image')
    const twitterImage = getMetaContent('name', 'twitter:image')

    // Images use %VITE_SITE_URL% template — substituted at build time, not test time
    expect(ogImage).toContain('%VITE_SITE_URL%')
    expect(ogImage).toContain('og-image.png')
    expect(twitterImage).toBe(ogImage)
  })

  it('includes og:image dimensions and alt text', () => {
    expect(getMetaContent('property', 'og:image:width')).toBe('1200')
    expect(getMetaContent('property', 'og:image:height')).toBe('630')
    expect(getMetaContent('property', 'og:image:alt')).toBeTruthy()
  })

  it('includes core social/SEO metadata fields', () => {
    expect(getMetaContent('name', 'description')).toBeTruthy()
    expect(getMetaContent('name', 'robots')).toBe('index, follow')
    expect(getMetaContent('property', 'og:type')).toBe('website')
    expect(getMetaContent('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('does not include the keywords meta tag (ignored/penalized by crawlers)', () => {
    expect(documentFromHtml.querySelector('meta[name="keywords"]')).toBeNull()
  })

  it('ships the favicon/manifest links added for browsers', () => {
    expect(
      documentFromHtml.querySelector('link[rel="icon"][href="/favicon.ico"][sizes="any"]'),
    ).toBeTruthy()
    expect(
      documentFromHtml.querySelector('link[rel="icon"][type="image/png"][sizes="16x16"][href="/favicon-16x16.png"]'),
    ).toBeTruthy()
    expect(
      documentFromHtml.querySelector('link[rel="icon"][type="image/png"][sizes="32x32"][href="/favicon-32x32.png"]'),
    ).toBeTruthy()
    expect(
      documentFromHtml.querySelector('link[rel="apple-touch-icon"][sizes="180x180"][href="/apple-touch-icon.png"]'),
    ).toBeTruthy()
    expect(
      documentFromHtml.querySelector('link[rel="manifest"][href="/site.webmanifest"]'),
    ).toBeTruthy()
  })

  it('includes msapplication tile image and color', () => {
    expect(getMetaContent('name', 'msapplication-TileImage')).toBe('/mstile-150x150.png')
    expect(getMetaContent('name', 'msapplication-TileColor')).toBeTruthy()
  })

  it('has a valid heading hierarchy (h1 → h2s)', () => {
    const h1s = documentFromHtml.querySelectorAll('h1')
    const h2s = documentFromHtml.querySelectorAll('h2')

    expect(h1s).toHaveLength(1)
    expect(h2s.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the hero h1 aligned with the SEO headline', () => {
    const heading = documentFromHtml.querySelector('section.hero h1')

    expect(heading?.textContent).toContain('Traffic Control Plan Software')
    expect(heading?.textContent?.toLowerCase()).toContain('built for the field')
  })

  it('includes JSON-LD SoftwareApplication structured data', () => {
    const ldScript = documentFromHtml.querySelector('script[type="application/ld+json"]')
    expect(ldScript).toBeTruthy()

    const schema = JSON.parse(ldScript!.textContent!)
    expect(schema['@type']).toBe('SoftwareApplication')
    expect(schema.name).toBe('TCP Plan Pro')
    expect(schema.applicationCategory).toBeTruthy()
    expect(schema.offers).toBeTruthy()
  })
})
