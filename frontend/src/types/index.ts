export interface SheetData {
  name: string
  headers: string[]
  rows: (string | number | null)[][]
  rowCount: number
}

export interface ParsedFile {
  fileName: string
  sheets: SheetData[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  result?: AnalysisResult
}

export type ResultType = 'table' | 'chart' | 'number' | 'text' | 'error'

export interface TableResult {
  columns: string[]
  rows: (string | number | null)[][]
}

export interface ChartResult {
  type: 'bar' | 'pie' | 'line'
  title: string
  data: { name: string; value: number }[]
  xAxis?: string[]
  series?: { name: string; data: number[] }[]
}

export interface AnalysisResult {
  type: ResultType
  summary: string
  table?: TableResult
  chart?: ChartResult
  number?: number | string
  code?: string
}

export interface QueryRequest {
  query: string
  tableStructure: {
    headers: string[]
    sampleRows: (string | number | null)[][]
    rowCount: number
    sheetName: string
  }
  data: (string | number | null)[][]
}
