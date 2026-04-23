import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const appRoot = process.cwd()

function readAppFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(appRoot, relativePath), 'utf8')
}

describe('robots.txt', () => {
  it('allows crawling and points to the canonical sitemap', () => {
    const robots = readAppFile('robots.txt')

    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Sitemap: https://tcplanpro.com/sitemap.xml')
  })
})

describe('site.webmanifest', () => {
  it('contains required PWA metadata and icon entries', () => {
    const manifest = JSON.parse(readAppFile('site.webmanifest')) as {
      name?: string
      short_name?: string
      start_url?: string
      scope?: string
      display?: string
      theme_color?: string
      background_color?: string
      icons?: Array<{ src?: string; sizes?: string; type?: string }>
    }

    expect(manifest.name).toBe('TCP Plan Pro')
    expect(manifest.short_name).toBe('TCP Plan Pro')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#1A6EFF')
    expect(manifest.background_color).toBe('#F8FAFC')

    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      }),
      expect.objectContaining({
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      }),
    ]))
  })
})

describe('sitemap.xml', () => {
  it('includes canonical public URLs for indexing', () => {
    const sitemapXml = readAppFile('sitemap.xml')
    const xml = new DOMParser().parseFromString(sitemapXml, 'application/xml')
    const locValues = Array.from(xml.querySelectorAll('url > loc')).map((n) => n.textContent?.trim() ?? '')

    expect(locValues).toEqual([
      'https://tcplanpro.com/',
      'https://tcplanpro.com/app',
    ])
    expect(new Set(locValues).size).toBe(locValues.length)
  })
})
