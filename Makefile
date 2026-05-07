.PHONY: dev up down build logs db-migrate db-seed clean

# ===== 开发 =====
dev:
	cd backend && npm run dev

# ===== Docker 部署 =====
build-frontend:
	cd frontend && npm install && npm run build

up: build-frontend
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

# ===== 数据库 =====
db-migrate:
	docker compose exec backend npx prisma migrate deploy

db-seed:
	docker compose exec backend node prisma/seed.js

db-studio:
	cd backend && npx prisma studio

# ===== 清理 =====
clean:
	docker compose down -v --rmi local
	rm -rf backend/node_modules

# ===== 初次部署 =====
init:
	cp .env.example .env
	cp backend/.env.example backend/.env
	docker compose up -d --build
	@echo "等待数据库就绪..."
	sleep 5
	docker compose exec backend node prisma/seed.js
	@echo ""
	@echo "=== 部署完成 ==="
	@echo "访问: http://localhost:8080"
	@echo "API:  http://localhost:8080/api/health"
	@echo "默认账号: admin@viewer3d.local / admin123"
