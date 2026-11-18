# ==========================================
# Stage 1: Builder (Cài đặt & Biên dịch TS)
# ==========================================
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Copy schema database và manifest của API
COPY packages/database ./packages/database
COPY apps/api/package*.json ./apps/api/

WORKDIR /app/apps/api
RUN npm install

# Sinh Prisma Client vào node_modules của apps/api
RUN npx prisma generate --schema=/app/packages/database/prisma/schema.prisma

# Copy mã nguồn API và biên dịch sang JavaScript (dist/)
COPY apps/api ./
RUN npm run build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Chỉ copy các thành phần cần thiết để chạy thực tế
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000

# Tự động đồng bộ schema database rồi mới bật server API
CMD ["sh", "-c", "npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma && node dist/server.js"]