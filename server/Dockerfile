FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apk add --no-cache python3 make g++ && npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache mysql-client && addgroup -g 1001 -S nodejs && adduser -S app -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/db/schema.mysql.sql ./src/db/schema.mysql.sql
RUN mkdir -p /app/data /app/backup && chown -R app:nodejs /app
USER app
EXPOSE 4001
CMD ["node", "dist/src/server.js"]
