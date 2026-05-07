# 轻量化三维预览 | 数据可视化平台 V3.0

基于 Web 的专业 3D 模型预览系统，面向工程师、产品设计人员、营销人员和创作者。

V3.0 完成了从单文件 PoC 到全栈应用的重构：新增用户认证、云端模型库、服务端格式转换、协作分享链接，支持 Docker 一键部署。

## 快速开始

### Docker 一键部署（推荐）

```bash
git clone https://github.com/BoChunZengCN/3d-product-viewer.git
cd 3d-product-viewer
make init
```

启动后访问 `http://localhost:8080`，默认账号 `admin@viewer3d.local / admin123`。

### 本地开发

```bash
# 后端
cd backend && cp .env.example .env && npm install && npm run dev

# 前端（另一个终端）
cd frontend && npm install && npm run dev
```

前端开发服务器 `http://localhost:5173`，自动代理 `/api` 到后端 `:3000`。

## 架构概览

```
浏览器 (Three.js + Vite)
    │
    │ REST API + JWT
    ▼
Nginx :80 ──→ Node.js/Express :3000 ──→ PostgreSQL
                    │
               文件存储 (local / S3)
```

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Three.js 0.160 + Vite | 模块化 3D 渲染，代码分割 |
| 后端 | Express + Prisma + JWT | RESTful API，Worker 线程格式转换 |
| 数据库 | PostgreSQL 16 | 用户/模型/目录/分享/转换任务 |
| 部署 | Docker Compose | Nginx + Node.js + PG 三容器 |

## 功能特性

### 用户系统
- 注册 / 登录（JWT 双 token 机制）
- 用户隔离的模型库和目录

### 文件导入
- 支持 STL、OBJ、STEP、IGES、GLTF/GLB、FBX、DXF、XYZ、IFC
- 拖拽上传，带进度条
- 大文件分块加载

### 云端模型库
- 模型上传到服务器持久化存储（替代 IndexedDB）
- 目录分类管理（支持嵌套、折叠/展开）
- 模型跨目录移动
- 搜索与过滤

### 服务端格式转换
- STEP/IGES 文件自动在 Worker 线程中转换
- OpenCASCADE WASM 解析 → 标准化 JSON 网格数据
- 转换进度实时轮询
- 前端直接加载转换后的 BufferGeometry

### 协作分享
- 生成分享链接（短链 nanoid）
- 可选密码保护
- 可选过期时间
- 可选最大查看次数
- 访客无需登录即可预览

### 3D 渲染
- WebGL 渲染（Three.js）
- 旋转、平移、缩放
- 双面渲染
- 网格线 / 坐标轴 / 轮廓线显示

### 视图控制
- 7 种标准视图（前/后/左/右/顶/底/等轴测）
- 平滑相机动画过渡
- 键盘快捷键 1-7 快速切换

### 材质系统
- 12 种预设 PBR 材质
- 自定义颜色、金属度、粗糙度
- 实时材质切换

### 测量工具
- 距离 / 轴向 / 角度 / 半径 / 面积 / 体积 六种模式
- 点击模型选取测量点
- 屏幕空间标签显示

## 项目结构

```
3d-product-viewer/
├── frontend/                    # 前端（Vite + Three.js）
│   ├── src/
│   │   ├── api/                 # API 客户端（JWT 自动注入/刷新）
│   │   │   ├── client.js        # fetch 封装 + 上传进度
│   │   │   ├── auth.js          # 登录/注册/退出
│   │   │   └── modules.js       # 模型/目录/分享/转换 CRUD
│   │   ├── core/                # Three.js 核心模块
│   │   │   ├── SceneManager.js  # 场景/相机/灯光/渲染循环
│   │   │   ├── LoaderFactory.js # STL/OBJ/GLTF/FBX + 服务端JSON
│   │   │   ├── MaterialManager.js
│   │   │   └── MeasureManager.js
│   │   ├── components/          # UI 组件
│   │   │   ├── Auth/            # 登录/注册界面
│   │   │   ├── ShareDialog/     # 分享弹窗
│   │   │   └── Toast/           # 通知
│   │   ├── store/               # 状态管理（发布-订阅）
│   │   ├── styles/              # CSS（从 POC.html 抽取）
│   │   ├── utils/               # 常量/工具函数
│   │   └── main.js              # 应用入口
│   ├── index.html
│   ├── vite.config.js
│   └── tests/verify.js          # 前端验证测试（167项）
│
├── backend/                     # 后端（Node.js + Express）
│   ├── src/
│   │   ├── config/              # 环境变量 + 数据库连接
│   │   ├── middleware/          # JWT认证 / multer上传 / 错误处理
│   │   ├── routes/              # 路由（auth/model/folder/share/convert）
│   │   ├── services/            # 业务逻辑层
│   │   │   ├── auth.service.js  # bcrypt + JWT 双 token
│   │   │   ├── storage.service.js # local/S3 抽象层
│   │   │   ├── convert.service.js # Worker 线程管理
│   │   │   └── share.service.js # 分享链接（密码/过期/计数）
│   │   ├── workers/             # 格式转换子线程
│   │   └── index.js             # Express 入口
│   ├── prisma/
│   │   ├── schema.prisma        # 5张表：users/folders/models/shares/jobs
│   │   └── seed.js              # 初始化数据
│   ├── tests/verify.js          # 后端验证测试（144项）
│   ├── Dockerfile
│   └── package.json
│
├── nginx/default.conf           # Nginx 反向代理 + 静态文件
├── docker-compose.yml           # 三容器编排
├── Makefile                     # 快捷命令
├── POC.html                     # V2.0 原始单文件（保留）
├── docs/
│   ├── ARCHITECTURE.md          # 全栈重构方案
│   ├── DATABASE_DESIGN.md       # 数据库 + 存储设计
│   └── DEPLOY.md                # 部署指南
└── README.md
```

## API 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | - |
| POST | `/api/auth/login` | 登录 → JWT | - |
| POST | `/api/auth/refresh` | 刷新 token | - |
| GET | `/api/auth/me` | 当前用户 | ✅ |
| GET | `/api/models` | 模型列表 | ✅ |
| POST | `/api/models/upload` | 上传模型 | ✅ |
| GET | `/api/models/:id` | 模型详情 | ✅ |
| GET | `/api/models/:id/download` | 下载文件 | ✅ |
| PUT | `/api/models/:id` | 更新元数据 | ✅ |
| PUT | `/api/models/:id/move` | 移动目录 | ✅ |
| DELETE | `/api/models/:id` | 删除 | ✅ |
| GET | `/api/folders` | 目录列表 | ✅ |
| POST | `/api/folders` | 创建目录 | ✅ |
| PUT | `/api/folders/:id` | 重命名 | ✅ |
| DELETE | `/api/folders/:id` | 删除 | ✅ |
| POST | `/api/share` | 创建分享链接 | ✅ |
| GET | `/api/share/:token` | 访问分享 | - |
| GET | `/api/share/:token/download` | 下载分享模型 | - |
| DELETE | `/api/share/:id` | 撤销分享 | ✅ |
| POST | `/api/convert` | 格式转换 | ✅ |
| GET | `/api/convert/:jobId/status` | 转换进度 | ✅ |
| GET | `/api/health` | 健康检查 | - |

## 操作指南

| 操作 | 功能 |
|------|------|
| 左键拖拽 | 旋转视图 |
| 右键拖拽 | 平移视图 |
| 滚轮 | 缩放视图 |
| 点击模型 | 测量模式下选取点 |
| `1`-`7` | 快速切换视图 |
| `R` | 重置/适应视图 |
| `M` | 切换测量模式 |
| `Esc` | 退出测量 |
| `Ctrl+G` | 切换网格线 |
| `Ctrl+L` | 切换模型库 |

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 3D 渲染 | Three.js | 0.160.0 |
| 前端构建 | Vite | 6.x |
| 后端框架 | Express | 4.21 |
| ORM | Prisma | 6.x |
| 数据库 | PostgreSQL | 16 |
| 认证 | JWT + bcrypt | - |
| 格式转换 | occt-import-js (WASM) | 0.0.22 |
| 容器化 | Docker Compose | - |
| 反向代理 | Nginx | Alpine |

## 测试

```bash
# 后端验证（144 项）
cd backend && node tests/verify.js

# 前端验证（167 项）
cd frontend && node tests/verify.js
```

## 版本历史

### V3.0（当前版本）
- 全栈重构：4200 行单文件 → 53 个模块化文件
- 新增 Node.js 后端（Express + Prisma + JWT）
- 新增 PostgreSQL 数据库（5 张表）
- 云端模型存储（替代 IndexedDB）
- 服务端 STEP/IGES Worker 线程转换
- 协作分享链接（密码/过期/次数限制）
- Docker Compose 一键部署
- 前端 Vite 构建 + Three.js 代码分割
- 311 项自动化验证测试

### V2.0
- 新增 GLTF/GLB/FBX 格式支持
- 模型库目录折叠/展开
- 轮廓线（仅外轮廓，性能优化）
- 大模型分块加载
- 帮助图标与操作指南

### V1.0
- 基础 STL/OBJ 预览
- 材质库 + 截面分析 + 测量工具
- IndexedDB 本地存储

## 许可证

MIT License
