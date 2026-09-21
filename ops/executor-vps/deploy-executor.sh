#!/usr/bin/env bash
set -euo pipefail
test "$(id -un)" = "virio" || { echo "Run as the virio user."; exit 1; }
cd /opt/virio
corepack yarn install --immutable
test -f /etc/virio-executor/executor.env || {
  echo "Create /etc/virio-executor/executor.env from executor.env.testnet.example first."
  exit 1
}
node --check ops/executor-vps/virio-executor.mjs
echo "Dependencies are ready. Restart with: sudo systemctl restart virio-executor"
