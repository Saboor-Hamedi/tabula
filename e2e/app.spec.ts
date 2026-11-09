import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'

async function uploadSample(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a sample dataset' }).click()
  await expect(page.getByText('orders.csv is ready.')).toBeVisible({ timeout: 30_000 })
}

test('loads the sample dataset, renames it, and opens a report', async ({ page }) => {
  await uploadSample(page)

  await expect(page.getByText('Largest tables:')).toBeVisible()
  await expect(page.getByText('orders — 420 rows · 9 columns')).toBeVisible()

  await page.locator('.header-title-name').click()
  await page.locator('.header-title-input').fill('Renamed orders')
  await page.locator('.header-title-input').press('Enter')
  await expect(page.locator('.header-title-name')).toHaveText('Renamed orders')

  await page.getByRole('button', { name: 'Open report' }).click()
  await expect(page.getByRole('heading', { name: 'Renamed orders' })).toBeVisible()
  await expect(page.locator('.report-subtitle')).toContainText('Tabula report')
  await page.getByRole('button', { name: 'Close report' }).click()
})

test('restores the dataset and conversation after a refresh', async ({ page }) => {
  await uploadSample(page)
  await page.reload()
  await expect(page.getByText('orders.csv is ready.')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.header-title-name')).toHaveText('orders.csv')
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

  await page.goto('/')
  await page.locator('.empty-screen input[type=file]').setInputFiles({
    name: 'many-sheets.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  })

  await expect(page.getByRole('heading', { name: 'Choose sheets' })).toBeVisible()
  await expect(page.getByText('30 sheets')).toBeVisible()
  await page.getByRole('button', { name: /Load 13 sheets/ }).click()
  await expect(page.getByText('many-sheets.xlsx is ready.')).toBeVisible({
    timeout: 45_000,
  })
  await expect(page.getByText('Loaded 13 tables with 39 rows in total.')).toBeVisible()
})

test('shows an offline indicator', async ({ page, context }) => {
  await page.goto('/')
  await context.setOffline(true)
  await expect(page.getByText('Offline')).toBeVisible()
})
