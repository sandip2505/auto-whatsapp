# ==============================================================================
# Dockerfile for WhatsApp Message Scheduler on Render / Cloud
# Includes Node.js 20, system Chromium, necessary C++ dependencies, and dumb-init
# ==============================================================================

FROM node:20-bullseye-slim

# Install system Chromium, necessary rendering libraries, and dumb-init
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    ca-certificates \
    dumb-init \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Environment variables for Puppeteer and Node
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

WORKDIR /app

# Copy root and workspace package files
COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/
COPY client/package.json client/package-lock.json* ./client/

# Install server and client dependencies
RUN npm --prefix server install --omit=dev && \
    npm --prefix client install

# Copy application source code
COPY . .

# Build Vite client bundle into client/dist
RUN npm --prefix client run build

# Run SQLite schema migrations
RUN npm --prefix server run db:migrate

# Ensure persistent data directory exists
RUN mkdir -p /app/data

EXPOSE 5000

# Use dumb-init to reap zombie Chromium child processes and handle termination signals
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/src/server.js"]
