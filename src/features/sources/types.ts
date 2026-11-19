export type SourceCategory =
  | 'all'
  | 'ml'
  | 'economics'
  | 'climate'
  | 'health'
  | 'academic'
  | 'government'
  | 'files'

export interface ResearchRepository {
  id: string
  name: string
  category: SourceCategory
  categoryLabel: string
  description: string
  url: string
  datasetCount: string
  formats: string[]
  tags: string[]
  badge?: string
  licenseType: string
  isFeatured?: boolean
  popularSearches: string[]
}

export interface ReadyDatasetFile {
  id: string
  name: string
  fileName: string
  fileUrl: string
  category: SourceCategory
  categoryLabel: string
  description: string
  rowCount: string
  columnsCount: number
  fileSize: string
  columns: string[]
  sampleQuestions: string[]
}
