import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('正在初始化数据库...');

  // 创建默认管理员账号
  const password = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@viewer3d.local' },
    update: {},
    create: {
      email: 'admin@viewer3d.local',
      password,
      name: '管理员',
    },
  });

  // 创建默认目录
  await prisma.folder.upsert({
    where: { id: 'default-folder' },
    update: {},
    create: {
      id: 'default-folder',
      name: '示例目录',
      userId: admin.id,
    },
  });

  console.log(`管理员账号: admin@viewer3d.local / admin123`);
  console.log('数据库初始化完成');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
