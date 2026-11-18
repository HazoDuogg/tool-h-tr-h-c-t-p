# ==========================================
# Stage 1: Builder
# ==========================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /app/apps/web

COPY apps/web/package*.json ./
RUN npm install

COPY apps/web ./

# Đảm bảo thư mục public luôn tồn tại kể cả khi chưa có file tĩnh
RUN mkdir -p public

# Biến môi trường public được nhúng trực tiếp vào bundle lúc build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Tạo user non-root để tăng cường bảo mật container
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]