import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import * as shareService from '../services/share.service.js';
import { storage } from '../services/storage.service.js';
import mime from 'mime-types';
import path from 'path';

const router = Router();

// 创建分享链接
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { modelId, expiresAt, password, maxViews } = req.body;
    if (!modelId) return res.status(400).json({ error: '缺少 modelId' });

    const link = await shareService.createShareLink(req.user.id, modelId, {
      expiresAt, password, maxViews,
    });
    res.status(201).json(link);
  } catch (err) { next(err); }
});

// 我的分享列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const shares = await shareService.listUserShares(req.user.id);
    res.json(shares);
  } catch (err) { next(err); }
});

// 访问分享链接（公开）
router.get('/:token', async (req, res, next) => {
  try {
    const { password } = req.query;
    const result = await shareService.accessShareLink(req.params.token, password);
    res.json(result);
  } catch (err) { next(err); }
});

// 下载分享模型文件（公开）
router.get('/:token/download', async (req, res, next) => {
  try {
    const { password } = req.query;
    const result = await shareService.accessShareLink(req.params.token, password);

    if (result.requirePassword) {
      return res.status(403).json({ requirePassword: true });
    }

    const model = result.model;
    const key = model.convertedPath || model.storagePath;
    const stream = await storage.getStream(key);
    if (!stream) return res.status(404).json({ error: '文件不存在' });

    const ext = path.extname(key);
    res.setHeader('Content-Type', mime.lookup(ext) || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(model.name)}"`);
    stream.pipe(res);
  } catch (err) { next(err); }
});

// 撤销分享
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await shareService.deleteShareLink(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
