FROM node:20-alpine AS builder
WORKDIR /app
ARG API_URL
ENV API_URL=${API_URL:-http://localhost:4001}
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S app -u 1001
COPY --from=builder --chown=app:nodejs /app/.next/standalone ./
COPY --from=builder --chown=app:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=app:nodejs /app/public ./public
RUN mkdir -p /app/data && chown -R app:nodejs /app
USER app
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
