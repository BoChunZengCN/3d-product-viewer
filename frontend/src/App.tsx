import { Layout, Typography, theme } from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'
import FileUpload from './components/FileUpload'
import DataPreview from './components/DataPreview'
import AIChat from './components/AIChat'
import ResultDisplay from './components/ResultDisplay'
import './styles/app.css'

const { Header, Content } = Layout
const { Title, Text } = Typography

export default function App() {
  const { token } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        style={{
          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
        }}
      >
        <DatabaseOutlined style={{ color: '#fff', fontSize: 24 }} />
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          DataMaster
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
          AI 数据分析大师
        </Text>
      </Header>

      <Content style={{ padding: '16px', overflow: 'hidden' }}>
        {/* PC 三列布局 */}
        <div className="dm-grid">
          {/* 左列：上传 + 预览 */}
          <div className="dm-col dm-col-left">
            <div style={{ marginBottom: 12 }}>
              <FileUpload />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <DataPreview />
            </div>
          </div>

          {/* 中列：AI 对话 */}
          <div className="dm-col dm-col-mid">
            <AIChat />
          </div>

          {/* 右列：结果展示 */}
          <div className="dm-col dm-col-right">
            <ResultDisplay />
          </div>
        </div>
      </Content>
    </Layout>
  )
}
