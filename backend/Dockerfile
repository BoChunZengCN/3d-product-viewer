FROM node:20-alpine AS base
WORKDIR /app

# 安装依赖
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# 生成 Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# 复制源码
COPY src ./src

# 创建上传目录
RUN mkdir -p /app/uploads/{models,thumbnails,converted,temp}

# 非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
