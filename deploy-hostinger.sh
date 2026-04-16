#!/usr/bin/env bash
# Deploy Aavis Decor backend to Hostinger VPS
# Usage: ./deploy-hostinger.sh <user> <host> <port>
# Example: ./deploy-hostinger.sh u123456789 145.x.x.x 22

set -e

SSH_USER="${1:?Usage: $0 <user> <host> [port]}"
SSH_HOST="${2:?Usage: $0 <user> <host> [port]}"
SSH_PORT="${3:-22}"
REMOTE_DIR="~/domains/aavisdecor.com/nodejs"
PKG=/tmp/aavis-backend.tar.gz

echo "=== Building backend ==="
cd server
npm run build
tar -czf "$PKG" dist/ drizzle/ package.json package-lock.json server.js
cd ..
echo "Package: $(du -sh $PKG | cut -f1)"

echo ""
echo "=== Uploading to $SSH_USER@$SSH_HOST:$REMOTE_DIR ==="
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "mkdir -p $REMOTE_DIR"
scp -P "$SSH_PORT" "$PKG" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/backend.tar.gz"
scp -P "$SSH_PORT" server/.env.hostinger "$SSH_USER@$SSH_HOST:$REMOTE_DIR/.env"

echo ""
echo "=== Installing dependencies on server ==="
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "
  cd $REMOTE_DIR
  tar -xzf backend.tar.gz
  rm backend.tar.gz
  npm ci --omit=dev
  echo 'Install complete'
"

echo ""
echo "=== Starting / restarting PM2 ==="
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "
  cd $REMOTE_DIR
  # Install PM2 globally if not present
  command -v pm2 || npm install -g pm2
  pm2 describe aavis-api > /dev/null 2>&1 \
    && pm2 restart aavis-api \
    || pm2 start server.js --name aavis-api
  pm2 save
"

echo ""
echo "=== Testing health endpoint ==="
echo "Run: curl https://aavisdecor.com/api/health"
echo ""
echo "DONE. Next step: configure Nginx to proxy /api and /media to port 3001."
echo "See server/VPS_RUNBOOK.md section 3 for Nginx config."
