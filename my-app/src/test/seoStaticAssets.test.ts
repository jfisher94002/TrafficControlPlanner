import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const thisDir = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(thisDir, '../../public')

describe('SEO static asset contracts', () => {
  it('declares a maskable app icon in site.webmanifest', () => {
    const manifestPath = resolve(publicDir, 'site.webmanifest')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const icons = Array.isArray(manifest.icons) ? manifest.icons : []

    expect(icons.length).toBeGreaterThan(0)
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        }),
      ]),
    )

    const maskableIcon = icons.find((icon: { purpose?: string }) =>
      icon.purpose?.split(/\s+/).includes('maskable'),
    )
    expect(maskableIcon).toBeTruthy()
  })

  it('keeps sitemap.xml pinned to the canonical home URL and current lastmod', () => {
    const sitemapPath = resolve(publicDir, 'sitemap.xml')
    const sitemap = readFileSync(sitemapPath, 'utf8')

    expect(sitemap).toContain('<loc>https://tcplanpro.com/</loc>')
    expect(sitemap).toContain('<lastmod>2026-04-24</lastmod>')
    expect(sitemap).toContain('<changefreq>monthly</changefreq>')
    expect(sitemap).toContain('<priority>1.0</priority>')
  })
})
