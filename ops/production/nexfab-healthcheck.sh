#!/usr/bin/env bash
set -Eeuo pipefail

backend_url="${NEXFAB_BACKEND_READY_URL:-http://127.0.0.1:4300/ready}"
for unit in redis-server nexfab-ai-crm nexfab-v2-frontend nginx; do
  systemctl is-active --quiet "$unit"
done

ready="$(curl --fail --silent --show-error --max-time 10 "$backend_url")"
printf '%s' "$ready" | grep -q '"ready":true'
printf '%s' "$ready" | grep -q '"backend":"bullmq-redis"'
printf '%s' "$ready" | grep -q '"productionReady":true'
redis-cli --raw ping | grep -qx 'PONG'

printf 'NexFab health check passed at %s\n' "$(date -Is)"
