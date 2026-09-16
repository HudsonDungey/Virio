# VIRIO Tokenomics

VIRIO is the coordination and utility asset for the Virio programmable-payments ecosystem. It is not an equity offering, a substitute for a financing round, or a promise of price appreciation or returns.

Virio is being built and launched in public. The VIRIO genesis is designed to bootstrap a Base-based network and community; Virio's recurring-payment protocol remains testnet/beta until professional security review is complete.

## Fixed maximum supply

The maximum supply is **1,000,000,000 VIRIO**, minted once on **Base**. xERC20-compatible code is retained for later expansion, but bridges and other genesis markets are not configured at launch.

| Bucket | % | VIRIO | Release / custody |
|---|---:|---:|---|
| Community Ecosystem | 30% | 300M | Participation-earned, linear over 60 months |
| Protocol Treasury | 25% | 250M | Protocol multisig + 48-hour timelock |
| Early Community / Airdrop | 10% | 100M | 10M genesis claim; 90M streams M3–M24 |
| Team & Future Hires | 8% | 80M | 12-month cliff + 36-month linear |
| Founder | 7% | 70M | 6-month cliff + 30-month linear |
| Strategic Ecosystem Reserve | 5% | 50M | Timelocked integrations, infrastructure partners and contributors |
| Safety Module | 5% | 50M | Reserved and undeployed at genesis |
| Protocol Launch Liquidity | 5% | 50M | Maximum long-term allocation; not all need enter genesis liquidity |
| Launch / Network Incentives | 3% | 30M | Verified launch/testnet contributions at genesis |
| Advisors | 2% | 20M | 6-month cliff + 24-month linear |

The allocation totals exactly 1,000,000,000 VIRIO. The Protocol Treasury is not founder property. Founder tokens are fully locked at launch: **zero founder VIRIO is liquid at TGE**. A founder may independently make personal financing decisions using legitimately vested holdings; that is neither a protocol commitment nor a token-holder entitlement.

## Circulation schedule

“Circulating” excludes locked treasury, team, founder, advisor, strategic reserve, Safety Module, and undeployed liquidity. It also excludes unearned community emissions. Amounts are calculated by GenesisTokenomics.circulatingAt, using 30-day months.

| Time | Circulating VIRIO | % of maximum |
|---|---:|---:|
| TGE | 100.0M | 10.00% |
| Month 6 | 141.9M | 14.19% |
| Month 12 | 215.6M | 21.56% |
| Month 24 | 389.7M | 38.97% |
| Month 36 | 507.3M | 50.73% |
| Month 48 | 592.0M | 59.20% |
| Month 60 | 650.0M | 65.00% |

The published schedule assumes 50M VIRIO deployed into the Base genesis pool: 10M is the small early-community genesis claim, 30M rewards verified launch/testnet contribution, and 10M rewards verified pre-genesis ecosystem contribution. If less LP is deployed, the circulating-supply calculation reduces by the difference; the actual configuration must be published. The remaining early-community and ecosystem allocations are earned progressively for useful activity such as execution, merchant and SDK integrations, developer and security work, infrastructure, bug reports, and sustained protocol participation.

## Genesis liquidity

Protocol Launch Liquidity is an allocation ceiling, not an instruction to deploy all 50M VIRIO. The launch process records GENESIS_LP_TOKEN_AMOUNT and GENESIS_LP_QUOTE_AMOUNT.

Those inputs are selected immediately before launch, bounded by the 50M allocation, and must be publicly reported. The initial pool only establishes starting market mechanics; subsequent market activity establishes price. Liquidity is protocol-controlled through disclosed multisig, timelock and on-chain visibility rather than being burned permanently.

## Airdrop and anti-farming

The early-community allocation combines a small genesis claim with a long-duration, participation-based stream. Eligibility is assessed with sybil-resistance controls, contribution quality, rate limits, cohort analysis and anti-farming review. Cheap, manufactured activity must not qualify as meaningful participation. See [airdrop documentation](airdrop/README.md).

## Protocol economics and security review

Virio can model protocol usage (subscriptions, payment volume, charges, executor fees and treasury revenue) for product planning. Those are **protocol scenarios**, not token-price forecasts or return projections.

### How protocol fees relate to VIRIO

Virio payment activity is denominated in stablecoins such as USDC. Successful recurring charges produce observable protocol-fee records and transparent treasury accounting. At genesis, fee distribution and acquisition mechanisms are disabled, so payment volume does not automatically flow to VIRIO holders or create a token-price outcome.

VIRIO is intended to coordinate concrete network roles rather than sit in the payment path: ecosystem incentives for useful contributions, potential future executor stake/reputation/security, optional merchant participation benefits and governance. Protocol adoption can make these roles more relevant, but it does not guarantee liquidity, demand or price appreciation. Market participants establish VIRIO's price independently.

The current FeeDistributor and staking contracts contain proposed technical mechanisms for fee-token distribution, transferable stVIRIO and a Safety Module acquisition path. They are **disabled at genesis**:

SECURITY_REVIEW_REQUIRED = true
FEE_DISTRIBUTION_ENABLED = false
PROTOCOL_BUYBACK_ENABLED = false

Activation requires security review and the applicable timelocked governance action. A future Safety Module acquisition mechanism, if approved, may acquire VIRIO for protocol security/reserve purposes; it is not an assertion of market support.

## Utility and roadmap

Merchants can integrate Virio, use the SDK and accept recurring USDC payments without purchasing VIRIO. Potential VIRIO utility includes sustainably configured merchant fee discounts, governance, ecosystem incentives and future executor security. A future executor model may require stake for eligibility, build reputation and apply carefully designed penalties for malicious behavior; it is not genesis functionality.

Roadmap: **Base genesis → community/network bootstrap → protocol completion and professional audit → remediation and independent review → Virio mainnet → demand-led EVM expansion** (Base → Arbitrum → Ethereum → additional networks).

## Transparency and deployment status

No production VIRIO deployment is recorded in this repository. The only broadcast artifacts are local and Sepolia protocol-test deployments, not a VIRIO mainnet launch. The new allocation requires a fresh Base deployment plus allocation custody, timelock and vesting contracts; immutable values in any already deployed contract cannot be retroactively changed. A public transparency surface should publish token, treasury, vesting and liquidity addresses, supply, emissions, grants, major expenditure, protocol status, audit status and governance status once deployed.
