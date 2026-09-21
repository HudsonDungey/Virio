# Virio executor VPS

This is a Virio executor/keeper, not an Ethereum validator. It watches the subscription manager,
submits due charge transactions, and earns the executor fee. It runs on Sepolia today and can use
mainnet later by changing only the environment file.

## Testnet deployment

1. Create an Ubuntu 24.04 VPS. Clone this repository to /opt/virio.
2. Run the root bootstrap:

    sudo /opt/virio/ops/executor-vps/install-vps.sh

3. Create the secret environment file. Use a dedicated executor wallet with only the native gas
   token it needs. Never use a treasury, deployer or Vultisig key.

    sudo cp /opt/virio/ops/executor-vps/executor.env.testnet.example /etc/virio-executor/executor.env
    sudo chown root:virio /etc/virio-executor/executor.env
    sudo chmod 640 /etc/virio-executor/executor.env
    sudoedit /etc/virio-executor/executor.env

   Set the RPC URL, subscription-manager address, deployment block and executor private key. Set
   the deployment block to the subscription-manager deployment block to avoid a full-chain scan.

4. Install dependencies and start the service:

    sudo -u virio /opt/virio/ops/executor-vps/deploy-executor.sh
    sudo systemctl restart virio-executor
    sudo systemctl enable --now virio-executor
    sudo journalctl -u virio-executor -f
    /opt/virio/ops/executor-vps/healthcheck.sh

## Mainnet switch

Do not copy a testnet key to mainnet. After security review and mainnet deployment, replace the
environment file with executor.env.mainnet.example, set the mainnet RPC, manager address and
deployment block, then restart:

    sudo systemctl restart virio-executor

Use a reliable authenticated RPC and a conservative confirmation count on mainnet.

## Operations

- Health endpoint: http://127.0.0.1:9464/health
- Logs: sudo journalctl -u virio-executor -f
- State: /var/lib/virio-executor/state.json. Stop the service before deleting this file; the next
  start rescans from VIRIO_DEPLOYMENT_BLOCK.
- The executor sends one charge transaction at a time and waits for its receipt, avoiding local
  nonce races. Another executor can still charge first; that expected error is logged and retried
  only after the next state read.
- The health endpoint is localhost-only. Add a monitored reverse proxy only if remote health checks
  are required.
