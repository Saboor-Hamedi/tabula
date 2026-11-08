/**
 * Browser-side helpers for handing a stored dataset back to the OS.
 *
 * A web page cannot launch Excel directly. What it can do is hand the original
 * bytes back to the browser as a download, and the operating system then opens
 * the file with whatever application is registered for `.xlsx` or `.csv` —
 * which is Excel on a machine that has it installed. That is the honest maximum
 * for a browser app, so the UI labels the action accordingly.
 */

/** Downloads a file without uploading it anywhere. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Human-readable extension without the leading dot. */
export function fileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName)
  return match ? match[1].toUpperCase() : 'FILE'
}

/** True when the OS is likely to have a spreadsheet app for this file. */
export function isSpreadsheetFile(fileName: string): boolean {
  const extension = fileExtension(fileName)
  return extension === 'XLSX' || extension === 'CSV'
}
