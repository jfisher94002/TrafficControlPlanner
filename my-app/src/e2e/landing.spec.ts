/**
 * Landing page E2E tests
 */
import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('loads at /', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/TCP Plan Pro/i)
    await expect(page.getByText(/Traffic Control/i).first()).toBeVisible()
  })

  test('CTA button navigates to /app', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /launch app|get started|open app/i }).first().click()
    await expect(page).toHaveURL(/\/app/)
  })

  test('TCP logo links to landing page from app', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('link', { name: /TCP|logo/i }).first().click()
    await expect(page).toHaveURL('/')
  })
})
