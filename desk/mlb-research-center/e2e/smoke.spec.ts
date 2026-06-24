import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('homepage loads without error', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText(/Dashboard|Research|MLB/)
    await expect(page).toHaveTitle(/MLB Research/)
  })

  test('settings page renders', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page).toHaveTitle(/Settings/)
  })

  test('pitchers page loads', async ({ page }) => {
    await page.goto('/pitchers')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page).toHaveTitle(/Starting Pitchers/)
  })

  test('scoreboard page loads', async ({ page }) => {
    await page.goto('/scoreboard')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('search page works', async ({ page }) => {
    await page.goto('/search')
    await expect(page.locator('input[aria-label="Search query"]')).toBeVisible()
  })

  test('season series page loads', async ({ page }) => {
    await page.goto('/season-series')
    await expect(page.locator('h1')).toContainText(/Season Series/)
  })

  test('compare page loads', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.locator('h1')).toContainText(/Player Comparison/)
  })

  test('404 page is handled', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page).toHaveTitle(/MLB Research/)
  })
})

test.describe('Navigation', () => {
  test('sidebar links navigate correctly', async ({ page }) => {
    await page.goto('/')
    const sidebar = page.locator('nav')
    await expect(sidebar).toBeVisible()
    await sidebar.getByText(/Scoreboard/).first().click()
    await expect(page).toHaveURL(/\/scoreboard/)
    await page.goBack()
    await sidebar.getByText(/Pitchers/).first().click()
    await expect(page).toHaveURL(/\/pitchers/)
  })
})
