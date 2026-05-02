import * as XLSX from 'xlsx'
import type { TableData } from '../types'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export async function parseExcelFile(file: File): Promise<TableData> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('文件大小不能超过 5MB')
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['xlsx', 'xls'].includes(ext)) {
    throw new Error('只支持 .xlsx 和 .xls 格式的文件')
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Excel 文件不包含任何工作表')
  }

  const worksheet = workbook.Sheets[sheetName]
  const rawData: (string | number | null)[][] = XLSX.utils.sheet_to_json(
    worksheet,
    { header: 1, defval: null, raw: true }
  ) as (string | number | null)[][]

  if (rawData.length < 2) {
    throw new Error('Excel 文件必须包含至少 1 行标题和 1 行数据')
  }

  const headers = (rawData[0] as (string | number | null)[]).map(
    (h, i) => (h !== null ? String(h) : `列${i + 1}`)
  )

  const rows = rawData.slice(1).filter((row) =>
    row.some((cell) => cell !== null && cell !== '')
  )

  return {
    headers,
    rows,
    sheetName,
    rowCount: rows.length,
    colCount: headers.length,
    fileName: file.name,
  }
}
