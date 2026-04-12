import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, it, expect, vi, afterEach } from 'vitest'

const FEEDBACK_HTML = readFileSync(resolve(process.cwd(), 'public/feedback.html'), 'utf8')
const SCRIPT_MATCHES = [...FEEDBACK_HTML.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
const FEEDBACK_SCRIPT = SCRIPT_MATCHES[SCRIPT_MATCHES.length - 1]?.[1]

if (!FEEDBACK_SCRIPT) {
  throw new Error('Unable to locate inline script in public/feedback.html')
}

function bootFeedbackPage(search = '') {
  const dom = new JSDOM(FEEDBACK_HTML, {
    url: `https://example.com/feedback.html${search}`,
    runScripts: 'outside-only',
  })
  dom.window.eval(FEEDBACK_SCRIPT)
  return dom
}

describe('feedback.html', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('allows anonymous access without redirecting to /app', () => {
    const dom = bootFeedbackPage()
    const { window } = dom
    const { document } = window

    expect(window.location.pathname).toBe('/feedback.html')
    expect((document.getElementById('userNotice') as HTMLElement | null)?.style.display).toBe('none')
    expect((document.getElementById('submitterName') as HTMLInputElement | null)?.value).toBe('')
    dom.window.close()
  })

  it('shows signed-in notice and pre-fills name when email is provided', () => {
    const dom = bootFeedbackPage('?email=alice%40example.com&uid=user-123')
    const { document } = dom.window

    expect((document.getElementById('userNotice') as HTMLElement).style.display).toBe('flex')
    expect(document.getElementById('userNoticeText')?.textContent).toContain('alice@example.com')
    expect((document.getElementById('submitterName') as HTMLInputElement).value).toBe('alice@example.com')
    dom.window.close()
  })

  it('submits anonymous feedback with null identity fields', async () => {
    const dom = bootFeedbackPage()
    const { window } = dom
    const { document } = window
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/example/issues/101', issue_number: 101 }),
    })
    ;(window as unknown as { fetch: typeof fetch }).fetch = fetchMock

    ;(document.getElementById('issueTitle') as HTMLInputElement).value = 'Anonymous report'
    ;(document.getElementById('issueBody') as HTMLTextAreaElement).value = 'Steps to reproduce...'
    ;(document.getElementById('submitterName') as HTMLInputElement).value = 'QA User'

    await (window as unknown as { submitIssue: () => Promise<void> }).submitIssue()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/create-issue')
    const payload = JSON.parse(String(init.body))
    expect(payload.submitter_name).toBe('QA User')
    expect(payload.submitter_email).toBeNull()
    expect(payload.submitter_id).toBeNull()
    expect((document.getElementById('successState') as HTMLElement).classList.contains('visible')).toBe(true)
    dom.window.close()
  })
})
