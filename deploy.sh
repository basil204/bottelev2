#!/bin/bash
set -euo pipefail

# Deploy script cho Telegram Bot + Webapps
# Chạy: chmod +x deploy.sh && ./deploy.sh

echo "🚀 Starting deployment..."

# Đường dẫn project
PROJECT_DIR=~/botteleandweb

# 1. Cài dependencies
echo "📦 Installing dependencies..."
cd $PROJECT_DIR && npm install
cd $PROJECT_DIR/webapp && npm install
cd $PROJECT_DIR/email-edu-web && npm install

# 2. Dừng web trước khi build. Next.js ghi đè .next trong lúc build; nếu tiến
# trình cũ vẫn chạy, HTML và static chunks sẽ lệch phiên bản và gây lỗi 500.
echo "⏹️ Stopping web processes before build..."
pm2 stop webapp email-edu-web 2>/dev/null || true

# 3. Build webapps
echo "🔨 Building webapps..."
cd $PROJECT_DIR/webapp && npm run build
cd $PROJECT_DIR/email-edu-web && npm run build

# 4. Stop old PM2 processes (if exist)
echo "⏹️ Stopping old processes..."
pm2 delete telegram-bot webapp email-edu-web 2>/dev/null || true

# 5. Start PM2 processes
echo "▶️ Starting PM2 processes..."
cd $PROJECT_DIR

# Bot - port 3000 (nội bộ)
pm2 start main.js --name "telegram-bot"

# Webapp - port 8692
pm2 start npm --name "webapp" --cwd $PROJECT_DIR/webapp -- run start

# Email EDU Web - port 3000
pm2 start npm --name "email-edu-web" --cwd $PROJECT_DIR/email-edu-web -- run start

# 6. Save và setup startup
echo "💾 Saving PM2 config..."
pm2 save

echo "🔄 Setting up auto-start on reboot..."
pm2 startup

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Useful commands:"
echo "  pm2 logs          - Xem logs tất cả"
echo "  pm2 logs webapp   - Xem logs webapp"
echo "  pm2 restart all   - Restart tất cả"
echo "  pm2 monit         - Monitor realtime"
