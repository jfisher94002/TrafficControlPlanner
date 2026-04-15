import { expect, type Page } from '@playwright/test'

/**
 * Seeds a mapCenter into tcp_autosave localStorage before page load so that
 * tools in TOOLS_REQUIRING_MAP activate directly without showing the
 * address-required modal. Call via page.addInitScript() before page.goto().
 */
export function seedMapCenter(page: Page): Promise<void> {
  return page.addInitScript(() => {
    const autosave = JSON.parse(localStorage.getItem('tcp_autosave') || '{}')
    autosave.mapCenter = { lat: 37.77, lon: -122.41, zoom: 16 }
    localStorage.setItem('tcp_autosave', JSON.stringify(autosave))
  })
}

/** Opens the sign-in modal by clicking Export PDF on /app. */
export async function openSignInModal(page: Page) {
  await page.goto('/app')
  await expect(page.getByTestId('export-pdf-button')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('export-pdf-button').click()
  await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible({ timeout: 15_000 })
}

/** After a successful sign-in, the modal must close and authenticated UI must appear (canvas is visible for anonymous users too). */
export async function expectSignedIn(page: Page) {
  await expect(page.getByRole('tab', { name: 'Sign In' })).toBeHidden({ timeout: 20_000 })
  await expect(page.getByTestId('sign-out-button')).toBeVisible({ timeout: 20_000 })
}
