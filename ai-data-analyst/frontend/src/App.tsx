import { useEffect } from 'react'
import { ConfigProvider, Layout, Row, Col, Alert, Typography, Space } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import axios from 'axios'
import { useStore } from './store/useStore'
import FileUpload from './components/FileUpload'
import DataPreview from './components/DataPreview'
import ChatInterface from './components/ChatInterface'
import './styles/App.css'

const { Header, Content, Footer } = Layout
const { Text } = Typography

export default function App() {
  const { backendReady, setBackendReady } = useStore()

  useEffect(() => {
    axios
      .get('/api/health', { timeout: 3000 })
      .then(() => setBackendReady(true))
      .catch(() => setBackendReady(false))
  }, [setBackendReady])

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header className="app-header">
          <RobotOutlined style={{ fontSize: 22 }} />
          <span>AI 数据分析大师</span>
          <span className="subtitle">上传 Excel · 用中文描述需求 · AI 自动分析</span>
        </Header>

        <Content className="app-content">
          {backendReady === false && (
            <Alert
              className="backend-alert"
              type="warning"
              showIcon
              message="后端服务未启动"
              description="请在 backend/ 目录运行 uvicorn main:app --reload --port 8000 并设置 ANTHROPIC_API_KEY"
              style={{ marginBottom: 12 }}
            />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24} md={10} lg={8}>
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <FileUpload />
                <DataPreview />
              </Space>
            </Col>
            <Col xs={24} md={14} lg={16}>
              <ChatInterface />
            </Col>
          </Row>
        </Content>

        <Footer className="app-footer">
          <Text type="secondary">AI 数据分析大师 v1.0 · 数据仅在本地处理，不上传至云端</Text>
        </Footer>
      </Layout>
    </ConfigProvider>
  )
}
