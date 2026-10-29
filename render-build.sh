#!/usr/bin/env bash
# ==============================================================================
# Build script for Render (Node Native Environment fallback)
# ==============================================================================
set -o errexit

echo "==> Installing server dependencies..."
npm --prefix server install

echo "==> Installing client dependencies..."
npm --prefix client install

echo "==> Building frontend assets..."
npm --prefix client run build

echo "==> Running database migrations..."
npm --prefix server run db:migrate

echo "==> Installing Chrome binary for Puppeteer..."
npx puppeteer browsers install chrome || true

echo "==> Build complete!"
