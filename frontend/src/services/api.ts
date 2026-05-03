import axios from 'axios'
import type { QueryRequest, AnalysisResult } from '../types'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export async function queryData(req: QueryRequest): Promise<AnalysisResult> {
  const { data } = await client.post<AnalysisResult>('/query', req)
  return data
}

export async function exportReport(
  messages: { query: string; result: AnalysisResult }[]
): Promise<Blob> {
  const { data } = await client.post(
    '/export',
    { messages },
    { responseType: 'blob' }
  )
  return data
}
