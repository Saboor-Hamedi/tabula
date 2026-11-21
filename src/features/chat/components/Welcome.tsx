import { memo, useMemo } from 'react'
import {
  buildLocalSuggestions,
  findDimensions,
  findEntityColumn,
  findMeasures,
  humanizeColumn,
} from '../../../core/agent/suggestions'
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

const STARTER_ICONS = [ActivityIcon, TableIcon, SearchIcon, FileIcon]

export const Welcome = memo(function Welcome() {
  const { activeSession, sessions, digest, isStreaming } = useSessionState()
  const { sendMessage } = useSessionActions()

  const summary = useMemo(() => {
    if (!activeSession) return null

    const totalRows = activeSession.tables?.reduce((sum, t) => sum + (t.rowCount || 0), 0) ?? 0
    const primaryTable = activeSession.primaryTable || activeSession.tables?.[0]?.name || 'dataset'
    const digestTable = digest?.tables?.find((t) => t.name === primaryTable) || digest?.tables?.[0]
    const columns = digestTable?.columns ?? []
    const realColumns = columns.filter((c) => !/^column_\d+$/i.test(c.name.trim()))
    const displayColumns = realColumns.length > 0 ? realColumns : columns

    const measures = findMeasures(displayColumns)
    const dimensions = findDimensions(displayColumns, totalRows)
    const entityCol = findEntityColumn(displayColumns, totalRows)
    const colsWithBlanks = displayColumns.filter(
      (c) => typeof c.nullPct === 'number' && c.nullPct >= 1,
    )

    const measureNames = measures.slice(0, 3).map((c) => `**${humanizeColumn(c.name)}**`)
    const dimNames = dimensions.slice(0, 3).map((c) => `**${humanizeColumn(c.name)}**`)

    let paragraph = `Loaded **${formatCount(totalRows)}** rows across **${displayColumns.length || activeSession.tables?.[0]?.columnCount || 0}** columns`
    if (sessions.length > 1) {
      paragraph += ` (${sessions.length} uploaded sources active in workspace).`
    } else {
      paragraph += '.'
    }

    if (measureNames.length > 0 && dimNames.length > 0) {
      paragraph += ` Key metrics include ${measureNames.join(', ')}, grouped by ${dimNames.join(', ')}.`
    } else if (measureNames.length > 0) {
      paragraph += ` Key numeric metrics include ${measureNames.join(', ')}.`
    } else if (dimNames.length > 0) {
      paragraph += ` Key dimensions include ${dimNames.join(', ')}.`
    }

    if (colsWithBlanks.length > 0) {
      paragraph += ` Note: **${colsWithBlanks.length}** column${colsWithBlanks.length === 1 ? '' : 's'} contain missing values.`
    }

    // Build data-driven suggestions from the real schema, values, and loaded sources
    const localPrompts = buildLocalSuggestions(activeSession, digest, {
      allSessions: sessions,
    })

    const m1 = measures[0] ? humanizeColumn(measures[0].name) : null
    const m2 = measures[1] ? humanizeColumn(measures[1].name) : null
    const d1 = dimensions[0] ? humanizeColumn(dimensions[0].name) : null
    const ent = entityCol ? humanizeColumn(entityCol.name) : null

    const starters: StarterItem[] = localPrompts.slice(0, 4).map((prompt, idx) => {
      const Icon = STARTER_ICONS[idx % STARTER_ICONS.length]
      let title = 'Data Insight'
      if (/combine all|compare.*between/i.test(prompt)) {
        title = sessions.length > 2 ? `Compare All ${sessions.length} Files` : 'Compare Sources'
      } else if (/top \d+|rank/i.test(prompt)) {
        title = ent && m1 ? `Top ${ent} by ${m1}` : m1 ? `Top Rankings by ${m1}` : 'Top Performers'
      } else if (/share of|across each/i.test(prompt)) {
        title = d1 && m1 ? `${m1} by ${d1}` : 'Category Breakdown'
      } else if (/trended over|changed over/i.test(prompt)) {
        title = m1 ? `${m1} Trend` : 'Time Trend'
      } else if (/compare.*and/i.test(prompt) && m1 && m2) {
        title = `${m1} vs. ${m2}`
      } else if (/distribution|outlier/i.test(prompt)) {
        title = m1 ? `${m1} Distribution` : 'Distribution & Outliers'
      } else if (/missing values/i.test(prompt)) {
        title = 'Missing Values Check'
      }

      return {
        icon: Icon,
        title,
        desc: prompt,
        prompt,
      }
    })

    return {
      paragraph,
      starters,
    }
  }, [activeSession, digest, sessions])

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

      <div className="welcome-suggestions-grid">
        {starters.map((starter) => {
          const Icon = starter.icon
          return (
            <button
              key={starter.prompt}
              type="button"
              className="welcome-suggestion-card"
              disabled={isStreaming}
              onClick={() => void sendMessage(starter.prompt)}
              title={starter.prompt}
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
