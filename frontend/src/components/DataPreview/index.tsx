import { useMemo } from 'react'
import { Card, Table, Tabs, Typography, Space, Tag, Empty } from 'antd'
import { TableOutlined } from '@ant-design/icons'
import { useStore } from '../../store/useStore'
import type { SheetData } from '../../types'

const { Title, Text } = Typography
const PAGE_SIZE = 50

function SheetTable({ sheet }: { sheet: SheetData }) {
  const columns = useMemo(
    () =>
      sheet.headers.map((h, i) => ({
        title: h || `列${i + 1}`,
        dataIndex: i,
        key: i,
        ellipsis: true,
        width: 120,
        render: (val: string | number | null) =>
          val === null || val === '' ? (
            <Text type="secondary" style={{ fontSize: 12 }}>空</Text>
          ) : (
            String(val)
          ),
      })),
    [sheet.headers]
  )

  const dataSource = useMemo(
    () => sheet.rows.map((row, idx) => ({ key: idx, ...row })),
    [sheet.rows]
  )

  const nullCounts = useMemo(() => {
    const counts = new Array(sheet.headers.length).fill(0) as number[]
    sheet.rows.forEach((row) => {
      row.forEach((cell, i) => {
        if (cell === null || cell === '') counts[i]++
      })
    })
    return counts
  }, [sheet.rows, sheet.headers.length])

  const totalNulls = nullCounts.reduce((a, b) => a + b, 0)

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Space wrap>
        <Tag color="blue">{sheet.rowCount.toLocaleString()} 行</Tag>
        <Tag color="green">{sheet.headers.length} 列</Tag>
        {totalNulls > 0 && (
          <Tag color="orange">缺失值：{totalNulls}</Tag>
        )}
      </Space>

      <Table
        columns={columns}
        dataSource={dataSource}
        size="small"
        scroll={{ x: 'max-content', y: 360 }}
        pagination={{ pageSize: PAGE_SIZE, showSizeChanger: false, showTotal: (t) => `共 ${t} 行` }}
        bordered
      />
    </Space>
  )
}

export default function DataPreview() {
  const { parsedFile, activeSheet, setActiveSheet } = useStore()

  if (!parsedFile) {
    return (
      <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' } }}>
        <Empty description="请先上传 Excel 文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  return (
    <Card
      style={{ height: '100%' }}
      styles={{ body: { padding: '16px', overflow: 'auto' } }}
    >
      <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        <TableOutlined style={{ color: '#1677ff', marginRight: 8 }} />
        数据预览
      </Title>

      {parsedFile.sheets.length > 1 ? (
        <Tabs
          activeKey={activeSheet?.name}
          onChange={(key) => {
            const s = parsedFile.sheets.find((sh) => sh.name === key)
            if (s) setActiveSheet(s)
          }}
          items={parsedFile.sheets.map((sh) => ({
            key: sh.name,
            label: sh.name,
            children: <SheetTable sheet={sh} />,
          }))}
        />
      ) : activeSheet ? (
        <SheetTable sheet={activeSheet} />
      ) : null}
    </Card>
  )
}
