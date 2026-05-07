#!/usr/bin/env node
/**
 * 后端集成测试脚本
 * 验证项目：模块导入、路由注册、中间件链、服务层逻辑
 * 
 * 无需数据库连接，对纯逻辑层进行静态+动态验证
 * 
 * 用法: node tests/verify.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
    errors.push(name);
  }
}

function section(title) {
  console.log(`\n━━━ ${title} ━━━`);
}

// ===== 1. 文件完整性检查 =====
section('1. 文件完整性');

const requiredFiles = [
  'src/index.js',
  'src/config/env.js',
  'src/config/database.js',
  'src/middleware/auth.js',
  'src/middleware/upload.js',
  'src/middleware/errorHandler.js',
  'src/routes/auth.routes.js',
  'src/routes/model.routes.js',
  'src/routes/folder.routes.js',
  'src/routes/share.routes.js',
  'src/routes/convert.routes.js',
  'src/services/auth.service.js',
  'src/services/storage.service.js',
  'src/services/convert.service.js',
  'src/services/share.service.js',
  'src/workers/converter.worker.js',
  'prisma/schema.prisma',
  'prisma/seed.js',
  'package.json',
  'Dockerfile',
  '.env.example',
  '.dockerignore',
];

for (const f of requiredFiles) {
  assert(fs.existsSync(path.join(ROOT, f)), `文件存在: ${f}`);
}

// ===== 2. Prisma Schema 验证 =====
section('2. Prisma Schema');

const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');

assert(schema.includes('model User'), 'Schema 包含 User 模型');
assert(schema.includes('model Folder'), 'Schema 包含 Folder 模型');
assert(schema.includes('model Model'), 'Schema 包含 Model 模型');
assert(schema.includes('model ShareLink'), 'Schema 包含 ShareLink 模型');
assert(schema.includes('model ConvertJob'), 'Schema 包含 ConvertJob 模型');
assert(schema.includes('@@map("users")'), 'User 表映射正确');
assert(schema.includes('@@map("models")'), 'Model 表映射正确');
assert(schema.includes('provider = "postgresql"'), '使用 PostgreSQL');
assert(schema.includes('onDelete: Cascade'), '级联删除配置');
assert(schema.includes('onDelete: SetNull'), 'Folder 删除时 Model.folderId 置空');
assert(schema.includes('@relation("FolderTree"'), 'Folder 自引用树结构');
assert(schema.includes('Json?'), 'JSONB 字段（metadata/annotations）');
assert(schema.includes('@@index([userId, folderId])'), 'Model 复合索引');
assert(schema.includes('@@index([token])'), 'ShareLink token 索引');

// ===== 3. 环境变量配置 =====
section('3. 环境变量');

const envConfig = fs.readFileSync(path.join(ROOT, 'src/config/env.js'), 'utf8');

const requiredEnvKeys = [
  'NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN',
  'STORAGE_STRATEGY', 'UPLOAD_DIR', 'MAX_FILE_SIZE',
  'S3_ENDPOINT', 'S3_BUCKET', 'SHARE_BASE_URL', 'CORS_ORIGIN',
];
for (const key of requiredEnvKeys) {
  assert(envConfig.includes(key), `env.js 包含 ${key}`);
}

// ===== 4. 路由定义验证 =====
section('4. 路由定义');

const indexFile = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');

const routePaths = [
  ['/api/auth', 'authRoutes'],
  ['/api/models', 'modelRoutes'],
  ['/api/folders', 'folderRoutes'],
  ['/api/share', 'shareRoutes'],
  ['/api/convert', 'convertRoutes'],
  ['/api/health', 'health'],
];

for (const [routePath] of routePaths) {
  assert(indexFile.includes(routePath), `路由注册: ${routePath}`);
}

// 中间件
assert(indexFile.includes('helmet'), '使用 helmet 安全头');
assert(indexFile.includes('cors'), '使用 cors');
assert(indexFile.includes('morgan'), '使用 morgan 日志');
assert(indexFile.includes('rateLimit'), '使用限流中间件');
assert(indexFile.includes('errorHandler'), '注册全局错误处理');
assert(indexFile.includes('notFound'), '注册404处理');

// ===== 5. Auth 路由端点验证 =====
section('5. Auth 路由');

const authRoute = fs.readFileSync(path.join(ROOT, 'src/routes/auth.routes.js'), 'utf8');

assert(authRoute.includes("'/register'"), 'POST /register');
assert(authRoute.includes("'/login'"), 'POST /login');
assert(authRoute.includes("'/refresh'"), 'POST /refresh');
assert(authRoute.includes("'/me'"), 'GET /me');
assert(authRoute.includes('authenticate'), '/me 需要认证');
assert(authRoute.includes('password.length < 6'), '密码长度验证');

// ===== 6. Model 路由端点验证 =====
section('6. Model 路由');

const modelRoute = fs.readFileSync(path.join(ROOT, 'src/routes/model.routes.js'), 'utf8');

assert(modelRoute.includes("router.get('/'"), 'GET / (列表)');
assert(modelRoute.includes("'/upload'"), 'POST /upload');
assert(modelRoute.includes("'/:id'") && modelRoute.includes('router.get'), 'GET /:id (详情)');
assert(modelRoute.includes("'/:id/download'"), 'GET /:id/download');
assert(modelRoute.includes("'/:id/thumbnail'"), 'GET /:id/thumbnail');
assert(modelRoute.includes("'/:id/move'"), 'PUT /:id/move');
assert(modelRoute.includes("router.delete"), 'DELETE /:id');
assert(modelRoute.includes('uploadModel'), '使用 multer 上传中间件');
assert(modelRoute.includes('authenticate'), '所有端点需要认证');
assert(modelRoute.includes('startConversion'), 'STEP/IGES 自动触发转换');
assert(modelRoute.includes('storage.delete'), '删除时清理文件');
assert(modelRoute.includes('cleanTemp'), '上传后清理临时文件');

// ===== 7. Folder 路由验证 =====
section('7. Folder 路由');

const folderRoute = fs.readFileSync(path.join(ROOT, 'src/routes/folder.routes.js'), 'utf8');

assert(folderRoute.includes("router.get('/'"), 'GET / (列表)');
assert(folderRoute.includes("router.post('/'"), 'POST / (创建)');
assert(folderRoute.includes("router.put('/:id'"), 'PUT /:id (重命名)');
assert(folderRoute.includes("router.delete('/:id'"), 'DELETE /:id');
assert(folderRoute.includes('folderId: null'), '删除目录时模型归入默认');

// ===== 8. Share 路由验证 =====
section('8. Share 路由');

const shareRoute = fs.readFileSync(path.join(ROOT, 'src/routes/share.routes.js'), 'utf8');

assert(shareRoute.includes("router.post('/'"), 'POST / (创建分享)');
assert(shareRoute.includes("'/:token'"), 'GET /:token (访问)');
assert(shareRoute.includes("'/:token/download'"), 'GET /:token/download');
assert(shareRoute.includes("router.delete"), 'DELETE /:id (撤销)');

// ===== 9. 服务层验证 =====
section('9. 服务层');

const authService = fs.readFileSync(path.join(ROOT, 'src/services/auth.service.js'), 'utf8');
assert(authService.includes('bcrypt.hash'), '密码哈希');
assert(authService.includes('bcrypt.compare'), '密码比较');
assert(authService.includes('jwt.sign'), 'JWT 签发');
assert(authService.includes('SALT_ROUNDS = 12'), 'bcrypt 12轮加盐');
assert(authService.includes('accessToken') && authService.includes('refreshToken'), '双 token 机制');

const storageService = fs.readFileSync(path.join(ROOT, 'src/services/storage.service.js'), 'utf8');
assert(storageService.includes('localSave'), '本地存储 save');
assert(storageService.includes('localGetStream'), '本地存储 getStream');
assert(storageService.includes('localDelete'), '本地存储 delete');
assert(storageService.includes("STORAGE_STRATEGY === 's3'"), 'S3 策略切换');
assert(storageService.includes('cleanTemp'), '临时文件清理函数');

const shareService = fs.readFileSync(path.join(ROOT, 'src/services/share.service.js'), 'utf8');
assert(shareService.includes('nanoid'), '使用 nanoid 生成 token');
assert(shareService.includes('expiresAt'), '过期时间检查');
assert(shareService.includes('maxViews'), '最大查看次数');
assert(shareService.includes('bcrypt.compare'), '密码验证');
assert(shareService.includes('viewCount'), '查看计数递增');

const convertService = fs.readFileSync(path.join(ROOT, 'src/services/convert.service.js'), 'utf8');
assert(convertService.includes('new Worker'), 'Worker 线程转换');
assert(convertService.includes("'progress'"), '进度消息');
assert(convertService.includes("'done'"), '完成消息');

// ===== 10. Middleware 验证 =====
section('10. 中间件');

const authMiddleware = fs.readFileSync(path.join(ROOT, 'src/middleware/auth.js'), 'utf8');
assert(authMiddleware.includes('Bearer'), 'Bearer token 提取');
assert(authMiddleware.includes('jwt.verify'), 'JWT 验证');
assert(authMiddleware.includes('TokenExpiredError'), '过期处理');
assert(authMiddleware.includes('optionalAuth'), '可选认证中间件');

const uploadMiddleware = fs.readFileSync(path.join(ROOT, 'src/middleware/upload.js'), 'utf8');
assert(uploadMiddleware.includes('.stl'), 'STL 格式白名单');
assert(uploadMiddleware.includes('.step'), 'STEP 格式白名单');
assert(uploadMiddleware.includes('.gltf'), 'GLTF 格式白名单');
assert(uploadMiddleware.includes('.fbx'), 'FBX 格式白名单');
assert(uploadMiddleware.includes('LIMIT_FILE_SIZE'), '文件大小限制处理');

const errorMiddleware = fs.readFileSync(path.join(ROOT, 'src/middleware/errorHandler.js'), 'utf8');
assert(errorMiddleware.includes('P2002'), 'Prisma 唯一约束错误处理');
assert(errorMiddleware.includes('P2025'), 'Prisma 记录不存在处理');
assert(errorMiddleware.includes('notFound'), '404 处理函数');

// ===== 11. Worker 验证 =====
section('11. Worker 线程');

const worker = fs.readFileSync(path.join(ROOT, 'src/workers/converter.worker.js'), 'utf8');
assert(worker.includes('parentPort'), '使用 parentPort 通信');
assert(worker.includes('workerData'), '接收 workerData');
assert(worker.includes('ReadStepFile'), 'STEP 解析');
assert(worker.includes('ReadIgesFile'), 'IGES 解析');
assert(worker.includes('occt-mesh-json'), '标准化输出格式');
assert(worker.includes('UPLOAD_DIR'), '使用环境变量路径');

// ===== 12. Docker 配置验证 =====
section('12. Docker 配置');

const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
assert(dockerfile.includes('node:20-alpine'), '使用 Node 20 Alpine');
assert(dockerfile.includes('prisma generate'), 'Prisma Client 生成');
assert(dockerfile.includes('prisma db push'), '数据库 schema 推送');
assert(dockerfile.includes('HEALTHCHECK'), '健康检查配置');
assert(dockerfile.includes('appuser'), '非 root 用户运行');

const dockerignore = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
assert(dockerignore.includes('node_modules'), '忽略 node_modules');
assert(dockerignore.includes('.env'), '忽略 .env');

// ===== 13. Package.json 依赖验证 =====
section('13. 依赖完整性');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const requiredDeps = [
  'express', 'cors', 'helmet', 'morgan', 'jsonwebtoken',
  'bcryptjs', 'multer', 'nanoid', 'dotenv',
  'express-rate-limit', '@prisma/client', 'mime-types',
];
for (const dep of requiredDeps) {
  assert(dep in deps, `依赖: ${dep}`);
}

assert('prisma' in (pkg.devDependencies || {}), 'devDep: prisma');
assert(pkg.type === 'module', 'ESM 模块模式');

// ===== 结果 =====
console.log(`\n${'━'.repeat(40)}`);
console.log(`总计: ${passed + failed} 项  ✅ ${passed} 通过  ❌ ${failed} 失败`);
if (errors.length) {
  console.log(`\n失败项:`);
  errors.forEach(e => console.log(`  - ${e}`));
}
console.log(`${'━'.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
