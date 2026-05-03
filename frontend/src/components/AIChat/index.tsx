import { useRef, useEffect, useState } from 'react'
import { Card, Input, Button, List, Typography, Space, Tag, Spin, Empty, Avatar } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, BulbOutlined } from '@ant-design/icons'
import { useStore } from '../../store/useStore'
import { queryData } from '../../services/api'
import type { ChatMessage } from '../../types'

const { Text, Paragraph } = Typography

const EXAMPLE_QUERIES = [
  '计算各列的平均值',
  '统计每个类别的数量',
  '找出金额最大的前10条记录',
  '按日期分组统计总金额',
  '显示数据的基本统计信息',
]

let msgIdCounter = 0
function genId() { return `msg_${++msgIdCounter}_${Date.now()}` }

export default function AIChat() {
  const { activeSheet, messages, isQuerying, addMessage, setIsQuerying, setLatestResult } = useStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text?: string) {
    const query = (text ?? input).trim()
    if (!query || !activeSheet || isQuerying) return

    setInput('')

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: query,
      timestamp: Date.now(),
    }
    addMessage(userMsg)
    setIsQuerying(true)

    try {
      const result = await queryData({
        query,
        tableStructure: {
          headers: activeSheet.headers,
          sampleRows: activeSheet.rows.slice(0, 5),
          rowCount: activeSheet.rowCount,
          sheetName: activeSheet.name,
        },
        data: activeSheet.rows,
      })

      const aiMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: result.summary,
        timestamp: Date.now(),
        result,
      }
      addMessage(aiMsg)
      setLatestResult(result)
    } catch {
      addMessage({
        id: genId(),
        role: 'assistant',
        content: '⚠️ 查询失败，请检查后端服务是否运行，或换一种提问方式。',
        timestamp: Date.now(),
      })
    } finally {
      setIsQuerying(false)
    }
  }

  const disabled = !activeSheet

  return (
    <Card
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: 12, overflow: 'hidden' } }}
    >
      <Text strong style={{ fontSize: 15 }}>
        <RobotOutlined style={{ color: '#722ed1', marginRight: 8 }} />
        AI 数据分析
      </Text>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ padding: '16px 0' }}>
            <Empty description={disabled ? '请先上传 Excel 文件' : '开始提问，分析您的数据'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            {!disabled && (
              <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <BulbOutlined /> 示例问题：
                </Text>
                {EXAMPLE_QUERIES.map((q) => (
                  <Tag
                    key={q}
                    color="purple"
                    style={{ cursor: 'pointer', whiteSpace: 'normal' }}
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={(msg) => (
              <List.Item
                style={{
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  border: 'none',
                  padding: '6px 0',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <Avatar
                  size="small"
                  icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  style={{ background: msg.role === 'user' ? '#1677ff' : '#722ed1', flexShrink: 0 }}
                />
                <div
                  style={{
                    maxWidth: '80%',
                    background: msg.role === 'user' ? '#e6f4ff' : '#f9f0ff',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {msg.content}
                  </Paragraph>
                  {msg.result?.code && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 11, color: '#999' }}>查看计算代码</summary>
                      <pre style={{ fontSize: 11, marginTop: 4, padding: 8, background: '#f5f5f5', borderRadius: 4, overflow: 'auto' }}>
                        {msg.result.code}
                      </pre>
                    </details>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
        {isQuerying && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Spin size="small" /> <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>AI 正在分析中…</Text>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={() => handleSend()}
          placeholder={disabled ? '请先上传 Excel 文件' : '用中文描述您的分析需求…'}
          disabled={disabled || isQuerying}
          maxLength={500}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => handleSend()}
          disabled={!input.trim() || disabled || isQuerying}
        />
      </Space.Compact>
    </Card>
  )
}
