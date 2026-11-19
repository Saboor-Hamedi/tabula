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

    const numSamples = numericCols.slice(0, 4).map((c) => `**${c.name}**`)
    const catSamples = categoricalCols.slice(0, 4).map((c) => `**${c.name}**`)
    const colsWithBlanks = columns.filter(
      (c) => typeof c.nullPct === 'number' && c.nullPct >= 1,
    )

    let paragraph = `This dataset contains **${formatCount(totalRows)}** records across **${columns.length || activeSession.tables?.[0]?.columnCount || 0}** columns.`

    if (numericCols.length > 0 && categoricalCols.length > 0) {
      paragraph += ` It includes **${numericCols.length}** number columns (${numSamples.join(', ')}${numericCols.length > 4 ? ', …' : ''}) and **${categoricalCols.length}** category columns (${catSamples.join(', ')}${categoricalCols.length > 4 ? ', …' : ''}).`
    } else if (numericCols.length > 0) {
      paragraph += ` It includes **${numericCols.length}** number columns (${numSamples.join(', ')}).`
    } else if (categoricalCols.length > 0) {
      paragraph += ` It includes **${categoricalCols.length}** category columns (${catSamples.join(', ')}).`
    }

    if (colsWithBlanks.length > 0) {
      paragraph += ` Heads up: **${colsWithBlanks.length}** column${colsWithBlanks.length === 1 ? '' : 's'} have some blank cells.`
    }

    paragraph += ' Pick a quick question below or ask anything in plain English.'

    // 4 friendly, plain-English starter questions tailored to the spreadsheet
    const starters: StarterItem[] = []

    if (numericCols.length >= 2) {
      const n1 = numericCols[0].name
      const n2 = numericCols[1].name
      starters.push({
        icon: TableIcon,
        title: 'Compare Key Numbers',
        desc: `See how ${n1} and ${n2} move together`,
        prompt: `Compare ${n1} and ${n2} in ${primaryTable} in plain English. Highlight the main pattern, typical ranges, and include a clear chart.`,
      })
    } else {
      starters.push({
        icon: TableIcon,
        title: 'Key Numbers Summary',
        desc: 'Averages, highs, lows, and typical ranges',
        prompt: `Summarize the main numbers in ${primaryTable} in plain English with averages, highs, lows, and a clear chart.`,
      })
    }

    if (categoricalCols.length > 0 && numericCols.length > 0) {
      const cat = categoricalCols[0].name
      const num = numericCols[numericCols.length - 1].name
      starters.push({
        icon: ActivityIcon,
        title: 'Top Performers',
        desc: `Compare ${num} across ${cat} groups`,
        prompt: `Compare ${num} across each ${cat} group in ${primaryTable}. Rank the top performers, explain the biggest differences in plain English, and include a clean chart.`,
      })
    } else {
      starters.push({
        icon: ActivityIcon,
        title: 'Executive Summary',
        desc: 'Key highlights & takeaways at a glance',
        prompt: `Write a clear executive summary of ${primaryTable} in plain English with the main takeaways and a chart.`,
      })
    }

    starters.push({
      icon: SearchIcon,
      title: 'Data Quality Audit',
      desc: 'Spot blank cells, duplicates & unusual values',
      prompt: `Check ${primaryTable} for blank cells, duplicate rows, and unusual values. Explain any issues in plain English and suggest how to clean them.`,
    })

    starters.push({
      icon: FileIcon,
      title: 'Schema & Records',
      desc: 'See every column and the first 10 rows',
      prompt: `Explain each column in ${primaryTable} in simple terms and show a clean preview of the first 10 rows.`,
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
            Upload a CSV or Excel spreadsheet to start exploring your data in plain English.
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
