import { expect, type Page } from '@playwright/test'

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
