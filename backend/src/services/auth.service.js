import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import prisma from '../config/database.js';

const SALT_ROUNDS = 12;

export async function register(email, password, name) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('该邮箱已注册');
    err.status = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, password: hashed, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return { user, tokens: generateTokens(user) };
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('邮箱或密码错误');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const err = new Error('邮箱或密码错误');
    err.status = 401;
    throw err;
  }

  const { password: _, ...safeUser } = user;
  return { user: safeUser, tokens: generateTokens(user) };
}

export async function refreshToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new Error('用户不存在');
    return generateTokens(user);
  } catch {
    const err = new Error('无效的刷新令牌');
    err.status = 401;
    throw err;
  }
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, avatar: true, createdAt: true,
      _count: { select: { models: true, folders: true } },
    },
  });
  if (!user) {
    const err = new Error('用户不存在');
    err.status = 404;
    throw err;
  }
  return user;
}

function generateTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
  const refreshTokenVal = jwt.sign(
    { sub: user.id, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken: refreshTokenVal };
}
