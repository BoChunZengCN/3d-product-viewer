export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Prisma 错误
  if (err.code === 'P2002') {
    return res.status(409).json({ error: '数据已存在（唯一约束冲突）' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: '记录不存在' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? '服务器内部错误' : err.message,
  });
}

export function notFound(req, res) {
  res.status(404).json({ error: `路由不存在: ${req.method} ${req.path}` });
}
