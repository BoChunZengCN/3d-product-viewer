import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();

// 目录列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { models: true } } },
    });
    res.json(folders);
  } catch (err) { next(err); }
});

// 创建目录
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, parentId } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: '目录名称不能为空' });
    }

    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, userId: req.user.id },
      });
      if (!parent) return res.status(404).json({ error: '父目录不存在' });
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId: req.user.id,
        parentId: parentId || null,
      },
    });
    res.status(201).json(folder);
  } catch (err) { next(err); }
});

// 重命名目录
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: '目录名称不能为空' });
    }

    const result = await prisma.folder.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { name: name.trim() },
    });
    if (result.count === 0) return res.status(404).json({ error: '目录不存在' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 删除目录（模型归入默认）
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const folder = await prisma.folder.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!folder) return res.status(404).json({ error: '目录不存在' });

    // 将目录下模型移到根目录
    await prisma.model.updateMany({
      where: { folderId: req.params.id, userId: req.user.id },
      data: { folderId: null },
    });

    // 子目录也移到根
    await prisma.folder.updateMany({
      where: { parentId: req.params.id },
      data: { parentId: null },
    });

    await prisma.folder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
