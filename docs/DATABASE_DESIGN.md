# 数据库与三维数据存储设计

## 一、整体架构

```
┌─────────────────────────────────────────────────────┐
│                    客户端 (浏览器)                     │
│  Three.js 渲染 ←── ArrayBuffer/JSON ←── fetch       │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                  Node.js 后端                        │
│                                                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ 元数据管理  │  │  文件流处理  │  │ 格式转换     │  │
│  │ (Prisma)   │  │ (multer/fs) │  │ (Worker线程) │  │
│  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘  │
│        │                │                │           │
└────────┼────────────────┼────────────────┼───────────┘
         │                │                │
    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐
    │PostgreSQL│     │ 文件系统   │    │ 文件系统   │
    │ 结构化   │     │ /uploads  │    │ /converted│
    │ 元数据   │     │ 原始模型  │    │ 转换结果  │
    └─────────┘     └───────────┘    └───────────┘
```

---

## 二、PostgreSQL 数据库设计

### 2.1 ER 关系图

```
 users ─1:N─ folders ─1:N─ models ─1:N─ share_links
   │                          │
   │                          │
   └──────────1:N─────────────┘
                              │
                     convert_jobs (异步任务)
```

### 2.2 表结构详细说明

#### users — 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CUID | PK | 主键，cuid 生成 |
| email | VARCHAR | UNIQUE, NOT NULL | 登录邮箱 |
| password | VARCHAR | NOT NULL | bcrypt 哈希，12轮加盐 |
| name | VARCHAR | NULLABLE | 显示名称 |
| avatar | VARCHAR | NULLABLE | 头像 URL |
| created_at | TIMESTAMP | DEFAULT now() | 注册时间 |
| updated_at | TIMESTAMP | 自动更新 | 最后修改 |

**索引**: `UNIQUE(email)`

**设计说明**: 使用 CUID 而非自增 ID，避免暴露用户数量，分布式安全。密码存储使用 bcrypt 12 轮加盐，抗暴力破解。

---

#### folders — 目录表（支持嵌套树）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CUID | PK | |
| name | VARCHAR | NOT NULL | 目录名称 |
| user_id | CUID | FK → users.id, CASCADE | 所属用户 |
| parent_id | CUID | FK → folders.id, NULLABLE | 父目录（树结构） |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | 自动更新 | |

**索引**: `INDEX(user_id)`  
**关系**: 自引用 `parent_id → id` 形成无限层级树

**设计说明**: 支持多级目录嵌套。`parent_id = NULL` 表示根目录。删除目录时子模型的 `folder_id` 置 NULL（归入默认）。

---

#### models — 模型表（核心表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CUID | PK | |
| name | VARCHAR | NOT NULL | 原始文件名 |
| format | VARCHAR(10) | NOT NULL | 格式标识：STL/OBJ/STEP/GLTF/FBX 等 |
| original_size | INTEGER | NOT NULL | 原始文件大小（字节） |
| storage_path | VARCHAR | NOT NULL | 原始文件存储路径/Key |
| thumbnail_path | VARCHAR | NULLABLE | 缩略图路径 |
| converted_path | VARCHAR | NULLABLE | 转换后文件路径（STEP→JSON 等） |
| metadata | JSONB | NULLABLE | 扩展元数据 |
| user_id | CUID | FK → users.id, CASCADE | 所属用户 |
| folder_id | CUID | FK → folders.id, SET NULL | 所属目录 |
| annotations | JSONB | NULLABLE | 标注数据 |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | 自动更新 | |

**索引**:
- `INDEX(user_id, folder_id)` — 按目录列表查询
- `INDEX(user_id, created_at)` — 按时间排序

---

#### metadata JSONB 结构

```json
{
  "mimeType": "application/octet-stream",
  "uploadedAt": "2025-01-01T00:00:00Z",
  "dimensions": {
    "x": 120.5,
    "y": 80.3,
    "z": 45.2,
    "unit": "mm"
  },
  "vertexCount": 15234,
  "faceCount": 30000,
  "hasNormals": true,
  "hasColors": false,
  "boundingBox": {
    "min": [-60.25, -40.15, -22.6],
    "max": [60.25, 40.15, 22.6]
  },
  "material": {
    "color": "#58a6ff",
    "metalness": 0.3,
    "roughness": 0.4
  }
}
```

#### annotations JSONB 结构

```json
[
  {
    "type": "point",
    "text": "焊接点A",
    "color": "#f59e0b",
    "points": [
      { "x": 10.5, "y": 20.3, "z": 5.1 }
    ],
    "createdAt": "2025-01-01T12:00:00Z"
  },
  {
    "type": "line",
    "text": "基准线",
    "color": "#58a6ff",
    "points": [
      { "x": 0, "y": 0, "z": 0 },
      { "x": 100, "y": 0, "z": 0 }
    ],
    "createdAt": "2025-01-01T12:01:00Z"
  }
]
```

---

#### share_links — 分享链接表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CUID | PK | |
| token | VARCHAR(12) | UNIQUE, NOT NULL | 短链标识（nanoid） |
| model_id | CUID | FK → models.id, CASCADE | 分享的模型 |
| user_id | CUID | FK → users.id, CASCADE | 分享者 |
| expires_at | TIMESTAMP | NULLABLE | 过期时间 |
| password | VARCHAR | NULLABLE | bcrypt 哈希的访问密码 |
| view_count | INTEGER | DEFAULT 0 | 已查看次数 |
| max_views | INTEGER | NULLABLE | 最大查看次数 |
| created_at | TIMESTAMP | DEFAULT now() | |

**索引**: `UNIQUE INDEX(token)` — 按 token 快速查找

---

#### convert_jobs — 异步转换任务表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CUID | PK | |
| model_id | CUID | NULLABLE | 关联模型 |
| input_path | VARCHAR | NOT NULL | 输入文件路径 |
| output_path | VARCHAR | NULLABLE | 输出文件路径 |
| status | VARCHAR(20) | DEFAULT 'pending' | pending / processing / completed / failed |
| progress | INTEGER | DEFAULT 0 | 进度百分比 0-100 |
| error | TEXT | NULLABLE | 失败原因 |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | 自动更新 | |

---

## 三、文件存储设计

### 3.1 目录结构

```
/app/uploads/
├── models/
│   ├── {userId}/
│   │   ├── 1735689600000-123456.stl     # 原始上传文件
│   │   ├── 1735689700000-789012.step
│   │   └── 1735689800000-345678.glb
│   └── ...
├── thumbnails/
│   ├── {userId}/
│   │   ├── {modelId}.png               # 200x150 缩略图
│   │   └── ...
│   └── ...
├── converted/
│   ├── {userId}/
│   │   ├── 1735689700000-789012.json   # STEP 转换后的网格 JSON
│   │   └── ...
│   └── ...
└── temp/                                # 上传临时区，处理后删除
```

### 3.2 文件命名规则

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 原始文件 | `{timestamp}-{random6}.{ext}` | `1735689600000-123456.stl` |
| 缩略图 | `{modelId}.png` | `clxyz123abc.png` |
| 转换文件 | `{原始文件名}.json` | `1735689700000-789012.json` |
| 存储Key | `models/{userId}/{filename}` | `models/clxyz.../17356...stl` |

### 3.3 文件存储策略

```
┌──────────────────────────────────────────────┐
│              storage.service.js              │
│         统一抽象层 (Strategy 模式)             │
│                                              │
│   STORAGE_STRATEGY=local                     │
│   ├── save(source, key) → fs.copyFile       │
│   ├── getStream(key) → fs.createReadStream  │
│   ├── delete(key) → fs.unlink               │
│   └── getPath(key) → path.join(DIR, key)    │
│                                              │
│   STORAGE_STRATEGY=s3                        │
│   ├── save(source, key) → S3.PutObject      │
│   ├── getStream(key) → S3.GetObject.Body    │
│   ├── delete(key) → S3.DeleteObject         │
│   └── getSignedUrl(key) → presigned URL     │
└──────────────────────────────────────────────┘
```

**切换存储只需改一个环境变量**，代码零改动。

### 3.4 三维数据生命周期

```
用户上传 STL/OBJ/GLTF
  │
  ▼
multer → /temp/{timestamp}-{rand}.ext
  │
  ▼
storage.save → /models/{userId}/{filename}     ← 永久存储
  │
  ▼ (如果是 STEP/IGES)
Worker 线程 → occt-import-js 解析
  │
  ▼
JSON 网格数据 → /converted/{userId}/{name}.json  ← 转换结果
  │
  ▼ (异步)
缩略图生成 → /thumbnails/{userId}/{modelId}.png  ← 预览图
  │
  ▼
清理 /temp
```

### 3.5 转换后的 JSON 格式（服务端 → 客户端）

STEP/IGES 经 OpenCASCADE WASM 解析后的标准化输出：

```json
{
  "format": "occt-mesh-json",
  "version": 1,
  "meshCount": 3,
  "meshes": [
    {
      "index": 0,
      "positions": [0.0, 1.0, 2.0, ...],
      "indices": [0, 1, 2, ...],
      "normals": [0.0, 0.0, 1.0, ...],
      "color": [0.8, 0.8, 0.8]
    }
  ]
}
```

客户端用 `LoaderFactory.loadConvertedJSON()` 直接构建 `THREE.BufferGeometry`。

---

## 四、数据流总览

### 4.1 上传流程

```
[浏览器]                    [后端]                      [存储]
   │                          │                           │
   │ POST /api/models/upload  │                           │
   │ multipart/form-data      │                           │
   │ ─────────────────────→   │                           │
   │                          │ multer → /temp/           │
   │                          │ storage.save ─────────→   │ /models/{uid}/{file}
   │                          │ prisma.model.create       │
   │                          │                           │
   │        if STEP/IGES      │                           │
   │                          │ new Worker()              │
   │                          │ occt.ReadStepFile()       │
   │                          │ write JSON ───────────→   │ /converted/{uid}/{file}.json
   │                          │ prisma.convertJob.update  │
   │                          │                           │
   │   ← { model, jobId }    │                           │
   │                          │                           │
   │ GET /convert/{id}/status │                           │
   │ (轮询直到 completed)     │                           │
   │                          │                           │
   │ GET /models/{id}/download│                           │
   │ ?format=converted        │                           │
   │   ← JSON stream ────────│ ← readStream ─────────   │
   │                          │                           │
   │ Three.js 渲染            │                           │
```

### 4.2 分享流程

```
[分享者]                      [后端]                   [访客]
   │                            │                        │
   │ POST /api/share            │                        │
   │ {modelId, password?}       │                        │
   │ ───────────────────→       │                        │
   │ ← {token, url}            │                        │
   │                            │                        │
   │ 发送链接给访客 ─────────────────────────────────→   │
   │                            │                        │
   │                            │    GET /api/share/:token│
   │                            │ ←─────────────────────  │
   │                            │ 验证过期/密码/次数      │
   │                            │ viewCount++            │
   │                            │ ──────────────────────→ │
   │                            │    {model: {...}}       │
   │                            │                        │
   │                            │    GET /share/:token/dl │
   │                            │ ← 文件流 ─────────────→ │
   │                            │                        │
   │                            │              Three.js 渲染
```

---

## 五、容量规划

| 指标 | 估算 | 说明 |
|------|------|------|
| 单个 STL 文件 | 1-50 MB | 工程零件 |
| 单个 STEP 文件 | 5-200 MB | 装配体 |
| 转换后 JSON | 原始大小 50-80% | 仅保留几何数据 |
| 缩略图 | 5-20 KB | 200×150 PNG |
| 100 个模型/用户 | ~2 GB | 平均 20MB/模型 |
| PostgreSQL 行 | ~1 KB/行 | 元数据极小 |
| JSONB (annotations) | 1-100 KB | 取决于标注数量 |

### 推荐磁盘分配

| 环境 | 数据库 | 文件存储 |
|------|--------|----------|
| 开发/PoC | 1 GB | 10 GB |
| 小团队 (5人) | 2 GB | 50 GB |
| 生产环境 | 10 GB SSD | S3 无上限 |

---

## 六、索引策略

```sql
-- 高频查询的索引
CREATE INDEX idx_models_user_folder ON models(user_id, folder_id);
CREATE INDEX idx_models_user_time ON models(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_share_token ON share_links(token);
CREATE INDEX idx_folders_user ON folders(user_id);

-- 全文搜索（可选，模型名称搜索）
-- CREATE INDEX idx_models_name_trgm ON models USING GIN (name gin_trgm_ops);
```

---

## 七、备份策略

```bash
# 每日自动备份（建议 crontab）
# 数据库
0 2 * * * docker compose exec -T postgres pg_dump -U viewer viewer3d | gzip > /backup/db_$(date +\%Y\%m\%d).sql.gz

# 文件存储（增量）
0 3 * * * rsync -a /app/uploads/ /backup/uploads/

# 保留最近 30 天
find /backup -name "db_*.sql.gz" -mtime +30 -delete
```
