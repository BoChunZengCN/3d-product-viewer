import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { Button, Input, Spin, Tooltip, Typography, Space, Divider } from 'antd'
import { SendOutlined, DeleteOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useStore } from '../store/useStore'
import ResultDisplay from './ResultDisplay'
import type { QueryResponse, ChatMessage } from '../types'

const { TextArea } = Input
const { Text } = Typography

let msgIdCounter = 0
const nextId = () => `msg-${++msgIdCounter}-${Date.now()}`

const EXAMPLE_QUERIES = [
  '按产品统计总销售额，用柱状图展示',
  '找出消费金额最高的前10名客户',
  '统计各类别的数量分布，用饼图',
  '计算所有数值列的描述性统计',
]

export default function ChatInterface() {
  const { tableData, messages, addMessage, updateMessage, clearMessages, isQuerying, setIsQuerying } =
    useStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendQuery = async (queryText: string) => {
    if (!queryText.trim() || !tableData || isQuerying) return

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: queryText.trim(),
      timestamp: Date.now(),
    }
    const botMsgId = nextId()
    const botMsg: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isLoading: true,
    }

    addMessage(userMsg)
    addMessage(botMsg)
    setInput('')
    setIsQuerying(true)

    try {
      const { data } = await axios.post<QueryResponse>('/api/query', {
        table_data: {
          headers: tableData.headers,
          rows: tableData.rows,
          sheet_name: tableData.sheetName,
          row_count: tableData.rowCount,
          col_count: tableData.colCount,
        },
        query: queryText.trim(),
      })
      updateMessage(botMsgId, { isLoading: false, response: data })
    } catch (err: unknown) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? '请求失败，请检查后端服务是否启动'
        : '网络错误，请重试'
      updateMessage(botMsgId, {
        isLoading: false,
        response: { success: false, error: errorMsg },
      })
    } finally {
      setIsQuerying(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendQuery(input)
    }
  }

  const noFile = !tableData

  return (
    <div className="chat-container">
      {/* header */}
      <div className="chat-header">
        <Space>
          <RobotOutlined />
          <Text strong>AI 分析助手</Text>
        </Space>
        {messages.length > 0 && (
          <Button
            size="small"
            icon={<DeleteOutlined />}
            onClick={clearMessages}
            type="text"
            danger
          >
            清空对话
          </Button>
        )}
      </div>

      {/* messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <RobotOutlined style={{ fontSize: 32, color: '#bbb', marginBottom: 8 }} />
            <Text type="secondary">
              {noFile ? '请先上传 Excel 文件，然后用中文描述您的分析需求' : '输入问题开始分析，例如：'}
            </Text>
            {!noFile && (
              <div className="example-queries">
                {EXAMPLE_QUERIES.map((q) => (
                  <Button
                    key={q}
                    size="small"
                    type="dashed"
                    onClick={() => sendQuery(q)}
                    disabled={isQuerying}
                    style={{ margin: '4px 4px 0 0', height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-row ${msg.role}`}>
            {msg.role === 'user' ? (
              <div className="user-bubble">
                <UserOutlined style={{ marginRight: 6 }} />
                {msg.content}
              </div>
            ) : (
              <div className="assistant-bubble">
                {msg.isLoading ? (
                  <Space>
                    <Spin size="small" />
                    <Text type="secondary">正在分析...</Text>
                  </Space>
                ) : msg.response ? (
                  <ResultDisplay response={msg.response} />
                ) : null}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Divider style={{ margin: '0 0 8px' }} />

      {/* input */}
      <div className="chat-input-area">
        <Tooltip title={noFile ? '请先上传 Excel 文件' : ''}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noFile ? '请先上传 Excel 文件...' : '输入分析需求（Enter 发送，Shift+Enter 换行）'}
            autoSize={{ minRows: 2, maxRows: 4 }}
            disabled={noFile || isQuerying}
            style={{ flex: 1 }}
          />
        </Tooltip>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => sendQuery(input)}
          disabled={noFile || isQuerying || !input.trim()}
          loading={isQuerying}
          style={{ alignSelf: 'flex-end' }}
        >
          发送
        </Button>
      </div>
    </div>
  )
}
