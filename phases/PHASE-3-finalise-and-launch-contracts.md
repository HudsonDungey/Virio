# Phase 3 — Security and Base Genesis

## Security gate

- [ ] Complete the professional review of the payment protocol.
- [ ] Remediate findings and obtain a fix review where appropriate.
- [ ] Publish scope, findings, remediation and audit status.
- [ ] Keep Virio payment contracts labelled testnet/beta until this gate is complete.

## Base deployment

- [ ] Deploy VIRIO once on Base; confirm exactly 1B supply and zero bridge limits.
- [ ] Deploy independent allocation custody, treasury timelock and vesting contracts for the published schedules.
- [ ] Verify source, ownership and allocation funding on BaseScan.
- [ ] Publish token, treasury, vesting, safety and liquidity addresses.
- [ ] Configure transparent protocol-controlled liquidity, bounded by GENESIS_LP_TOKEN_AMOUNT and GENESIS_LP_QUOTE_AMOUNT.
- [ ] Keep fee distribution and buyback gates disabled pending legal/security approval.

## Future expansion

Arbitrum, Ethereum and further EVM support require a separately approved deployment, bridge-limit configuration, security review and public transparency update. No additional chain is a genesis requirement.
