# DataMaster — AI 数据分析大师

> 面向非技术用户的自然语言 Excel 数据分析工具

上传 Excel → 用中文描述需求 → AI 自动完成统计计算并生成可视化报表

---

## ✨ 功能特性

| 模块 | 功能 |
|------|------|
| 📤 文件上传 | 支持 .xlsx / .xls，拖拽上传，最大 25MB |
| 📊 数据预览 | 表格展示、多 Sheet 切换、数据摘要 |
| 🤖 AI 对话 | 中文自然语言查询，示例引导 |
| 📈 结果展示 | 表格 + 柱状图/饼图/折线图 |

---

## 🛠 技术栈

**前端**
- React 18 + TypeScript + Vite
- Ant Design 5.x（UI 组件库）
- ECharts 5（图表）
- SheetJS / xlsx（前端 Excel 解析）
- Zustand（状态管理）

**后端**
- Python 3.11 + FastAPI
- Pandas + NumPy（数据计算）
- Claude API（AI 意图理解）
- RestrictedPython（代码沙箱）

---

## 🚀 本地启动

### 1. 克隆项目

```bash
git clone https://github.com/BoChunZengCN/DataMaster.git
cd DataMaster
```

### 2. 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置 API Key
cp .env.example .env
# 编辑 .env，填写 ANTHROPIC_API_KEY

# 启动服务
uvicorn app.main:app --reload --port 8000
```

后端接口文档：http://localhost:8000/docs

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

打开浏览器：http://localhost:3000

---

## 📁 项目结构

```
DataMaster/
├── frontend/                  # React + TypeScript 前端
│   └── src/
│       ├── components/
│       │   ├── FileUpload/    # 文件上传组件
│       │   ├── DataPreview/   # 数据预览表格
│       │   ├── AIChat/        # AI 对话框
│       │   └── ResultDisplay/ # 结果展示（表格+图表）
│       ├── store/             # Zustand 全局状态
│       ├── services/          # API 调用
│       └── types/             # TypeScript 类型定义
└── backend/                   # FastAPI 后端
    └── app/
        ├── api/               # 路由接口
        ├── services/          # AI服务、代码沙箱
        └── models/            # Pydantic 数据模型
```

---

## 🔒 安全设计

- **数据不上传**：Excel 数据在浏览器端解析，仅将数据摘要和样本发送给 AI
- **代码沙箱**：AI 生成的 Pandas 代码在 RestrictedPython 隔离环境中执行
- **白名单函数**：禁止 `os`、`sys`、`subprocess`、`open`、`eval` 等危险操作

---

## 📋 开发计划

- [x] MVP：上传、预览、AI 对话、图表展示
- [ ] 多 Sheet 支持
- [ ] 报表导出（PDF/Excel）
- [ ] 计算模板库
- [ ] 移动端优化

---

**文档维护者**：贾维斯 | **最后更新**：2026-05-03
