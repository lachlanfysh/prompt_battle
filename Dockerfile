# Multi-stage build to optimize image size
# Stage 1: Build the React client
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci --only=production=false --silent

# Copy client source
COPY client/ ./

# Build the client
RUN npm run build

# Stage 2: Build the server
FROM node:18-alpine AS server-builder

WORKDIR /app

# Copy server package files
COPY package*.json ./

# Install server dependencies (including dev dependencies for now)
RUN npm ci --only=production=false --silent

# Copy server source
COPY . ./

# Copy built client from previous stage
COPY --from=client-builder /app/client/build ./client/build

# Stage 3: Production runtime
FROM node:18-alpine AS production

WORKDIR /app

# Copy server package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent && npm cache clean --force

# Copy built application from server-builder
COPY --from=server-builder /app/server.js ./
COPY --from=server-builder /app/client/build ./client/build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create generated_images directory with proper permissions
RUN mkdir -p generated_images && chown nodejs:nodejs generated_images

USER nodejs

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]