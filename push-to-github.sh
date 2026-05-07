#!/bin/bash
# ============================================================
# 3D Product Viewer V3.0 → GitHub 推送脚本
# 
# 使用方法：
#   1. 解压 3d-product-viewer-final.tar.gz
#   2. 进入项目目录
#   3. chmod +x push-to-github.sh && ./push-to-github.sh
# ============================================================

set -e

REPO_URL="https://github.com/BoChunZengCN/3d-product-viewer.git"
BRANCH="main"

echo "━━━ 3D Product Viewer V3.0 推送脚本 ━━━"
echo ""

# 检查是否已有 .git
if [ ! -d ".git" ]; then
    echo "[1/6] 初始化 Git 仓库..."
    git init
    git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
else
    echo "[1/6] Git 仓库已存在，更新 remote..."
    git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"
fi

# 拉取远程（保留 POC.html 和 index.html）
echo "[2/6] 拉取远程最新代码..."
git fetch origin "$BRANCH" 2>/dev/null || true
git checkout -B "$BRANCH" 2>/dev/null || true
# 如果远程有内容，先 merge（允许不相关历史）
git merge "origin/$BRANCH" --allow-unrelated-histories --no-edit 2>/dev/null || true

# 确保 .env 文件不被提交
echo "[3/6] 检查 .gitignore..."
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
fi

# 创建后端 .env（从 example 复制，不提交）
if [ ! -f "backend/.env" ]; then
    echo "[3.5/6] 创建 backend/.env（本地使用，不提交）..."
    cp backend/.env.example backend/.env
fi

# 暂存所有文件
echo "[4/6] 暂存所有文件..."
git add -A

# 显示变更摘要
echo ""
echo "━━━ 变更摘要 ━━━"
git diff --cached --stat 2>/dev/null || echo "(新仓库，所有文件为新增)"
echo ""

# 提交
echo "[5/6] 提交..."
git commit -m "feat: V3.0 全栈重构 — 后端 + 前端模块化 + Docker 部署

## 主要变更

### 新增后端 (Node.js + Express + Prisma)
- JWT 双 token 认证（注册/登录/刷新）
- 模型 CRUD + 文件上传（multer, 200MB 限制）
- 目录管理（嵌套树结构）
- 分享链接（密码保护/过期/次数限制）
- STEP/IGES 服务端 Worker 线程转换（occt-import-js）
- 存储抽象层（local/S3 一行切换）
- PostgreSQL 5 张表（users/folders/models/share_links/convert_jobs）

### 前端重构 (Vite + Three.js 模块化)
- 4200 行 POC.html → 21 个模块化文件
- API 客户端封装（JWT 自动注入/刷新 + 上传进度）
- SceneManager / LoaderFactory / MaterialManager / MeasureManager
- 登录/注册 UI + 分享弹窗组件
- 6 种测量模式（距离/轴向/角度/半径/面积/体积）

### Docker 一键部署
- docker-compose.yml: Nginx + Node.js + PostgreSQL
- Makefile: make init 一键启动
- Nginx 反向代理 + 静态文件缓存

### 文档
- docs/ARCHITECTURE.md: 全栈重构方案
- docs/DATABASE_DESIGN.md: 数据库 + 存储设计
- docs/DEPLOY.md: 部署指南

### 测试
- 后端验证: 144 项全通过
- 前端验证: 167 项全通过
"

# 推送
echo "[6/6] 推送到 GitHub..."
git push -u origin "$BRANCH"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 推送完成！"
echo ""
echo "GitHub: $REPO_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
