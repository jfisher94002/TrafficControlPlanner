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

    expect(canonical).toBe('https://tcplanpro.com/')
    expect(ogUrl).toBe(canonical)
  })

  it('declares a consistent Open Graph and Twitter preview image', () => {
    const ogImage = getMetaContent('property', 'og:image')
    const twitterImage = getMetaContent('name', 'twitter:image')

    expect(ogImage).toBe('https://tcplanpro.com/og-image.png')
    expect(twitterImage).toBe(ogImage)
  })

  it('includes core social/SEO metadata fields', () => {
    expect(getMetaContent('name', 'description')).toBeTruthy()
    expect(getMetaContent('name', 'robots')).toBe('index, follow')
    expect(getMetaContent('property', 'og:type')).toBe('website')
    expect(getMetaContent('name', 'twitter:card')).toBe('summary_large_image')
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

  it('keeps the hero h1 aligned with the SEO headline', () => {
    const heading = documentFromHtml.querySelector('section.hero h1')

    expect(heading?.textContent).toContain('Traffic control plan software')
    expect(heading?.textContent?.toLowerCase()).toContain('built for the field')
  })
})
