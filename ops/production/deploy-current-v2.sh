#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT=/opt/nexfab-ai-crm
ARCHIVE="${ARCHIVE:-$APP_ROOT/staging/nexfab-v2-current.tar.gz}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)-v2-current}"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
BACKUP_DIR="$APP_ROOT/backups/$RELEASE_ID"
ENV_FILE="$APP_ROOT/shared/v2-backend.env"
APP_USER=goodjob-crm
APP_HOME="/var/lib/$APP_USER"

if [ "$(id -u)" -ne 0 ]; then
  echo '必须以 root 执行部署。' >&2
  exit 1
fi
if [ ! -f "$ARCHIVE" ]; then
  echo "缺少发布包：$ARCHIVE" >&2
  exit 1
fi
if [ -e "$RELEASE_DIR" ]; then
  echo "发布目录已存在：$RELEASE_DIR" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR" "$APP_ROOT/releases" "$APP_ROOT/staging" "$APP_ROOT/shared/uploads"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_HOME"

printf '创建可回滚备份：%s\n' "$BACKUP_DIR"
readlink -f "$APP_ROOT/current" > "$BACKUP_DIR/previous-current-release.txt" 2>/dev/null || true
cp -a /etc/nginx/sites-enabled/goodjob-crm "$BACKUP_DIR/goodjob-crm.nginx.conf" 2>/dev/null || true
cp -a /etc/nginx/sites-enabled/nexfab-ai-crm "$BACKUP_DIR/nexfab-ai-crm.nginx.conf" 2>/dev/null || true
cp -a /etc/systemd/system/nexfab-ai-crm.service "$BACKUP_DIR/nexfab-ai-crm.service" 2>/dev/null || true
systemctl cat goodjob-crm.service > "$BACKUP_DIR/goodjob-crm.service.txt" 2>/dev/null || true
systemctl cat goodjob-crm-preview-148.service > "$BACKUP_DIR/goodjob-crm-preview-148.service.txt" 2>/dev/null || true
systemctl cat nexfab-frontend-preview.service > "$BACKUP_DIR/nexfab-frontend-preview.service.txt" 2>/dev/null || true
sudo -u postgres pg_dump --format=custom nexfab_v2 > "$BACKUP_DIR/nexfab_v2-before.dump"
sha256sum "$BACKUP_DIR/nexfab_v2-before.dump" > "$BACKUP_DIR/nexfab_v2-before.dump.sha256"
if mysql --protocol=socket -uroot -N -B -e "SHOW DATABASES LIKE 'goodjob_crm'" | grep -qx goodjob_crm; then
  mysqldump --protocol=socket --single-transaction --routines --events goodjob_crm | gzip -9 > "$BACKUP_DIR/goodjob_crm-before.sql.gz"
  sha256sum "$BACKUP_DIR/goodjob_crm-before.sql.gz" > "$BACKUP_DIR/goodjob_crm-before.sql.gz.sha256"
fi

if ! sudo -u postgres psql -d nexfab_v2 -Atqc "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'" | grep -qx 1; then
  apt-get update
  apt-get install -y postgresql-16-pgvector
fi

mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
chown -R "$APP_USER:$APP_USER" "$RELEASE_DIR"

touch "$ENV_FILE"
chmod 0600 "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"
if ! grep -q '^PII_ENCRYPTION_KEY=' "$ENV_FILE"; then
  printf 'PII_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
fi
if ! grep -q '^AI_ENABLED=' "$ENV_FILE"; then
  printf 'AI_ENABLED=false\n' >> "$ENV_FILE"
fi

set -a
. "$ENV_FILE"
set +a
if [ -z "${DATABASE_URL:-}" ] || [ -z "${SESSION_SECRET:-}" ] || [ -z "${PII_ENCRYPTION_KEY:-}" ]; then
  echo '运行环境缺少 DATABASE_URL、SESSION_SECRET 或 PII_ENCRYPTION_KEY。' >&2
  exit 1
fi

printf '安装后端依赖、生成 Prisma Client 并执行增量迁移。\n'
runuser -u "$APP_USER" -- env HOME="$APP_HOME" npm --prefix "$RELEASE_DIR/backend" ci --no-audit --no-fund
cd "$RELEASE_DIR/backend"
runuser -u "$APP_USER" -- env HOME="$APP_HOME" DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/prisma generate --schema prisma/schema.prisma
sudo -u postgres psql -d nexfab_v2 -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
runuser -u "$APP_USER" -- env HOME="$APP_HOME" DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

printf '执行 PII backfill dry-run 与应用。\n'
runuser -u "$APP_USER" -- env HOME="$APP_HOME" DATABASE_URL="$DATABASE_URL" PII_ENCRYPTION_KEY="$PII_ENCRYPTION_KEY" npm --prefix "$RELEASE_DIR/backend" run p0:pii-backfill
runuser -u "$APP_USER" -- env HOME="$APP_HOME" DATABASE_URL="$DATABASE_URL" PII_ENCRYPTION_KEY="$PII_ENCRYPTION_KEY" npm --prefix "$RELEASE_DIR/backend" run p0:pii-backfill -- --apply

printf '安装并构建 /new 前端。\n'
runuser -u "$APP_USER" -- env HOME="$APP_HOME" npm --prefix "$RELEASE_DIR/frontend" ci --no-audit --no-fund
runuser -u "$APP_USER" -- env HOME="$APP_HOME" NEXT_PUBLIC_BASE_PATH=/new NEXT_TELEMETRY_DISABLED=1 npm --prefix "$RELEASE_DIR/frontend" run build
mkdir -p "$RELEASE_DIR/frontend/.next/standalone/.next"
cp -a "$RELEASE_DIR/frontend/public" "$RELEASE_DIR/frontend/.next/standalone/"
cp -a "$RELEASE_DIR/frontend/.next/static" "$RELEASE_DIR/frontend/.next/standalone/.next/"
chown -R "$APP_USER:$APP_USER" "$RELEASE_DIR/frontend/.next" "$RELEASE_DIR/frontend/public"

install -m 0644 "$RELEASE_DIR/ops/production/nexfab-ai-crm.service" /etc/systemd/system/nexfab-ai-crm.service
install -m 0644 "$RELEASE_DIR/ops/production/nexfab-v2-frontend.service" /etc/systemd/system/nexfab-v2-frontend.service
install -m 0755 "$RELEASE_DIR/ops/production/nexfab-healthcheck.sh" /usr/local/lib/nexfab-healthcheck
install -m 0644 "$RELEASE_DIR/ops/production/nexfab-healthcheck.service" /etc/systemd/system/nexfab-healthcheck.service
install -m 0644 "$RELEASE_DIR/ops/production/nexfab-healthcheck.timer" /etc/systemd/system/nexfab-healthcheck.timer
install -m 0644 "$RELEASE_DIR/ops/production/nexfab-v2-root.nginx.conf" /etc/nginx/sites-available/nexfab-v2-root
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

mkdir -p "$BACKUP_DIR/retired-nginx"
for old_config in goodjob-crm nexfab-ai-crm; do
  if [ -e "/etc/nginx/sites-enabled/$old_config" ]; then
    mv "/etc/nginx/sites-enabled/$old_config" "$BACKUP_DIR/retired-nginx/$old_config"
  fi
done
ln -sfn /etc/nginx/sites-available/nexfab-v2-root /etc/nginx/sites-enabled/nexfab-v2-root
nginx -t

printf '停止已作废的根站与预览服务；保留 goodjob-crm-original。\n'
systemctl disable --now goodjob-crm goodjob-crm-preview-148 nexfab-frontend-preview goodjob-crm-new 2>/dev/null || true
for pid in $(pgrep -f 'next-server' || true); do
  if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = '/opt/nexfab-ai-crm-app' ]; then
    kill "$pid" || true
  fi
done

systemctl daemon-reload
systemctl enable --now nexfab-ai-crm nexfab-v2-frontend nexfab-healthcheck.timer
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4300/ready > "$BACKUP_DIR/backend-ready.json" && curl -fsS http://127.0.0.1:4302/new/ > "$BACKUP_DIR/frontend.html"; then
    break
  fi
  sleep 1
  if [ "$attempt" = 30 ]; then
    echo '新版本启动健康检查失败；未重新加载 Nginx，可用备份配置和 previous-current-release 回滚。' >&2
    exit 1
  fi
done
systemctl reload nginx

curl -fsS http://127.0.0.1/new/api/backend/ready > "$BACKUP_DIR/public-ready.json"
curl -fsSI http://127.0.0.1/ > "$BACKUP_DIR/root-headers.txt"
curl -fsSI http://127.0.0.1/original/ > "$BACKUP_DIR/original-headers.txt"
printf 'DEPLOYED release=%s backup=%s\n' "$RELEASE_ID" "$BACKUP_DIR"
