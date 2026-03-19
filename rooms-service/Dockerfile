FROM node:20-alpine AS builder
WORKDIR /app
COPY rooms-service/package*.json ./
RUN npm ci
COPY rooms-service/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY common/protos/ /common/protos/

EXPOSE 50052
CMD ["node", "dist/main"]
