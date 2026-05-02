import { Table, Typography, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '../store/useStore'

const { Text, Title } = Typography
const PREVIEW_LIMIT = 100

export default function DataPreview() {
  const { tableData } = useStore()
  if (!tableData) return null

  const columns: ColumnsType<Record<string, unknown>> = tableData.headers.map((h) => ({
    title: h,
    dataIndex: h,
    key: h,
    ellipsis: true,
    width: 120,
    render: (val: unknown) => (val === null || val === undefined ? <Text type="secondary">—</Text> : String(val)),
  }))

  const dataSource = tableData.rows.slice(0, PREVIEW_LIMIT).map((row, i) => {
    const obj: Record<string, unknown> = { _rowKey: i }
    tableData.headers.forEach((h, j) => {
      obj[h] = row[j]
    })
    return obj
  })

  return (
    <div style={{ marginTop: 16 }}>
      <Space style={{ marginBottom: 8 }} wrap>
        <Title level={5} style={{ margin: 0 }}>数据预览</Title>
        <Tag color="blue">{tableData.rowCount} 行</Tag>
        <Tag color="cyan">{tableData.colCount} 列</Tag>
        {tableData.rowCount > PREVIEW_LIMIT && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            （仅显示前 {PREVIEW_LIMIT} 行）
          </Text>
        )}
      </Space>
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="_rowKey"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: 240 }}
        bordered
      />
    </div>
  )
}
