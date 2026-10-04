# ============================================================================
# Backend NestJS + Prisma — Hệ thống Quản lý Tuyển sinh Sau đại học
#   docker build -t tuyensinh-backend ./backend
# Biến môi trường cần khi chạy: DATABASE_URL, JWT_SECRET (xem .env.example).
# Cổng 4000, healthcheck GET /health. Tệp minh chứng lưu ở /app/uploads (gắn volume).
# ============================================================================
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/app/uploads
# Giữ đủ node_modules (kể cả ts-node) để chạy được npm run db:seed / db:update trong container
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/database ./database
RUN mkdir -p /app/uploads && chown node:node /app /app/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
