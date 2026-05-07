# 轻量化三维预览系统 — 全栈重构方案

## 一、现状分析

### 当前问题
| 问题 | 影响 |
|------|------|
| 单文件 `POC.html` 约 4200 行，CSS/JS/HTML 混合 | 不可维护，无法多人协作 |
| IndexedDB 本地存储 | 换浏览器/设备数据丢失 |
| CDN 直接 import Three.js | 无 tree-shaking，加载 ~600KB |
| 无用户系统 | 无法云端同步、协作 |
| STEP/IGES 在浏览器端 WASM 解析 | 大文件解析慢，内存占用高 |
| 无打包构建 | 无代码分割、无缓存优化 |

---

## 二、技术栈推荐

**推荐后端：Node.js (Express/Fastify)**

理由：
- 前后端同语言，团队维护成本低
- Three.js 生态天然兼容（SSR 渲染缩略图等）
- `occt-import-js` 本身是 JS/WASM，Node.js 可直接复用
- 文件流处理（multer）成熟稳定

如果团队偏 Python，FastAPI 也可以，但格式转换需要额外引入 `pythonocc` 或调用 `opencascade` CLI。

---

## 三、前端重构

### 3.1 目录结构

```
frontend/
├── index.html
├── vite.config.js
├── package.json
├── tsconfig.json                 # 可选，推荐 TS
├── public/
│   └── favicon.svg
├── src/
│   ├── main.js                   # 入口
│   ├── App.vue                   # 或 App.jsx (React)
│   ├── styles/
│   │   ├── variables.css         # CSS 变量（从 :root 抽取）
│   │   ├── layout.css            # 布局
│   │   ├── components.css        # 组件样式
│   │   └── animations.css        # 动画
│   ├── core/
│   │   ├── SceneManager.js       # Three.js 场景初始化/灯光/渲染循环
│   │   ├── CameraController.js   # 视图切换/动画/OrbitControls
│   │   ├── MaterialManager.js    # 材质库/切换/自定义
│   │   ├── MeasureManager.js     # 测量工具（6种模式）
│   │   ├── ClippingManager.js    # 截面分析
│   │   ├── AnnotationManager.js  # 标注系统
│   │   ├── LODManager.js         # LOD 控制
│   │   ├── EdgeLineManager.js    # 轮廓线
│   │   └── CompassWidget.js      # 方向指示器
│   ├── loaders/
│   │   ├── STLFileLoader.js
│   │   ├── OBJFileLoader.js
│   │   ├── STEPFileLoader.js     # 前端 WASM fallback
│   │   ├── GLTFFileLoader.js
│   │   ├── FBXFileLoader.js
│   │   ├── DXFFileLoader.js
│   │   ├── XYZFileLoader.js
│   │   └── LoaderFactory.js      # 根据扩展名分发
│   ├── api/
│   │   ├── client.js             # axios/fetch 封装
│   │   ├── auth.js               # 登录/注册/token
│   │   ├── models.js             # 模型 CRUD
│   │   ├── share.js              # 分享链接
│   │   └── convert.js            # 格式转换
│   ├── store/
│   │   └── index.js              # 状态管理 (Zustand/Pinia)
│   ├── components/
│   │   ├── Sidebar/
│   │   ├── Viewport/
│   │   ├── ModelLibrary/
│   │   ├── UploadZone/
│   │   ├── MeasurePanel/
│   │   ├── ClipPanel/
│   │   ├── MaterialPanel/
│   │   ├── BackgroundPanel/
│   │   ├── ViewSwitcher/
│   │   ├── HelpTooltip/
│   │   └── Toast/
│   └── utils/
│       ├── thumbnail.js          # 缩略图生成
│       ├── fileUtils.js          # 文件大小格式化等
│       └── constants.js          # 材质库常量等
```

### 3.2 构建工具

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          loaders: [
            'three/addons/loaders/STLLoader.js',
            'three/addons/loaders/OBJLoader.js',
            'three/addons/loaders/GLTFLoader.js',
            'three/addons/loaders/FBXLoader.js',
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

### 3.3 关键重构点

**SceneManager.js**（从 `init()` + `animate()` 抽取）:
```js
export class SceneManager {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, /*...*/);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.setupLights();
    this.setupGrid();
    container.appendChild(this.renderer.domElement);
  }

  setupLights() { /* 4盏灯从 init() 抽取 */ }
  setupGrid()   { /* gridHelper + axesHelper */ }
  animate()     { /* requestAnimationFrame 循环 */ }
  resize()      { /* window resize handler */ }
  dispose()     { /* 资源释放 */ }
}
```

**LoaderFactory.js**（替代 `handleFile()` 的 if-else 链）:
```js
const LOADERS = {
  stl:  () => import('./STLFileLoader.js'),
  obj:  () => import('./OBJFileLoader.js'),
  step: () => import('./STEPFileLoader.js'),
  stp:  () => import('./STEPFileLoader.js'),
  gltf: () => import('./GLTFFileLoader.js'),
  glb:  () => import('./GLTFFileLoader.js'),
  fbx:  () => import('./FBXFileLoader.js'),
};

export async function loadFile(file, scene, options = {}) {
  const ext = file.name.split('.').pop().toLowerCase();
  const loaderModule = LOADERS[ext];
  if (!loaderModule) throw new Error(`不支持的格式: ${ext}`);

  // 大文件优先走服务端转换
  if (['step', 'stp', 'iges', 'igs'].includes(ext) && file.size > 5 * 1024 * 1024) {
    return await serverSideConvert(file);
  }

  const { default: Loader } = await loaderModule();
  return new Loader().load(file, scene, options);
}
```

---

## 四、后端设计

### 4.1 目录结构

```
backend/
├── package.json
├── .env.example
├── src/
│   ├── index.js                  # 入口
│   ├── config/
│   │   ├── database.js           # PostgreSQL/MongoDB 连接
│   │   ├── storage.js            # S3/MinIO/本地存储配置
│   │   └── env.js                # 环境变量
│   ├── middleware/
│   │   ├── auth.js               # JWT 验证
│   │   ├── upload.js             # multer 配置 (200MB limit)
│   │   ├── rateLimit.js          # 限流
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── model.routes.js
│   │   ├── folder.routes.js
│   │   ├── share.routes.js
│   │   └── convert.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── model.controller.js
│   │   ├── folder.controller.js
│   │   ├── share.controller.js
│   │   └── convert.controller.js
│   ├── services/
│   │   ├── auth.service.js       # bcrypt + JWT
│   │   ├── storage.service.js    # 文件存储抽象层
│   │   ├── convert.service.js    # STEP/IGES → GLTF 转换
│   │   ├── thumbnail.service.js  # 服务端缩略图
│   │   └── share.service.js      # 分享链接生成
│   ├── models/                   # 数据库模型 (Prisma/Mongoose)
│   │   ├── User.js
│   │   ├── Model.js
│   │   ├── Folder.js
│   │   ├── ShareLink.js
│   │   └── Annotation.js
│   └── workers/
│       └── converter.worker.js   # 格式转换子进程
├── prisma/
│   └── schema.prisma             # 数据库 schema
└── Dockerfile
```

### 4.2 API 设计

```
POST   /api/auth/register          # 注册
POST   /api/auth/login             # 登录 → JWT
POST   /api/auth/refresh           # 刷新 token
GET    /api/auth/me                # 当前用户

GET    /api/models                 # 模型列表 (?folderId=&search=&page=&limit=)
POST   /api/models/upload          # 上传模型 (multipart/form-data)
GET    /api/models/:id             # 模型详情
GET    /api/models/:id/download    # 下载原始文件
GET    /api/models/:id/thumbnail   # 获取缩略图
PUT    /api/models/:id             # 更新元数据
DELETE /api/models/:id             # 删除
PUT    /api/models/:id/move        # 移动到其他目录

GET    /api/folders                # 目录列表
POST   /api/folders                # 创建目录
PUT    /api/folders/:id            # 重命名
DELETE /api/folders/:id            # 删除（模型归入默认）

POST   /api/convert                # 格式转换 (STEP→GLTF)
GET    /api/convert/:jobId/status  # 转换进度

POST   /api/share                  # 创建分享链接
GET    /api/share/:token           # 访问分享页（含模型数据）
DELETE /api/share/:id              # 撤销分享
GET    /api/share                  # 我的分享列表
```

### 4.3 数据库 Schema (Prisma)

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String?
  avatar    String?
  models    Model[]
  folders   Folder[]
  shares    ShareLink[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Folder {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  models    Model[]
  parentId  String?
  parent    Folder?  @relation("FolderTree", fields: [parentId], references: [id])
  children  Folder[] @relation("FolderTree")
  createdAt DateTime @default(now())

  @@index([userId])
}

model Model {
  id            String   @id @default(cuid())
  name          String
  format        String           // STL, OBJ, STEP, GLTF...
  originalSize  Int              // bytes
  storagePath   String           // S3 key 或本地路径
  thumbnailPath String?
  convertedPath String?          // 转换后的 GLTF 路径
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  folderId      String?
  folder        Folder?  @relation(fields: [folderId], references: [id])
  annotations   Json?            // 标注数据
  shares        ShareLink[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId, folderId])
}

model ShareLink {
  id        String   @id @default(cuid())
  token     String   @unique @default(cuid())
  modelId   String
  model     Model    @relation(fields: [modelId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime?
  password  String?            // 可选密码保护
  viewCount Int      @default(0)
  maxViews  Int?               // 可选最大查看次数
  createdAt DateTime @default(now())

  @@index([token])
}
```

### 4.4 核心服务实现

**格式转换 (convert.service.js)**:
```js
import { Worker } from 'worker_threads';
import path from 'path';

const JOBS = new Map();

export function startConversion(inputPath, outputFormat = 'glb') {
  const jobId = crypto.randomUUID();

  const worker = new Worker(
    path.join(__dirname, '../workers/converter.worker.js'),
    { workerData: { inputPath, outputFormat, jobId } }
  );

  JOBS.set(jobId, { status: 'processing', progress: 0 });

  worker.on('message', (msg) => {
    if (msg.type === 'progress') JOBS.get(jobId).progress = msg.value;
    if (msg.type === 'done') {
      JOBS.get(jobId).status = 'completed';
      JOBS.get(jobId).outputPath = msg.outputPath;
    }
  });

  worker.on('error', (err) => {
    JOBS.get(jobId).status = 'failed';
    JOBS.get(jobId).error = err.message;
  });

  return jobId;
}

export function getJobStatus(jobId) {
  return JOBS.get(jobId) || null;
}
```

**converter.worker.js**（子进程避免阻塞主线程）:
```js
import { parentPort, workerData } from 'worker_threads';
import occtImportJs from 'occt-import-js';

(async () => {
  const { inputPath, outputFormat, jobId } = workerData;
  const fs = await import('fs');

  parentPort.postMessage({ type: 'progress', value: 10 });

  const occt = await occtImportJs();
  const fileBuffer = fs.readFileSync(inputPath);

  parentPort.postMessage({ type: 'progress', value: 30 });

  const ext = inputPath.split('.').pop().toLowerCase();
  let result;
  if (ext === 'step' || ext === 'stp') {
    result = occt.ReadStepFile(new Uint8Array(fileBuffer), null);
  } else if (ext === 'iges' || ext === 'igs') {
    result = occt.ReadIgesFile(new Uint8Array(fileBuffer), null);
  }

  parentPort.postMessage({ type: 'progress', value: 70 });

  if (!result?.success) throw new Error('转换失败');

  // 转为 GLB → 写入磁盘（省略 Three.js 序列化逻辑）
  const outputPath = inputPath.replace(/\.[^.]+$/, '.glb');
  // ... serialize meshes to GLB ...

  parentPort.postMessage({ type: 'progress', value: 100 });
  parentPort.postMessage({ type: 'done', outputPath });
})();
```

**存储抽象层 (storage.service.js)**:
```js
// 支持本地 / S3 / MinIO 无缝切换
const STRATEGY = process.env.STORAGE_STRATEGY || 'local'; // 'local' | 's3'

export async function uploadFile(buffer, key) {
  if (STRATEGY === 's3') {
    return s3Upload(buffer, key);
  }
  return localSave(buffer, key);
}

export async function getFileStream(key) {
  if (STRATEGY === 's3') {
    return s3GetStream(key);
  }
  return fs.createReadStream(path.join(UPLOAD_DIR, key));
}
```

---

## 五、前后端对接要点

### 5.1 模型上传流程（替代 IndexedDB）

```
[用户拖拽文件]
    ↓
[前端] POST /api/models/upload (multipart, 含 folderId)
    ↓
[后端] multer 接收 → 存入 S3/本地 → 写 DB 记录
    ↓  如果是 STEP/IGES
    ↓  异步触发 Worker 转换 → 返回 jobId
    ↓
[前端] 轮询 GET /api/convert/:jobId/status
    ↓  完成后
[前端] GET /api/models/:id/download?format=glb → 加载到 Three.js
```

### 5.2 分享链接流程

```
[模型库] → 点击分享 → POST /api/share { modelId, expiresAt?, password? }
    ↓
返回: https://yoursite.com/s/abc123
    ↓
[访客打开] → GET /api/share/abc123
    ↓  验证密码/过期/次数
返回: 模型元数据 + 下载 URL（临时签名）
    ↓
[前端] 只读模式加载模型（隐藏上传/编辑功能）
```

---

## 六、部署方案对比

### 方案 A：Docker 容器化（推荐生产环境）

```
┌─────────────────────────────────────────┐
│              Docker Compose             │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │  Nginx   │→│  Node.js  │→│  PG   │ │
│  │  :80/443 │  │  :3000    │  │ :5432 │ │
│  └──────────┘  └──────────┘  └───────┘ │
│       ↓                          ↓      │
│  前端静态文件              MinIO :9000  │
│  (Vite build)              (文件存储)    │
└─────────────────────────────────────────┘
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/dist:/usr/share/nginx/html
    depends_on: [backend]

  backend:
    build: ./backend
    env_file: .env
    volumes:
      - model-storage:/app/uploads
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: viewer3d
      POSTGRES_USER: viewer
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - minio-data:/data

volumes:
  pg-data:
  minio-data:
  model-storage:
```

**优点**: 一键部署，环境隔离，可扩展  
**适合**: 自有服务器、团队内部部署

---

### 方案 B：传统 VPS (Nginx + PM2)

```
VPS (Ubuntu 22.04)
├── Nginx          → 反向代理 + 前端静态
├── PM2            → Node.js 进程管理
├── PostgreSQL     → 数据库
└── /data/uploads/ → 模型文件存储
```

```bash
# 部署脚本
npm run build --prefix frontend
pm2 start backend/src/index.js --name viewer3d -i max
# Nginx 配置指向 frontend/dist + 代理 /api → localhost:3000
```

**优点**: 简单直接，成本低  
**适合**: 个人项目、小团队

---

### 方案 C：PaaS 平台

| 组件 | 推荐平台 | 说明 |
|------|----------|------|
| 前端 | Vercel / Cloudflare Pages | 免费，全球 CDN |
| 后端 | Railway / Render / Fly.io | 免费/低成本容器 |
| 数据库 | Supabase / Neon (PG) | 免费额度够用 |
| 文件存储 | Cloudflare R2 / AWS S3 | R2 免出站费用 |

```
Vercel (前端) → Railway (后端 API) → Supabase (PG) + R2 (文件)
```

**优点**: 零运维，自动扩缩，免费起步  
**适合**: 快速上线、MVP 验证

---

## 七、实施路线图

```
Phase 1 (1-2周): 前端重构
  ├─ Vite 项目初始化
  ├─ 拆分 POC.html → 模块化组件
  ├─ SceneManager + LoaderFactory
  └─ 本地开发可用（保留 IndexedDB 作为 fallback）

Phase 2 (1-2周): 后端核心
  ├─ Express + Prisma + JWT 认证
  ├─ 模型上传/下载/CRUD
  ├─ 文件存储抽象层
  └─ 目录管理 API

Phase 3 (1周): 进阶功能
  ├─ STEP/IGES 服务端转换 Worker
  ├─ 分享链接
  ├─ 服务端缩略图生成
  └─ 标注数据同步

Phase 4 (1周): 部署 + 优化
  ├─ Docker 打包
  ├─ CI/CD (GitHub Actions)
  ├─ 性能优化（CDN、gzip、代码分割）
  └─ 监控 + 日志
```

---

## 八、环境变量模板

```env
# .env.example
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://viewer:password@localhost:5432/viewer3d

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d

# Storage
STORAGE_STRATEGY=local          # local | s3
UPLOAD_DIR=./uploads
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=viewer3d
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Share
SHARE_BASE_URL=https://yoursite.com/s

# CORS
CORS_ORIGIN=https://yoursite.com
```
