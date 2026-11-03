# ==========================================
# Stage 1: Frontend Build
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Backend Build
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

# Install native compilation toolchain for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

# ==========================================
# Stage 3: Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install native dependencies for SQLite
RUN apk add --no-cache python3 make g++

# Copy compiled frontend SPA from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy compiled backend output and package manifests from Stage 2
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY --from=backend-builder /app/backend/package*.json /app/backend/

# Install production dependencies only in backend
WORKDIR /app/backend
RUN npm install --production

# Create persistent storage directory for SQLite database
RUN mkdir -p /app/backend/data

# Production environment variables
ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

WORKDIR /app
CMD ["node", "backend/dist/index.js"]
