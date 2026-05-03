import { useMemo } from 'react'
import { Card, Table, Typography, Empty, Statistic, Alert } from 'antd'
import { BarChartOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useStore } from '../../store/useStore'
import type { AnalysisResult, ChartResult } from '../../types'

const { Title } = Typography

function buildChartOption(chart: ChartResult) {
  const base = {
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0 },
  }

  if (chart.type === 'pie') {
    return {
      ...base,
      title: { text: chart.title, left: 'center', textStyle: { fontSize: 13 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: chart.data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
      }],
    }
  }

  if (chart.type === 'line') {
    return {
      ...base,
      tooltip: { trigger: 'axis' as const },
      title: { text: chart.title, left: 'center', textStyle: { fontSize: 13 } },
      xAxis: { type: 'category', data: chart.xAxis ?? chart.data.map((d) => d.name) },
      yAxis: { type: 'value' },
      series: chart.series ?? [{
        type: 'line',
        data: chart.data.map((d) => d.value),
        smooth: true,
        areaStyle: {},
      }],
    }
  }

  // 默认柱状图
  return {
    ...base,
    tooltip: { trigger: 'axis' as const },
    title: { text: chart.title, left: 'center', textStyle: { fontSize: 13 } },
    xAxis: { type: 'category', data: chart.xAxis ?? chart.data.map((d) => d.name), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' },
    series: chart.series ?? [{
      type: 'bar',
      data: chart.data.map((d) => d.value),
      itemStyle: { color: '#1677ff' },
    }],
  }
}

function ResultContent({ result }: { result: AnalysisResult }) {
  const tableColumns = useMemo(() => {
    if (!result.table) return []
    return result.table.columns.map((col, i) => ({
      title: col,
      dataIndex: i,
      key: i,
      ellipsis: true,
      width: 120,
      render: (val: string | number | null) => (val === null ? '—' : String(val)),
    }))
  }, [result.table])

  const tableData = useMemo(() => {
    if (!result.table) return []
    return result.table.rows.map((row, idx) => ({ key: idx, ...row }))
  }, [result.table])

  if (result.type === 'error') {
    return <Alert type="error" message={result.summary} showIcon />
  }

  if (result.type === 'number') {
    return (
      <Statistic
        title="计算结果"
        value={String(result.number ?? result.summary)}
        style={{ textAlign: 'center', padding: '24px 0' }}
      />
    )
  }

  if (result.type === 'chart' && result.chart) {
    return (
      <>
        <ReactECharts
          option={buildChartOption(result.chart)}
          style={{ height: 300 }}
          opts={{ renderer: 'svg' }}
        />
        {result.table && (
          <Table
            columns={tableColumns}
            dataSource={tableData}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            bordered
            style={{ marginTop: 12 }}
          />
        )}
      </>
    )
  }

  if (result.type === 'table' && result.table) {
    return (
      <Table
        columns={tableColumns}
        dataSource={tableData}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `共 ${t} 行` }}
        scroll={{ x: 'max-content', y: 300 }}
        bordered
      />
    )
  }

  return <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{result.summary}</Typography.Paragraph>
}

export default function ResultDisplay() {
  const { latestResult } = useStore()

  return (
    <Card
      style={{ height: '100%' }}
      styles={{ body: { padding: '16px', overflow: 'auto' } }}
    >
      <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        <BarChartOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
        分析结果
      </Title>

      {latestResult ? (
        <ResultContent result={latestResult} />
      ) : (
        <Empty description="暂无结果，请在左侧 AI 对话框中提问" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  )
}
