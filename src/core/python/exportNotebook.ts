import type { PythonExecutionResult } from './types'

export interface ExportNotebookOptions {
  fileName?: string
  runs: PythonExecutionResult[]
}

/**
 * Generates and triggers download of a valid Jupyter Notebook (.ipynb v4)
 * containing the executed Python code, console outputs, and base64-encoded plots.
 */
export function exportToJupyterNotebook({ fileName = 'analysis', runs }: ExportNotebookOptions): void {
  const cells = []

  // Title header cell
  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: [
      `# Lumina Tabula Data Science Analysis\n`,
      `**Dataset:** \`${fileName}\`  \n`,
      `**Generated:** ${new Date().toLocaleString()}  \n`,
      `*Automated browser analytics powered by Lumina Tabula.*`,
    ],
  })

  // Add each run as a notebook code cell with outputs
  runs.forEach((run, idx) => {
    // Optional markdown separator between multiple runs
    if (runs.length > 1) {
      cells.push({
        cell_type: 'markdown',
        metadata: {},
        source: [`### Run ${runs.length - idx} (${run.elapsedMs}ms)`],
      })
    }

    const outputs = []

    // 1. Stdout stream
    if (run.stdout) {
      outputs.push({
        name: 'stdout',
        output_type: 'stream',
        text: run.stdout.split('\n').map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line)),
      })
    }

    // 2. Base64 plots
    run.images.forEach((dataUrl) => {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
      outputs.push({
        output_type: 'display_data',
        metadata: {},
        data: {
          'image/png': base64Data,
          'text/plain': ['<Figure plot>'],
        },
      })
    })

    // 3. Error traceback
    if (run.error) {
      outputs.push({
        output_type: 'error',
        ename: 'ExecutionError',
        evalue: run.error.split('\n')[0] || 'Error',
        traceback: run.error.split('\n'),
      })
    }

    cells.push({
      cell_type: 'code',
      execution_count: idx + 1,
      metadata: {},
      source: run.code.split('\n').map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line)),
      outputs,
    })
  })

  const notebook = {
    cells,
    metadata: {
      language_info: {
        name: 'python',
        version: '3.12.0',
        mimetype: 'text/x-python',
        codemirror_mode: {
          name: 'ipython',
          version: 3,
        },
        file_extension: '.py',
      },
      kernelspec: {
        name: 'python3',
        display_name: 'Python 3',
        language: 'python',
      },
    },
    nbformat: 4,
    nbformat_minor: 4,
  }

  const blob = new Blob([JSON.stringify(notebook, null, 2)], {
    type: 'application/x-ipynb+json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName.replace(/\.[^/.]+$/, '')}-notebook.ipynb`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
