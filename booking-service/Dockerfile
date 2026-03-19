FROM node:20-alpine AS builder
WORKDIR /app
COPY booking-service/package*.json ./
RUN npm install
COPY booking-service/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY common/protos/ /common/protos/

EXPOSE 50053
CMD ["node", "dist/main"]
