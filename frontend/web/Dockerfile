# ============================================================================
# Frontend Next.js — Cổng thí sinh + Cổng quản lý
#   docker build -t tuyensinh-frontend --build-arg NEXT_PUBLIC_API_BASE_URL=https://<backend>/api/v1 ./frontend/web
# Biến NEXT_PUBLIC_* được "đóng" vào mã lúc build, đổi địa chỉ backend thì build lại.
# Cổng 3000.
# ============================================================================
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_DEMO_LOGIN=false
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_DEMO_LOGIN=$NEXT_PUBLIC_DEMO_LOGIN \
    NEXT_PUBLIC_USE_MOCK=false \
    NEXT_PUBLIC_ADMIN_USE_MOCK=false \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/announcements').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
