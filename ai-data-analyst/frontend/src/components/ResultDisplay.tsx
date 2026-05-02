import { useRef, useEffect } from 'react'
import { Table, Typography, Statistic } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { QueryResponse, ChartConfig, ChartSeries, PieItem } from '../types'

const { Text } = Typography

function isPieSeries(series: ChartSeries[] | PieItem[]): series is PieItem[] {
  return series.length > 0 && 'value' in series[0]
}

function buildEChartsOption(config: ChartConfig): EChartsOption {
  const base: EChartsOption = {
    title: { text: config.title, textStyle: { fontSize: 14 }, left: 'center' },
    tooltip: {},
    grid: { left: 40, right: 20, bottom: 60, top: 50, containLabel: true },
  }

  if (config.type === 'pie') {
    const pieData = isPieSeries(config.series) ? config.series : []
    return {
      ...base,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', left: 'left', top: 'middle' },
      series: [{ type: 'pie', radius: '55%', center: ['60%', '55%'], data: pieData }],
    }
  }

  const barLineSeries = isPieSeries(config.series) ? [] : config.series
  return {
    ...base,
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: config.x_axis ?? [],
      axisLabel: { rotate: 30, overflow: 'truncate', width: 80 },
    },
    yAxis: { type: 'value' },
    series: barLineSeries.map((s) => ({
      name: s.name,
      type: config.type,
      data: s.data,
      smooth: config.type === 'line',
    })),
  }
}

function ChartView({ config }: { config: ChartConfig }) {
  const chartRef = useRef<ReactECharts>(null)

  useEffect(() => {
    const handleResize = () => {
      const instance = chartRef.current?.getEchartsInstance()
      instance?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <ReactECharts
      ref={chartRef}
      option={buildEChartsOption(config)}
      style={{ height: 300, width: '100%' }}
      notMerge
    />
  )
}

function TableView({ headers, rows }: { headers: string[]; rows: (string | number | null)[][] }) {
  const columns: ColumnsType<Record<string, unknown>> = headers.map((h) => ({
    title: h,
    dataIndex: h,
    key: h,
    ellipsis: true,
    render: (v: unknown) => (v === null || v === undefined ? '—' : String(v)),
  }))
  const dataSource = rows.slice(0, 200).map((row, i) => {
    const obj: Record<string, unknown> = { _k: i }
    headers.forEach((h, j) => { obj[h] = row[j] })
    return obj
  })
  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey="_k"
      size="small"
      pagination={rows.length > 10 ? { pageSize: 10, size: 'small' } : false}
      scroll={{ x: 'max-content' }}
      bordered
    />
  )
}

interface Props {
  response: QueryResponse
}

export default function ResultDisplay({ response }: Props) {
  if (!response.success) {
    return <Text type="danger">{response.error ?? '查询失败，请重试'}</Text>
  }

  const { result_type, data, chart_config, summary } = response

  return (
    <div>
      {result_type === 'chart' && chart_config && (
        <ChartView config={chart_config} />
      )}

      {(result_type === 'table' || (result_type === 'chart' && data)) && data && (
        <div style={{ marginTop: chart_config ? 12 : 0 }}>
          <TableView headers={data.headers} rows={data.rows} />
        </div>
      )}

      {result_type === 'number' && data?.rows?.[0]?.[0] !== undefined && (
        <Statistic value={data.rows[0][0] as number} />
      )}

      {result_type === 'text' && (
        <Text>{summary}</Text>
      )}

      {summary && result_type !== 'text' && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          {summary}
        </Text>
      )}
    </div>
  )
}
