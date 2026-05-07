import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { authenticate } from '../middleware/auth.js';
import { uploadModel, handleUploadError } from '../middleware/upload.js';
import { storage, cleanTemp } from '../services/storage.service.js';
import { startConversion } from '../services/convert.service.js';
import prisma from '../config/database.js';
import { env } from '../config/env.js';

const router = Router();

// 模型列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { folderId, search, page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
    const where = { userId: req.user.id };

    if (folderId === 'null' || folderId === '') {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [models, total] = await Promise.all([
      prisma.model.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        select: {
          id: true, name: true, format: true, originalSize: true,
          thumbnailPath: true, convertedPath: true, folderId: true,
          metadata: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.model.count({ where }),
    ]);

    res.json({ models, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// 上传模型
router.post('/upload', authenticate, handleUploadError(uploadModel), async (req, res, next) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const { folderId } = req.body;
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const format = ext.toUpperCase();
    const storageKey = `models/${req.user.id}/${req.file.filename}`;

    // 移入正式存储
    await storage.save(tempPath, storageKey);
    cleanTemp(tempPath);

    // 写数据库
    const model = await prisma.model.create({
      data: {
        name: req.file.originalname,
        format,
        originalSize: req.file.size,
        storagePath: storageKey,
        userId: req.user.id,
        folderId: folderId || null,
        metadata: {
          mimeType: req.file.mimetype,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // STEP/IGES 自动触发后端转换
    let jobId = null;
    if (['STEP', 'STP', 'IGES', 'IGS'].includes(format)) {
      const fullPath = storage.getPath(storageKey);
      jobId = await startConversion(fullPath, model.id, 'glb');
    }

    res.status(201).json({ model, convertJobId: jobId });
  } catch (err) {
    cleanTemp(tempPath);
    next(err);
  }
});

// 模型详情
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const model = await prisma.model.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        folder: { select: { id: true, name: true } },
        _count: { select: { shares: true } },
      },
    });
    if (!model) return res.status(404).json({ error: '模型不存在' });
    res.json(model);
  } catch (err) { next(err); }
});

// 下载模型文件
router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const model = await prisma.model.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!model) return res.status(404).json({ error: '模型不存在' });

    const { format: fmt } = req.query; // ?format=converted 下载转换后的
    const key = fmt === 'converted' && model.convertedPath ? model.convertedPath : model.storagePath;
    const stream = await storage.getStream(key);
    if (!stream) return res.status(404).json({ error: '文件不存在' });

    const ext = path.extname(key);
    const contentType = mime.lookup(ext) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(model.name)}"`);
    stream.pipe(res);
  } catch (err) { next(err); }
});

// 获取缩略图
router.get('/:id/thumbnail', authenticate, async (req, res, next) => {
  try {
    const model = await prisma.model.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!model?.thumbnailPath) {
      return res.status(404).json({ error: '无缩略图' });
    }
    const stream = await storage.getStream(model.thumbnailPath);
    if (!stream) return res.status(404).json({ error: '缩略图文件不存在' });
    res.setHeader('Content-Type', 'image/png');
    stream.pipe(res);
  } catch (err) { next(err); }
});

// 更新模型元数据
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { name, annotations, metadata } = req.body;
    const model = await prisma.model.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: {
        ...(name && { name }),
        ...(annotations !== undefined && { annotations }),
        ...(metadata && { metadata }),
      },
    });
    if (model.count === 0) return res.status(404).json({ error: '模型不存在' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 移动模型到其他目录
router.put('/:id/move', authenticate, async (req, res, next) => {
  try {
    const { folderId } = req.body;
    // 验证目录归属
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: req.user.id },
      });
      if (!folder) return res.status(404).json({ error: '目标目录不存在' });
    }

    const result = await prisma.model.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { folderId: folderId || null },
    });
    if (result.count === 0) return res.status(404).json({ error: '模型不存在' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 删除模型
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const model = await prisma.model.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!model) return res.status(404).json({ error: '模型不存在' });

    // 删除存储文件
    await storage.delete(model.storagePath);
    if (model.thumbnailPath) await storage.delete(model.thumbnailPath);
    if (model.convertedPath) await storage.delete(model.convertedPath);

    // 删除数据库记录 (级联删除 shares)
    await prisma.model.delete({ where: { id: model.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
