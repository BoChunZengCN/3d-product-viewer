# 部署指南

## 快速开始（Docker 一键部署）

### 前置要求
- Docker 24+
- Docker Compose v2+
- 2GB+ 内存

### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/BoChunZengCN/3d-product-viewer.git
cd 3d-product-viewer

# 2. 一键初始化
make init

# 3. 访问
# 前端: http://localhost:8080
# API:  http://localhost:8080/api/health
# 默认账号: admin@viewer3d.local / admin123
```

### 常用命令

```bash
make up            # 启动所有服务
make down          # 停止所有服务
make logs          # 查看实时日志
make logs-backend  # 仅查看后端日志
make build         # 重新构建镜像
make db-seed       # 初始化数据库种子数据
make clean         # 清理所有容器和数据（⚠️ 会删除数据库）
```

---

## 配置说明

### 后端环境变量（backend/.env）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端端口 | 3000 |
| `DATABASE_URL` | PostgreSQL 连接串 | 见 .env.example |
| `JWT_SECRET` | JWT 签名密钥（**必须修改**） | dev-secret |
| `JWT_EXPIRES_IN` | Access Token 有效期 | 7d |
| `STORAGE_STRATEGY` | 存储策略 `local` / `s3` | local |
| `UPLOAD_DIR` | 本地存储目录 | /app/uploads |
| `MAX_FILE_SIZE` | 最大上传大小(bytes) | 200MB |
| `CORS_ORIGIN` | 允许的前端域名 | http://localhost:8080 |
| `SHARE_BASE_URL` | 分享链接前缀 | http://localhost:8080/s |

### 生产环境检查清单

- [ ] 修改 `JWT_SECRET` 为随机64位字符串
- [ ] 修改 `DB_PASSWORD` 
- [ ] 设置 `CORS_ORIGIN` 为正式域名
- [ ] 设置 `SHARE_BASE_URL` 为正式域名
- [ ] 配置 HTTPS（Nginx 挂载 SSL 证书）
- [ ] 配置备份策略（PostgreSQL + uploads 目录）

---

## 架构说明

```
                    ┌──────────────────────┐
    用户浏览器 ────→│  Nginx :80           │
                    │  - 前端静态文件       │
                    │  - /api/* 反向代理    │
                    └─────────┬────────────┘
                              │
                    ┌─────────▼────────────┐
                    │  Node.js :3000       │
                    │  Express + Prisma    │
                    │  - 认证 (JWT)        │
                    │  - 模型 CRUD         │
                    │  - 格式转换 (Worker) │
                    │  - 分享链接          │
                    └──┬──────────────┬────┘
                       │              │
              ┌────────▼───┐   ┌──────▼─────┐
              │ PostgreSQL │   │ 文件存储    │
              │ :5432      │   │ /uploads   │
              │ 用户/模型  │   │ 模型文件   │
              │ 目录/分享  │   │ 缩略图     │
              └────────────┘   └────────────┘
```

## API 概览

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 注册 | - |
| POST | /api/auth/login | 登录 | - |
| POST | /api/auth/refresh | 刷新 token | - |
| GET | /api/auth/me | 当前用户信息 | ✅ |
| GET | /api/models | 模型列表 | ✅ |
| POST | /api/models/upload | 上传模型 | ✅ |
| GET | /api/models/:id | 模型详情 | ✅ |
| GET | /api/models/:id/download | 下载原始文件 | ✅ |
| GET | /api/models/:id/thumbnail | 获取缩略图 | ✅ |
| PUT | /api/models/:id | 更新元数据 | ✅ |
| PUT | /api/models/:id/move | 移动到目录 | ✅ |
| DELETE | /api/models/:id | 删除模型 | ✅ |
| GET | /api/folders | 目录列表 | ✅ |
| POST | /api/folders | 创建目录 | ✅ |
| PUT | /api/folders/:id | 重命名目录 | ✅ |
| DELETE | /api/folders/:id | 删除目录 | ✅ |
| POST | /api/share | 创建分享链接 | ✅ |
| GET | /api/share | 我的分享列表 | ✅ |
| GET | /api/share/:token | 访问分享 | - |
| GET | /api/share/:token/download | 下载分享模型 | - |
| DELETE | /api/share/:id | 撤销分享 | ✅ |
| POST | /api/convert | 格式转换 | ✅ |
| GET | /api/convert/:jobId/status | 转换进度 | ✅ |
| GET | /api/health | 健康检查 | - |

---

## 备份与恢复

### 数据库备份
```bash
# 备份
docker compose exec postgres pg_dump -U viewer viewer3d > backup_$(date +%Y%m%d).sql

# 恢复
cat backup_20250101.sql | docker compose exec -T postgres psql -U viewer viewer3d
```

### 文件备份
```bash
# 备份上传文件
docker cp $(docker compose ps -q backend):/app/uploads ./uploads_backup_$(date +%Y%m%d)
```

---

## 扩展：S3 存储

修改 `backend/.env`：

```env
STORAGE_STRATEGY=s3
S3_ENDPOINT=https://s3.amazonaws.com   # 或 MinIO 地址
S3_BUCKET=your-bucket
S3_REGION=ap-southeast-1
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
```

安装依赖：`npm install @aws-sdk/client-s3`，然后在 `storage.service.js` 中实现 S3 方法。
