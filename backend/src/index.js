import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import modelRoutes from './routes/model.routes.js';
import folderRoutes from './routes/folder.routes.js';
import shareRoutes from './routes/share.routes.js';
import convertRoutes from './routes/convert.routes.js';

const app = express();

// ===== 全局中间件 =====
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 限流：每个 IP 每分钟最多 100 次请求
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求频率过高，请稍后再试' },
}));

// 上传接口单独限流
app.use('/api/models/upload', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '上传频率过高' },
}));

// ===== 路由 =====
app.use('/api/auth', authRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/convert', convertRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// ===== 错误处理 =====
app.use(notFound);
app.use(errorHandler);

// ===== 启动 =====
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[Server] 启动成功 → http://0.0.0.0:${env.PORT}`);
  console.log(`[Server] 环境: ${env.NODE_ENV}`);
  console.log(`[Server] 存储: ${env.STORAGE_STRATEGY}`);
});

export default app;
