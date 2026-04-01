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
    await page.getByTestId('home-link').click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Contact Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('nav Contact link opens the modal', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Contact us')).toBeVisible()
  })

  test('modal displays the contact email address', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('jfisher@fisherconsulting.org')).toBeVisible()
  })

  test('modal close button dismisses the modal', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Close contact dialog' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking the backdrop dismisses the modal', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.mouse.click(10, 10) // click outside the dialog panel
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('"Open in email client" link has correct mailto href', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact' }).click()
    const mailtoLink = page.getByRole('link', { name: /open in email client/i })
    await expect(mailtoLink).toHaveAttribute('href', 'mailto:jfisher@fisherconsulting.org')
  })

  test('footer contact link also opens the modal', async ({ page }) => {
    await page.locator('#footer-contact-link').click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
