import { useCallback } from 'react'
import { Upload, Card, Typography, Alert, Space } from 'antd'
import { InboxOutlined, FileExcelOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useStore } from '../../store/useStore'
import type { ParsedFile } from '../../types'

const { Dragger } = Upload
const { Title, Text } = Typography

const MAX_SIZE_MB = 25

function parseExcel(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheets = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name]
          const jsonData = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
            header: 1,
            raw: false,
            defval: null,
          })

          const headers = (jsonData[0] as string[]) ?? []
          const rows = jsonData.slice(1) as (string | number | null)[][]

          return { name, headers, rows, rowCount: rows.length }
        })

        resolve({ fileName: file.name, sheets })
      } catch {
        reject(new Error('文件解析失败，请确认是有效的 Excel 文件'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

export default function FileUpload() {
  const { parsedFile, isUploading, setParsedFile, setIsUploading, reset } = useStore()

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        return false
      }

      setIsUploading(true)
      reset()
      try {
        const parsed = await parseExcel(file)
        setParsedFile(parsed)
      } finally {
        setIsUploading(false)
      }
      return false // 阻止 antd 默认上传行为
    },
    [setParsedFile, setIsUploading, reset]
  )

  return (
    <Card
      style={{ height: '100%' }}
      styles={{ body: { padding: '16px' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Title level={5} style={{ margin: 0 }}>
          <FileExcelOutlined style={{ color: '#52c41a', marginRight: 8 }} />
          上传 Excel 文件
        </Title>

        <Dragger
          accept=".xlsx,.xls"
          beforeUpload={handleFile}
          showUploadList={false}
          loading={isUploading}
          style={{ padding: '12px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#1677ff', fontSize: 40 }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 .xlsx / .xls 格式，最大 {MAX_SIZE_MB}MB
          </p>
        </Dragger>

        {parsedFile && (
          <Alert
            type="success"
            showIcon
            message={
              <Text>
                已加载：<Text strong>{parsedFile.fileName}</Text>
                {' — '}
                {parsedFile.sheets.length} 个 Sheet，共{' '}
                {parsedFile.sheets.reduce((s, sh) => s + sh.rowCount, 0).toLocaleString()} 行
              </Text>
            }
          />
        )}
      </Space>
    </Card>
  )
}
