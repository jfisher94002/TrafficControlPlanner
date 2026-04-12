import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, afterEach } from 'vitest'

const FEEDBACK_HTML = readFileSync(new URL('../../public/feedback.html', import.meta.url), 'utf8')
const SCRIPT_MATCHES = [...FEEDBACK_HTML.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
const FEEDBACK_SCRIPT = SCRIPT_MATCHES[SCRIPT_MATCHES.length - 1]?.[1]

if (!FEEDBACK_SCRIPT) {
  throw new Error('Unable to locate inline script in public/feedback.html')
}

function bootFeedbackPage(search = '') {
  window.history.replaceState({}, '', `/feedback.html${search}`)
  document.open()
  document.write(FEEDBACK_HTML)
  document.close()
  window.eval(FEEDBACK_SCRIPT)
}

describe('feedback.html', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('allows anonymous access without redirecting to /app', () => {
    const replaceSpy = vi.spyOn(Location.prototype, 'replace')

    bootFeedbackPage()

    expect(replaceSpy).not.toHaveBeenCalled()
    expect((document.getElementById('userNotice') as HTMLElement).style.display).toBe('none')
    expect((document.getElementById('submitterName') as HTMLInputElement).value).toBe('')
  })

  it('shows signed-in notice and pre-fills name when email is provided', () => {
    bootFeedbackPage('?email=alice%40example.com&uid=user-123')

    expect((document.getElementById('userNotice') as HTMLElement).style.display).toBe('flex')
    expect(document.getElementById('userNoticeText')?.textContent).toContain('alice@example.com')
    expect((document.getElementById('submitterName') as HTMLInputElement).value).toBe('alice@example.com')
  })

  it('submits anonymous feedback with null identity fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/example/issues/101', issue_number: 101 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    bootFeedbackPage()

    ;(document.getElementById('issueTitle') as HTMLInputElement).value = 'Anonymous report'
    ;(document.getElementById('issueBody') as HTMLTextAreaElement).value = 'Steps to reproduce...'
    ;(document.getElementById('submitterName') as HTMLInputElement).value = 'QA User'

    await (window as { submitIssue: () => Promise<void> }).submitIssue()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/create-issue')
    const payload = JSON.parse(String(init.body))
    expect(payload.submitter_name).toBe('QA User')
    expect(payload.submitter_email).toBeNull()
    expect(payload.submitter_id).toBeNull()
    expect((document.getElementById('successState') as HTMLElement).classList.contains('visible')).toBe(true)
  })
})
