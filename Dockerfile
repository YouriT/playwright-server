# Use Node.js LTS as base image
FROM node:20-slim

ARG DEBIAN_FRONTEND=noninteractive

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Set working directory
WORKDIR /app

# Copy package files first to leverage caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Install Patchright browsers with system dependencies
# This will install Chrome and all required system libraries
# Using --with-deps flag to install all system dependencies automatically
RUN npx patchright install chrome --with-deps && \
    # Clean apt cache to reduce image size
    rm -rf /var/lib/apt/lists/*

# Install xvfb for virtual display (not included in --with-deps)
RUN apt-get update && \
    apt-get install -y xvfb && \
    rm -rf /var/lib/apt/lists/*

# Copy source code (changes here won't invalidate browser cache)
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Prune dev dependencies for smaller image
RUN npm prune --production

# Create non-root user and set up permissions
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs && \
    chown -R nodejs:nodejs /app && \
    # Copy Playwright browser cache to user home directory
    mkdir -p /home/nodejs/.cache && \
    cp -r /root/.cache/ms-playwright /home/nodejs/.cache/ 2>/dev/null || \
    cp -r /root/.cache/patchright /home/nodejs/.cache/ 2>/dev/null || true && \
    # Create Chrome config directories to prevent crashpad errors (Chrome 128+)
    mkdir -p /home/nodejs/.config/google-chrome/Crashpad \
             /home/nodejs/.local/share \
             /home/nodejs/.pki && \
    chown -R nodejs:nodejs /home/nodejs

# Create directories for volumes
RUN mkdir -p /app/recordings /app/user-data && \
    chown -R nodejs:nodejs /app/recordings /app/user-data

# Create X11 socket directory with proper permissions
RUN mkdir -p /tmp/.X11-unix && \
    chmod 1777 /tmp/.X11-unix && \
    chown root:root /tmp/.X11-unix

USER nodejs

# Expose the port the app runs on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Define volumes for persistent data
VOLUME ["/app/recordings", "/app/user-data"]

# Run the application with xvfb for virtual display
CMD ["./docker-entrypoint.sh"]
