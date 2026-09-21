#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" -eq 0 || { echo "Run with sudo."; exit 1; }
test -d /opt/virio || { echo "/opt/virio is required."; exit 1; }

apt-get update
apt-get install -y ca-certificates curl jq
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
corepack enable
id -u virio >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin virio
install -d -o virio -g virio -m 0700 /var/lib/virio-executor
install -d -o root -g virio -m 0750 /etc/virio-executor
install -m 0644 /opt/virio/ops/executor-vps/virio-executor.service /etc/systemd/system/virio-executor.service
systemctl daemon-reload
echo "Installed. Create /etc/virio-executor/executor.env, then run deploy-executor.sh."
