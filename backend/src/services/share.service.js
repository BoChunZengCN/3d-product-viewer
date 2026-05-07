import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { env } from '../config/env.js';

export async function createShareLink(userId, modelId, options = {}) {
  // 验证模型归属
  const model = await prisma.model.findFirst({
    where: { id: modelId, userId },
  });
  if (!model) {
    const err = new Error('模型不存在或无权限');
    err.status = 404;
    throw err;
  }

  const token = nanoid(12);
  const data = {
    token,
    modelId,
    userId,
    expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
    maxViews: options.maxViews || null,
    password: options.password ? await bcrypt.hash(options.password, 10) : null,
  };

  const link = await prisma.shareLink.create({ data });

  return {
    id: link.id,
    token: link.token,
    url: `${env.SHARE_BASE_URL}/${link.token}`,
    expiresAt: link.expiresAt,
    hasPassword: !!link.password,
  };
}

export async function accessShareLink(token, password = null) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      model: {
        select: {
          id: true, name: true, format: true, originalSize: true,
          storagePath: true, convertedPath: true, thumbnailPath: true,
          metadata: true, annotations: true,
        },
      },
    },
  });

  if (!link) {
    const err = new Error('分享链接不存在');
    err.status = 404;
    throw err;
  }

  // 检查过期
  if (link.expiresAt && new Date() > link.expiresAt) {
    const err = new Error('分享链接已过期');
    err.status = 410;
    throw err;
  }

  // 检查次数
  if (link.maxViews && link.viewCount >= link.maxViews) {
    const err = new Error('分享链接已达最大查看次数');
    err.status = 410;
    throw err;
  }

  // 检查密码
  if (link.password) {
    if (!password) {
      return { requirePassword: true };
    }
    const valid = await bcrypt.compare(password, link.password);
    if (!valid) {
      const err = new Error('密码错误');
      err.status = 403;
      throw err;
    }
  }

  // 计数 +1
  await prisma.shareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 } },
  });

  return { model: link.model };
}

export async function listUserShares(userId) {
  return prisma.shareLink.findMany({
    where: { userId },
    include: { model: { select: { id: true, name: true, format: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteShareLink(userId, shareId) {
  const link = await prisma.shareLink.findFirst({
    where: { id: shareId, userId },
  });
  if (!link) {
    const err = new Error('分享链接不存在');
    err.status = 404;
    throw err;
  }
  await prisma.shareLink.delete({ where: { id: shareId } });
}
