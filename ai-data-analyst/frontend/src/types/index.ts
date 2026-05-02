export interface TableData {
  headers: string[]
  rows: (string | number | null)[][]
  sheetName: string
  rowCount: number
  colCount: number
  fileName: string
}

export type ChartType = 'bar' | 'pie' | 'line'

export interface ChartSeries {
  name: string
  data: number[]
}

export interface PieItem {
  name: string
  value: number
}

export interface ChartConfig {
  type: ChartType
  title: string
  x_axis?: string[]
  series: ChartSeries[] | PieItem[]
}

export interface ResultData {
  headers: string[]
  rows: (string | number | null)[][]
}

export type ResultType = 'chart' | 'table' | 'number' | 'text'

export interface QueryResponse {
  success: boolean
  result_type?: ResultType
  data?: ResultData | null
  chart_config?: ChartConfig | null
  summary?: string
  error?: string
  error_code?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  response?: QueryResponse
  isLoading?: boolean
}
