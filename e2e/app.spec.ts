import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import {
  installAdminAuth,
  installHermeticAuth,
  installMockModel,
  openWorkspace,
} from './support/auth'

async function uploadSample(page: import('@playwright/test').Page) {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Try a sample dataset' }).click()
  await expect(page.getByText('This dataset contains 420 records')).toBeVisible({
    timeout: 30_000,
  })
}

test('loads the sample dataset and offers dataset-specific questions', async ({ page }) => {
  await uploadSample(page)

  await expect(page.locator('.sidebar-section-count')).toHaveText('1 source · 420 rows')
  await expect(page.locator('.session-name')).toHaveText('orders.csv')
  await expect(page.getByRole('button', { name: /Data Quality Audit/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Schema & Records/ })).toBeVisible()
})

test('shows the table schema in the inspector after loading the sample', async ({ page }) => {
  await uploadSample(page)

  await page.getByRole('tab', { name: 'Data' }).click()
  await expect(page.locator('.file-table-name').first()).toHaveText('orders')
  await expect(page.locator('.file-column-name').first()).toHaveText('order_id')
  await expect(page.locator('.file-column-type').first()).toHaveText('bigint')
})

test('restores the dataset after a refresh', async ({ page }) => {
  await uploadSample(page)
  await page.reload()
  await expect(page.locator('.session-name')).toHaveText('orders.csv', {
    timeout: 30_000,
  })
  await expect(page.getByText('This dataset contains 420 records')).toBeVisible({
    timeout: 30_000,
  })
})

test('asks which sheets to import for large workbooks', async ({ page }) => {
  const workbook = XLSX.utils.book_new()
  for (let index = 1; index <= 30; index += 1) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['id', 'value'],
      [1, index],
      [2, index * 2],
      [3, index * 3],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, `Sheet_${String(index).padStart(2, '0')}`)
  }
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  await openWorkspace(page)
  await page.locator('.empty-screen input[type=file]').setInputFiles({
    name: 'many-sheets.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  })

  await expect(page.getByRole('heading', { name: 'Choose sheets' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText('many-sheets.xlsx has 30 sheets')).toBeVisible()
  await page.getByRole('button', { name: /Load 13 sheets/ }).click()
  await expect(page.locator('.session-name')).toHaveText('many-sheets.xlsx', {
    timeout: 45_000,
  })
  await expect(page.locator('.sidebar-section-count')).toHaveText('1 source · 39 rows', {
    timeout: 45_000,
  })
})

test('rejects an unsupported file type with an error', async ({ page }) => {
  await openWorkspace(page)
  await page.locator('.empty-screen input[type=file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a spreadsheet'),
  })
  await expect(page.getByRole('alert').first()).toContainText('Unsupported file type')
})

test('streams a model answer end to end', async ({ page }) => {
  const canned = 'E2E canned answer: the dataset holds 420 orders.'
  await installHermeticAuth(page)
  await installMockModel(page, canned)
  await page.goto('/workspace')
  await page.getByRole('button', { name: 'Try a sample dataset' }).click()
  await expect(page.getByText('This dataset contains 420 records')).toBeVisible({
    timeout: 30_000,
  })

  await page.getByLabel('Message the data agent').fill('How many orders are there?')
  await page.getByRole('button', { name: 'Send message' }).click()

  await expect(page.getByText(canned)).toBeVisible({ timeout: 45_000 })
})

test('toggles dark mode from the account menu on the landing page', async ({ page }) => {
  await installHermeticAuth(page)
  await page.goto('/landing')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'e2e@lumina.test' }).click()
  await page.getByRole('menuitem', { name: 'Dark mode' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('menuitem', { name: 'Light mode' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})

test('opens the admin settings dialog from the sidebar and closes it with Escape', async ({
  page,
}) => {
  await installAdminAuth(page)
  await page.goto('/workspace')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.locator('.sidebar-settings-btn').click()
  await expect(page.locator('.settings-modal')).toBeVisible()
  await expect(page.locator('#settings-title')).toHaveText(/Settings/)

  await page.keyboard.press('Escape')
  await expect(page.locator('.settings-modal')).toHaveCount(0)
})

test('deletes the source after a two-click confirm', async ({ page }) => {
  await uploadSample(page)

  await page.getByRole('button', { name: 'Delete session' }).click()
  await page.getByRole('button', { name: 'Confirm delete session' }).click()

  await expect(page.getByText('No sources yet')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.empty-screen')).toBeVisible()
})

test('opens the workbook in spreadsheet view and closes it', async ({ page }) => {
  await uploadSample(page)

  await page.getByRole('button', { name: 'Open orders.csv in spreadsheet view' }).click()
  const dialog = page.getByRole('dialog', { name: 'Spreadsheet workbook: orders.csv' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('order_total_usd')

  await page.getByRole('button', { name: 'Close workbook' }).click()
  await expect(dialog).toHaveCount(0)
})

test('shows an offline indicator', async ({ page, context }) => {
  await openWorkspace(page)
  await context.setOffline(true)
  await expect(page.locator('.offline-pill')).toBeVisible()
})
