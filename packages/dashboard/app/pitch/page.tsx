import type { Metadata } from "next";
import s from "./pitch.module.css";

export const metadata: Metadata = {
  title: "Virio — One-Page Pitch",
  description:
    "Recurring payments for programmable money. Wallet-native subscriptions, automated payroll, and stablecoin settlement.",
};

export default function PitchPage() {
  return (
    <div className={s.stage}>
      <article className={s.page}>

        {/* HEADER */}
        <header className={s.header}>
          <div className={s.logo}>
            <svg className={s.logoMark} viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 4 A12 12 0 1 1 4 16" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" fill="none" />
              <circle cx="16" cy="4" r="2.6" fill="#0A0A0A" />
            </svg>
            <span>
              <span className={s.logoText}>virio</span>
              <span className={s.logoSub}>onchain billing infrastructure</span>
            </span>
          </div>
          <div className={s.headerMeta}>
            <span className={s.pill}>
              <span className={s.dot} />
              live on testnet
            </span>
            <span className={s.mono} style={{ fontSize: "10.5px", letterSpacing: "0.08em", color: "var(--fg-soft)" }}>
              PITCH · v2.4 · 2026
            </span>
          </div>
        </header>

        {/* HERO */}
        <section className={s.hero}>
          <div className={s.heroInner}>
            <div>
              <span className={s.eyebrow}>the one-pager</span>
              <h1 className={s.h1}>
                recurring payments for{" "}
                <span className={s.accent}>programmable money</span>.
              </h1>
              <p className={s.lede}>
                virio is the billing stack for the onchain economy — wallet-native subscriptions, automated payroll,
                and stablecoin settlement. customers approve once, executors run forever, money moves on schedule.
              </p>
            </div>
            <div className={s.statGrid}>
              <div className={s.stat}>
                <div className={s.statK}>0<span className={s.statUnit}>/mo</span></div>
                <div className={s.statL}>platform fee. you only pay when you get paid.</div>
              </div>
              <div className={s.stat}>
                <div className={s.statK}>$1.35</div>
                <div className={s.statL}>total settlement cost on a $100 charge.</div>
              </div>
              <div className={s.stat}>
                <div className={s.statK}>99.99<span className={s.statUnit}>%</span></div>
                <div className={s.statL}>executor network uptime across EVM chains.</div>
              </div>
              <div className={s.stat}>
                <div className={s.statK}>1<span className={s.statUnit}>sig</span></div>
                <div className={s.statL}>user signs once. every renewal runs autonomously.</div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM / SOLUTION */}
        <section className={s.pad}>
          <div className={s.twocol}>
            <div>
              <span className={s.eyebrow}>the problem</span>
              <h2 className={s.blockTitle}>recurring revenue doesn&apos;t work onchain.</h2>
              <p className={s.blockBody}>
                stablecoins move at internet speed, but the billing layer is still stuck in 2010 — invoices,
                manual re-signing, chargeback risk, and a stripe bill on top of every gas fee.
              </p>
              <ul className={s.painList}>
                <li><span className={s.x}>✕</span><span>customers must re-sign every renewal — churn by friction.</span></li>
                <li><span className={s.x}>✕</span><span>payroll runs need cron jobs, custody risk, and a treasurer awake at 9am UTC.</span></li>
                <li><span className={s.x}>✕</span><span>card rails don&apos;t understand wallets, USDC, or multi-chain settlement.</span></li>
                <li><span className={s.x}>✕</span><span>opaque platform fees stack on top of opaque gas.</span></li>
              </ul>
            </div>
            <div>
              <span className={s.eyebrow}>the solution</span>
              <h2 className={s.blockTitle}>one programmable primitive for every recurring charge.</h2>
              <p className={s.blockBody}>
                subscriptions and payroll collapse into the same onchain execution model: a single approval,
                a permissionless executor network, and a verifiable settlement at every cycle.
              </p>
              <ul className={s.painList}>
                <li><span className={s.check}>✓</span><span>customer approves once — contracts enforce the rest forever.</span></li>
                <li><span className={s.check}>✓</span><span>executors handle scheduling, retries, fee splits, and payouts.</span></li>
                <li><span className={s.check}>✓</span><span>native USDC + stablecoin support across every major EVM chain.</span></li>
                <li><span className={s.check}>✓</span><span>every fee, refund, and split is visible and verifiable onchain.</span></li>
              </ul>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className={`${s.benefits} ${s.pad}`}>
          <div className={s.benefitsHeader}>
            <div>
              <span className={s.eyebrow}>benefits</span>
              <h2 className={s.blockTitle} style={{ fontSize: "26px" }}>
                everything you need to bill onchain — in one stack.
              </h2>
            </div>
            <p className={s.blockBody} style={{ margin: 0, maxWidth: "340px" }}>
              a single SDK for products, plans, payroll, webhooks and analytics.
              integration in an afternoon, not a quarter.
            </p>
          </div>

          <div className={s.benefitGrid}>
            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                  <path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <div className={s.bTitle}>recurring subscriptions</div>
              <div className={s.bBody}>monthly, yearly, or any custom interval. spend caps, auto-cancel rules, metered usage — all enforced by code.</div>
              <div className={s.bTag}>+ stops churn from re-signing</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1" />
                  <path d="M22 11h-5a2 2 0 0 0 0 4h5" />
                  <path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
                </svg>
              </div>
              <div className={s.bTitle}>automated payroll</div>
              <div className={s.bBody}>store recipients onchain, schedule runs, pay contractors and employees in stablecoins on autopilot — no custody.</div>
              <div className={s.bTag}>+ pays 1 or 10,000 on schedule</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" />
                  <circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
                  <path d="M7 7l3 3" /><path d="M17 7l-3 3" /><path d="M7 17l3-3" /><path d="M17 17l-3-3" />
                </svg>
              </div>
              <div className={s.bTitle}>executor network</div>
              <div className={s.bBody}>a permissionless network of executors triggers settlement and earns rewards. no cron jobs, no servers to babysit.</div>
              <div className={s.bTag}>+ 99.99% verifiable uptime</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div className={s.bTitle}>developer SDKs</div>
              <div className={s.bBody}>typed SDKs for typescript, react, and solidity. webhooks, idempotency, fixtures, sandbox — drop-in by design.</div>
              <div className={s.bTag}>+ live in an afternoon</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <rect x="7" y="13" width="3" height="5" />
                  <rect x="12" y="9" width="3" height="9" />
                  <rect x="17" y="6" width="3" height="12" />
                </svg>
              </div>
              <div className={s.bTitle}>real-time analytics</div>
              <div className={s.bBody}>MRR, churn, payroll volume, failed settlements, protocol fees — streamed live to your dashboard and webhook bus.</div>
              <div className={s.bTag}>+ no warehouse glue required</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                  <path d="M12 3a14 14 0 0 1 0 18" />
                  <path d="M12 3a14 14 0 0 0 0 18" />
                </svg>
              </div>
              <div className={s.bTitle}>multi-chain</div>
              <div className={s.bBody}>deploy once, settle across every major EVM chain. one integration, one API, one dashboard — no per-chain forks.</div>
              <div className={s.bTag}>+ 8 chains supported, more shipping</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 9h6v6H9z" />
                </svg>
              </div>
              <div className={s.bTitle}>stablecoin native</div>
              <div className={s.bBody}>first-class support for USDC, USDT, DAI and emerging stablecoins. transparent, onchain-verifiable settlement.</div>
              <div className={s.bTag}>+ no FX leg, no waiting</div>
            </div>

            <div className={s.benefit}>
              <div className={s.bIcon}>
                <svg className={s.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
                </svg>
              </div>
              <div className={s.bTitle}>programmable billing</div>
              <div className={s.bBody}>webhooks, spend caps, dunning, refunds, metered events — billing logic that lives in your codebase, not a vendor&apos;s UI.</div>
              <div className={s.bTag}>+ rules ship with your repo</div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={s.pad}>
          <span className={s.eyebrow}>how it works</span>
          <h2 className={s.blockTitle} style={{ fontSize: "26px" }}>
            three steps from integration to settlement.
          </h2>
          <p className={s.blockBody} style={{ maxWidth: "560px" }}>
            subscriptions and payroll share the same primitive. once it&apos;s live, money moves on schedule — verifiably, without you.
          </p>
          <div className={s.steps}>
            <div className={s.step}>
              <div className={s.stepN}>01</div>
              <div className={s.stepTitle}>create a product or payroll</div>
              <div className={s.stepBody}>define a plan or schedule. set the token, interval, spend caps, and webhook endpoints — from the dashboard or SDK.</div>
              <div className={s.code}>
                <span className={s.codeArr}>→</span>
                <span>virio.products.create({"{ price: 49, interval: 'month' }"})</span>
              </div>
            </div>
            <div className={s.step}>
              <div className={s.stepN}>02</div>
              <div className={s.stepTitle}>user approves once</div>
              <div className={s.stepBody}>customer signs a single onchain approval. no re-signing every cycle — the agreement is enforced by the contracts themselves.</div>
              <div className={s.code}>
                <span className={s.codeArr}>→</span>
                <span>await virio.subscriptions.subscribe(planId)</span>
              </div>
            </div>
            <div className={s.step}>
              <div className={s.stepN}>03</div>
              <div className={s.stepTitle}>executors settle on schedule</div>
              <div className={s.stepBody}>the executor network triggers every charge and payroll run, splits fees onchain, and settles directly to your wallet.</div>
              <div className={s.code}>
                <span className={s.codeArr}>→</span>
                <span>executor.run() → settle() → payout()</span>
              </div>
            </div>
          </div>
        </section>

        {/* WHO + PRICING */}
        <section className={s.whoPricing}>
          <div className={s.who}>
            <span className={s.eyebrow}>built for</span>
            <h2 className={s.blockTitle} style={{ fontSize: "22px" }}>
              teams replacing cards with crypto.
            </h2>
            <p className={s.blockBody}>
              if you charge users every month or pay people every week — and the money is already onchain — virio is for you.
            </p>
            <div className={s.whoGrid}>
              <div className={s.seg}>
                <div className={s.segH}>saas &amp; api businesses <span className={s.badge}>subs</span></div>
                <div className={s.segBody}>crypto-native saas, ai agents, and developer APIs that need MRR without card rails.</div>
              </div>
              <div className={s.seg}>
                <div className={s.segH}>DAOs &amp; protocols <span className={s.badge}>payroll</span></div>
                <div className={s.segBody}>treasury-driven orgs paying contributors, grants, and vendors on a recurring schedule.</div>
              </div>
              <div className={s.seg}>
                <div className={s.segH}>consumer apps <span className={s.badge}>subs</span></div>
                <div className={s.segBody}>wallet-first products selling premium tiers, memberships, or content unlocks.</div>
              </div>
              <div className={s.seg}>
                <div className={s.segH}>global teams <span className={s.badge}>payroll</span></div>
                <div className={s.segBody}>distributed teams paying contractors in stablecoins across borders, weekly or monthly.</div>
              </div>
            </div>
          </div>

          <div className={s.pricing}>
            <span className={s.eyebrow}>pricing</span>
            <h2 className={s.blockTitle} style={{ fontSize: "22px" }}>
              you only pay when you get paid.
            </h2>
            <p className={s.blockBody}>
              no monthly platform fees, no minimums, no contracts. every fee is split onchain and visible to your accountant.
            </p>
            <div className={s.feeCard}>
              <div className={s.feeRow}>
                <span className={s.feeL}>customer pays</span>
                <span className={s.feeV} style={{ color: "var(--fg)" }}>$100.00</span>
              </div>
              <div className={s.feeRow}>
                <span className={s.feeL}>flat fee · per settlement</span>
                <span className={s.feeV}>−$1.00</span>
              </div>
              <div className={s.feeRow}>
                <span className={s.feeL}>protocol fee · 0.25%</span>
                <span className={s.feeV}>−$0.25</span>
              </div>
              <div className={s.feeRow}>
                <span className={s.feeL}>executor fee · 0.10%</span>
                <span className={s.feeV}>−$0.10</span>
              </div>
              <div className={`${s.feeRow} ${s.feeNet}`}>
                <span className={s.feeL}>net to your wallet</span>
                <span className={s.feeV}>$98.65</span>
              </div>
            </div>
            <p className={s.pricingNote}>
              settled instantly. onchain-verifiable. enterprise plans available with volume discounts,
              dedicated executors, and SLAs.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className={s.cta}>
          <div>
            <span className={s.ctaEyebrow}>get started</span>
            <h2 className={s.ctaH}>
              start settling onchain <span className={s.accent}>in an afternoon.</span>
            </h2>
            <p className={s.ctaSub}>
              spin up products, payroll, and programmable billing with one SDK. no monthly fees,
              no minimums — verifiable from the first charge.
            </p>
          </div>
          <div className={s.ctaRight}>
            <div className={s.ctaLinks}>
              <a className={`${s.btn} ${s.btnPrimary}`} href="/dashboard">start building →</a>
              <a className={`${s.btn} ${s.btnGhost}`} href="/docs">read the docs</a>
            </div>
            <div className={s.ctaInstall}>$ npm i @virio/sdk</div>
          </div>
        </section>

        <div className={s.ctaMeta}>
          <span>virio labs · onchain billing infrastructure</span>
          <span className={s.mono}>virio.dev · hello@virio.dev</span>
        </div>

      </article>
    </div>
  );
}
