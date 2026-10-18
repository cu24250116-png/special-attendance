# Multi-stage Dockerfile for College Special Attendance ERP
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and client package files
COPY package.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm --prefix client install
RUN npm --prefix server install

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY scripts/ ./scripts/

# Build client React application
RUN npm --prefix client run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server/node_modules ./server/node_modules

# Expose server port
EXPOSE 5000

# Start server
CMD ["node", "server/index.js"]
