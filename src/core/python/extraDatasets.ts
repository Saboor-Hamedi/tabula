import type { Session } from '../types'

export interface ExtraDatasetSpec {
  key: string
  schemaName: string
  tableName: string
}

/**
 * Builds canonical key -> (schema, table) mappings across uploaded sessions
 * so Python tools (`dfs`) and virtual files never duplicate or overwrite sheets.
 */
export function buildExtraDatasets(
  sessions?: Session[],
  fallbackSchema?: string,
  fallbackTables?: string[],
  maxTables = 30,
): ExtraDatasetSpec[] {
  const extraDatasets: ExtraDatasetSpec[] = []
  const seenPairs = new Set<string>()
  const usedKeys = new Set<string>()
  const safeSessions = Array.isArray(sessions) ? sessions : []
  let tableCount = 0

  for (const s of safeSessions) {
    const multiTableSession = (s.tables?.length ?? 0) > 1
    for (const t of s.tables ?? []) {
      if (tableCount >= maxTables) break
      const pairKey = `${s.schemaName}:${t.name}`
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)
      tableCount += 1

      let canonicalKey = multiTableSession
        ? s.fileName
          ? `${s.fileName} (${t.name})`
          : t.name
        : s.fileName || t.name
      if (usedKeys.has(canonicalKey)) {
        canonicalKey = `${canonicalKey} [${s.schemaName}]`
      }
      usedKeys.add(canonicalKey)
      extraDatasets.push({ key: canonicalKey, schemaName: s.schemaName, tableName: t.name })
    }
    if (tableCount >= maxTables) break
  }

  if (extraDatasets.length === 0 && fallbackSchema && Array.isArray(fallbackTables)) {
    for (const t of fallbackTables) {
      if (tableCount >= maxTables) break
      tableCount += 1
      extraDatasets.push({ key: t, schemaName: fallbackSchema, tableName: t })
    }
  }

  return extraDatasets
}
