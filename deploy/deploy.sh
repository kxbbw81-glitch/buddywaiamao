#!/bin/bash
# ====================================
# NexFab AI CRM 一键部署脚本
# 适用于 Ubuntu/Debian/CentOS 系统
# ====================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${GREEN}=== NexFab AI CRM 部署工具 ===${NC}"
echo ""

# ---- 检查 Docker ----
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker 未安装，正在安装...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker 安装完成${NC}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose 未安装，正在安装...${NC}"
    apt-get update && apt-get install -y docker-compose-plugin 2>/dev/null || \
    yum install -y docker-compose-plugin 2>/dev/null || \
    echo -e "${YELLOW}请手动安装 docker-compose-plugin${NC}"
fi

echo -e "${GREEN}✓ Docker: $(docker --version)${NC}"
echo -e "${GREEN}✓ Compose: $(docker compose version)${NC}"
echo ""

# ---- 环境配置 ----
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${YELLOW}首次部署，从模板创建 .env${NC}"
    cp "$APP_DIR/.env.production" "$APP_DIR/.env"
    echo -e "${YELLOW}请编辑 $APP_DIR/.env 修改配置后重新运行${NC}"
    exit 0
fi

# ---- 构建并启动 ----
echo -e "${GREEN}正在构建并启动服务...${NC}"
cd "$APP_DIR"
docker compose up -d --build

echo ""
echo -e "${GREEN}=== 部署完成 ===${NC}"
echo "CRM 地址: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "常用命令:"
echo "  docker compose logs -f crm     # 查看日志"
echo "  docker compose restart crm       # 重启服务"
echo "  docker compose down               # 停止服务"
echo "  docker compose up -d --build     # 重新构建部署"
echo ""
echo -e "${YELLOW}如需域名+HTTPS，运行: docker compose --profile with-nginx up -d${NC}"
