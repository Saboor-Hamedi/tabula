import { memo, useMemo } from 'react'
import { formatCount } from '../../../core/utils/format'
import { ActivityIcon, ArrowUpIcon, FileIcon, SearchIcon, TableIcon } from '../../common/Icons'
import { MarkdownText } from '../../render/MarkdownText'
import { useSessionActions, useSessionState } from '../../SessionProvider'

interface StarterItem {
  icon: typeof ActivityIcon
  title: string
  desc: string
  prompt: string
}

export const Welcome = memo(function Welcome() {
  const { activeSession, digest, isStreaming } = useSessionState()
  const { sendMessage } = useSessionActions()

  const summary = useMemo(() => {
    if (!activeSession) return null

    const totalRows = activeSession.tables?.reduce((sum, t) => sum + (t.rowCount || 0), 0) ?? 0
    const primaryTable = activeSession.primaryTable || activeSession.tables?.[0]?.name || 'dataset'
    const digestTable = digest?.tables?.find((t) => t.name === primaryTable) || digest?.tables?.[0]
    const columns = digestTable?.columns ?? []

    const numericCols = columns.filter((c) =>
      /int|float|double|decimal|num|real/i.test(c.type),
    )
    const categoricalCols = columns.filter(
      (c) =>
        /char|text|str|varchar/i.test(c.type) ||
        (!/int|float|double|decimal|num|real|date|time|bool/i.test(c.type) && c.distinctCount > 1),
    )

    const numSamples = numericCols.slice(0, 5).map((c) => `\`${c.name}\``)
    const catSamples = categoricalCols.slice(0, 5).map((c) => `\`${c.name}\``)

    let paragraph = `This dataset contains **${formatCount(totalRows)}** records across **${columns.length || activeSession.tables?.[0]?.columnCount || 0}** columns in the \`${primaryTable}\` table.`

    if (numericCols.length > 0 && categoricalCols.length > 0) {
      paragraph += ` It features **${numericCols.length}** quantitative metrics (${numSamples.join(', ')}${numericCols.length > 5 ? ', …' : ''}) alongside **${categoricalCols.length}** categorical dimensions (${catSamples.join(', ')}${categoricalCols.length > 5 ? ', …' : ''}).`
    } else if (numericCols.length > 0) {
      paragraph += ` It features **${numericCols.length}** quantitative metrics (${numSamples.join(', ')}).`
    } else if (categoricalCols.length > 0) {
      paragraph += ` It features **${categoricalCols.length}** categorical dimensions (${catSamples.join(', ')}).`
    }

    paragraph += ' Ask any question to analyze distributions, compare categories, or run calculations in natural language.'

    // 4 great suggestion questions tailored to the dataset
    const starters: StarterItem[] = []

    if (numericCols.length >= 2) {
      const n1 = numericCols[0].name
      const n2 = numericCols[1].name
      starters.push({
        icon: TableIcon,
        title: 'Correlations & Metrics',
        desc: `Analyze relationships between ${n1} and ${n2}`,
        prompt: `Analyze the statistical correlation and distribution between ${n1} and ${n2} in ${primaryTable}. Provide summary stats and highlight any notable patterns.`,
      })
    } else {
      starters.push({
        icon: TableIcon,
        title: 'Metric Distributions',
        desc: 'Analyze statistical distributions of key numbers',
        prompt: `Analyze the statistical distribution of numeric variables in ${primaryTable}. Provide mean, median, IQR, and variance.`,
      })
    }

    if (categoricalCols.length > 0 && numericCols.length > 0) {
      const cat = categoricalCols[0].name
      const num = numericCols[numericCols.length - 1].name
      starters.push({
        icon: ActivityIcon,
        title: 'Category Breakdown',
        desc: `Segment ${num} across ${cat} groups`,
        prompt: `Group and aggregate ${num} across different ${cat} categories in ${primaryTable}. Show comparative rankings and summaries.`,
      })
    } else {
      starters.push({
        icon: ActivityIcon,
        title: 'Executive Summary',
        desc: 'Descriptive statistics & key metric highlights',
        prompt: `Provide an executive summary and descriptive statistics for the ${primaryTable} dataset.`,
      })
    }

    starters.push({
      icon: SearchIcon,
      title: 'Data Quality Audit',
      desc: 'Check null rates, duplicates & anomalies',
      prompt: `Audit data quality: check missing values, null percentages, distinct counts, and potential anomalies in ${primaryTable}.`,
    })

    starters.push({
      icon: FileIcon,
      title: 'Schema & Records',
      desc: 'Preview column types and first 10 rows',
      prompt: `Display the column schema with data types and show the first 10 sample records from ${primaryTable}.`,
    })

    return {
      paragraph,
      starters: starters.slice(0, 4),
    }
  }, [activeSession, digest])

  if (!activeSession || !summary) {
    return (
      <article className="message message-assistant message-welcome-plain">
        <div className="markdown">
          <p>
            Upload a CSV or Excel spreadsheet to start exploring your data with DuckDB WASM and Python.
          </p>
        </div>
      </article>
    )
  }

  const { paragraph, starters } = summary

  return (
    <article className="message message-assistant message-welcome-plain">
      <MarkdownText content={paragraph} />

      {/* 4 suggestion questions in a clean 2-column grid, NO 'Ask next' header */}
      <div className="welcome-suggestions-grid">
        {starters.map((starter) => {
          const Icon = starter.icon
          return (
            <button
              key={starter.title}
              type="button"
              className="welcome-suggestion-card"
              disabled={isStreaming}
              onClick={() => void sendMessage(starter.prompt)}
            >
              <div className="welcome-suggestion-icon">
                <Icon size={15} />
              </div>
              <div className="welcome-suggestion-body">
                <span className="welcome-suggestion-title">{starter.title}</span>
                <span className="welcome-suggestion-desc">{starter.desc}</span>
              </div>
              <div className="welcome-suggestion-arrow">
                <ArrowUpIcon size={13} />
              </div>
            </button>
          )
        })}
      </div>
    </article>
  )
})
