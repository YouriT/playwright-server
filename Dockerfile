# Use Node.js LTS as base image
FROM node:20-slim

# Install dependencies required for Playwright/Patchright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first to leverage caching
COPY package*.json ./

# Install dependencies (including patchright)
RUN npm ci --only=production

# Install Playwright browsers early (before copying source code)
# This layer will be cached and won't rebuild unless package.json changes
RUN npx patchright install chromium

# Copy source code (changes here won't invalidate browser cache)
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install typescript @types/node @types/express @types/uuid --save-dev && \
    npm run build && \
    npm prune --production

# Expose the port the app runs on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/server.js"]
