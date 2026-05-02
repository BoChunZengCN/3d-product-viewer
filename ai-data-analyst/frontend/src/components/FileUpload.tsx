import { useState } from 'react'
import { Upload, message, Typography, Space, Tag } from 'antd'
import { InboxOutlined, FileExcelOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { parseExcelFile } from '../utils/excelParser'
import { useStore } from '../store/useStore'

const { Dragger } = Upload
const { Text, Title } = Typography

export default function FileUpload() {
  const { tableData, setTableData, clearMessages } = useStore()
  const [parsing, setParsing] = useState(false)

  const handleFile = async (file: File) => {
    setParsing(true)
    try {
      const data = await parseExcelFile(file)
      setTableData(data)
      clearMessages()
      message.success(`已成功加载「${file.name}」，共 ${data.rowCount} 行 × ${data.colCount} 列`)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '文件解析失败，请重试')
    } finally {
      setParsing(false)
    }
    return false // prevent antd auto-upload
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: handleFile,
    disabled: parsing,
  }

  if (tableData) {
    return (
      <div className="file-loaded-card">
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space>
            <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <Text strong>{tableData.fileName}</Text>
            <CloseCircleOutlined
              style={{ color: '#999', cursor: 'pointer' }}
              onClick={() => setTableData(null)}
              title="移除文件"
            />
          </Space>
          <Space size={8}>
            <Tag color="blue">工作表：{tableData.sheetName}</Tag>
            <Tag color="green">{tableData.rowCount} 行</Tag>
            <Tag color="cyan">{tableData.colCount} 列</Tag>
          </Space>
          <Upload {...uploadProps} style={{ display: 'block' }}>
            <Text type="secondary" style={{ fontSize: 12, cursor: 'pointer' }}>
              点击重新上传其他文件
            </Text>
          </Upload>
        </Space>
      </div>
    )
  }

  return (
    <div>
      <Title level={5} style={{ marginBottom: 8 }}>
        上传 Excel 文件
      </Title>
      <Dragger {...uploadProps} style={{ padding: '12px 0' }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {parsing ? '解析中...' : '点击或拖拽 Excel 文件到此区域'}
        </p>
        <p className="ant-upload-hint">支持 .xlsx / .xls，文件大小不超过 5MB</p>
      </Dragger>
    </div>
  )
}
