"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Coins, Globe2, Lock, Network, Shield, Users, Wrench } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";

const allocations = [
  ["Community Ecosystem", "30%", "300M", "Earned over 60 months through useful participation"],
  ["Protocol Treasury", "25%", "250M", "Multisig custody and 48-hour timelock"],
  ["Early Community / Airdrop", "10%", "100M", "10M genesis claim; participation stream through M24"],
  ["Team & Future Hires", "8%", "80M", "12-month cliff, then 36-month linear vesting"],
  ["Founder", "7%", "70M", "6-month cliff, then 30-month linear vesting"],
  ["Strategic Ecosystem Reserve", "5%", "50M", "Timelocked ecosystem integrations and contributors"],
  ["Safety Module", "5%", "50M", "Reserved; not deployed or circulating at genesis"],
  ["Protocol Launch Liquidity", "5%", "50M", "Maximum allocation; only a configured portion enters the genesis pool"],
  ["Launch / Network Incentives", "3%", "30M", "Verified launch/testnet contributions at genesis"],
  ["Advisors", "2%", "20M", "6-month cliff, then 24-month linear vesting"],
] as const;

const unlocks = [
  ["TGE", "100.0M", "10.00%"], ["Month 6", "141.9M", "14.19%"],
  ["Month 12", "215.6M", "21.56%"], ["Month 24", "389.7M", "38.97%"],
  ["Month 36", "507.3M", "50.73%"], ["Month 48", "592.0M", "59.20%"],
  ["Month 60", "650.0M", "65.00%"],
] as const;

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>;
}

export function VirioTokenView() {
  return (
    <main className="overflow-hidden bg-background pb-24 text-foreground">
      <section className="border-b border-border bg-[radial-gradient(circle_at_top,rgba(43,190,145,.14),transparent_42%)] px-5 pb-20 pt-32 sm:px-8">
        <Reveal className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-virio-emerald">$VIRIO</p>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-5xl font-semibold tracking-tight sm:text-7xl">The coordination layer for programmable payments.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">VIRIO coordinates participation across the Virio ecosystem — merchants, executors, developers, governance and protocol security. Fixed maximum supply: 1,000,000,000.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#tokenomics" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-virio-emerald px-5 font-semibold text-virio-emerald-ink">Explore tokenomics <ArrowRight className="h-4 w-4" /></a>
            <Link href="/docs" className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-5 font-semibold">Explore Virio Protocol</Link>
          </div>
          <p className="mt-6 text-sm text-amber-500">VIRIO Token — planned live on Base. Virio recurring-payment protocol — testnet/beta until professional security review is complete.</p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="What VIRIO does" title={<>Participation for a <span className="text-virio-emerald">useful network.</span></>} description="Payments remain denominated in stablecoins such as USDC. VIRIO enhances participation; it is never required to integrate Virio or accept recurring payments." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[[Building2, "Merchant participation", "Potential fee discounts and higher usage tiers, subject to sustainable parameters."], [Network, "Executor security", "A future stake, reputation and penalty model for permissionless execution."], [Users, "Governance", "A coordination mechanism for protocol decisions as governance matures."], [Globe2, "Ecosystem incentives", "Rewards for integrations, infrastructure, security and meaningful contribution."]].map(([Icon, title, text]) => <Card key={title as string}><Icon className="h-5 w-5 text-virio-emerald" /><h3 className="mt-5 font-display text-lg font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text as string}</p></Card>)}
        </div>
      </section>

      <section id="tokenomics" className="border-y border-border bg-secondary/30 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Allocation" title={<>Fixed supply, <span className="text-virio-emerald">aligned with the network.</span></>} description="75% is allocated to community, protocol, safety, liquidity and network incentives. Strategic Ecosystem Reserve is for useful ecosystem participation, not a planned private round." />
          <div className="mt-10 overflow-hidden rounded-2xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-card text-muted-foreground"><tr><th className="p-4">Bucket</th><th className="p-4">Allocation</th><th className="p-4">VIRIO</th><th className="hidden p-4 sm:table-cell">Release / custody</th></tr></thead><tbody>{allocations.map(([name,pct,tokens,vesting]) => <tr key={name} className="border-t border-border bg-background"><td className="p-4 font-medium">{name}</td><td className="p-4 text-virio-emerald">{pct}</td><td className="p-4">{tokens}</td><td className="hidden p-4 text-muted-foreground sm:table-cell">{vesting}</td></tr>)}</tbody></table></div>
          <p className="mt-5 flex items-center gap-2 text-sm font-medium"><Lock className="h-4 w-4 text-virio-emerald" />0 founder tokens liquid at genesis.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8"><SectionHeading eyebrow="Unlocks" title={<>Circulation follows <span className="text-virio-emerald">earned participation.</span></>} description="Circulating supply excludes locked treasury, team, founder, advisor, safety and undeployed liquidity reserves. Values are derived from the published schedule." />
        <div className="mt-10 grid gap-4 md:grid-cols-7">{unlocks.map(([time, amount, pct]) => <Card key={time}><p className="text-xs uppercase tracking-wider text-muted-foreground">{time}</p><p className="mt-3 font-display text-2xl font-semibold">{amount}</p><p className="mt-1 text-sm text-virio-emerald">{pct} circulating</p></Card>)}</div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">The published 10% TGE schedule assumes 50M VIRIO in the genesis pool, a small 10M early-community claim, 30M verified launch/testnet rewards and 10M verified ecosystem rewards. Early community then streams through month 24. Eligibility incorporates sybil resistance, contribution quality, rate limits and anti-farming review; manufactured low-value activity is not a reward criterion.</p>
      </section>

      <section className="border-y border-border bg-secondary/30 px-5 py-20 sm:px-8"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Genesis" title={<>One Base launch. <span className="text-virio-emerald">One canonical market.</span></>} description="VIRIO launches on Base first. xERC20-compatible architecture is retained for future expansion when real Virio usage supports it: Base → Arbitrum → Ethereum → additional EVM networks based on demand." />
        <div className="mt-10 grid gap-4 md:grid-cols-3"><Card><Coins className="h-5 w-5 text-virio-emerald" /><h3 className="mt-4 font-semibold">Liquidity mechanics</h3><p className="mt-2 text-sm text-muted-foreground">Protocol Launch Liquidity is a 50M maximum allocation. <code>GENESIS_LP_TOKEN_AMOUNT</code> and <code>GENESIS_LP_QUOTE_AMOUNT</code> determine what actually enters the initial pool. The pool starts market mechanics; the market determines price.</p></Card><Card><Shield className="h-5 w-5 text-virio-emerald" /><h3 className="mt-4 font-semibold">Controlled transparently</h3><p className="mt-2 text-sm text-muted-foreground">Liquidity remains protocol-controlled through multisig, on-chain visibility and timelock controls — not permanently burned. Contract, treasury and vesting addresses will be listed after deployment.</p></Card><Card><CheckCircle2 className="h-5 w-5 text-virio-emerald" /><h3 className="mt-4 font-semibold">Supply verification</h3><p className="mt-2 text-sm text-muted-foreground">The maximum supply is minted once on Base. Bridge limits are zero at genesis; no unsupported chain can receive genesis minting.</p></Card></div>
      </div></section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8"><SectionHeading eyebrow="Virio Network" title="Stablecoin payments, separate from token coordination." description="Customer → Virio authorization → recurring USDC charge → executor → merchant. VIRIO supports network participation, security, governance and incentives; it does not replace the payment asset." />
        <div className="mt-10 grid gap-4 md:grid-cols-2"><Card><h3 className="font-semibold">Genesis functionality</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Base token, community bootstrap, executor testnet and SDK integrations. Merchants can integrate and accept USDC recurring payments without acquiring VIRIO.</p></Card><Card><h3 className="font-semibold">Post-mainnet direction</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">After audit and launch, an executor staking and reputation model may make staked VIRIO a condition for execution opportunities, with carefully designed penalties where technically appropriate.</p></Card></div>
      </section>

      <section className="border-y border-border bg-secondary/30 px-5 py-20 sm:px-8"><div className="mx-auto max-w-6xl"><SectionHeading eyebrow="Network economics" title="Mechanisms need security approval." description="Protocol scenarios can model subscriptions, payment volume, charges and fees. They are operational planning tools, not token-price or return projections." />
        <Card><div className="flex items-start gap-3"><Wrench className="mt-1 h-5 w-5 shrink-0 text-amber-500" /><div><h3 className="font-semibold">Disabled at genesis — SECURITY_REVIEW_REQUIRED</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">The implemented fee distributor and buyback paths are disabled at genesis. Any activation of fee-token distributions to stVIRIO, transferable stVIRIO, protocol-funded VIRIO acquisition, merchant staking discounts or governance rights requires security review and the applicable timelocked governance decision.</p></div></div></Card>
      </div></section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8"><SectionHeading eyebrow="Roadmap" title="Build in public, then expand with evidence." description="No audit or mainnet milestone is conditional on a VIRIO price." />
        <div className="mt-10 grid gap-4 md:grid-cols-4">{[["Genesis", "Base launch, community distribution, executor testnet, SDK integrations"],["Security", "Protocol completion, professional audit, remediation, independent review"],["Mainnet", "Recurring payments, merchant onboarding, executor network"],["Expansion", "Additional EVM networks, governance maturation, developer ecosystem"]].map(([title,body]) => <Card key={title}><p className="font-display text-xl font-semibold">{title}</p><p className="mt-3 text-sm text-muted-foreground">{body}</p></Card>)}</div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-4 text-center sm:px-8"><p className="text-sm text-muted-foreground">Virio is being developed in public. The protocol remains testnet/beta until professional security reviews are complete. Founder holdings are separate from the protocol treasury; any personal financing decision involving legitimately vested holdings is not a token-holder entitlement or protocol promise.</p></section>
    </main>
  );
}
