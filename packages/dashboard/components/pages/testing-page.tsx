"use client";

import * as React from "react";
import { FlaskConical, Construction, Terminal } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useVirioConfig } from "@/app/providers";
import { fmtAddr } from "@/lib/format";

export function TestingPage({ testMode }: { testMode: boolean }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const cfg = useVirioConfig();

  return (
    <section className="animate-page-in mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 sm:pt-9 lg:px-12">
      <PageHeader
        title="Testing Suite"
        subtitle="Live state of the connected wallet and the configured Virio manager"
        action={
          <Badge variant={testMode ? "active" : "inactive"}>
            {testMode ? "test mode on" : "test mode off"}
          </Badge>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <div className="grid gap-4 p-5 text-[13px] sm:grid-cols-2">
          <Row label="Network" value={cfg.network} />
          <Row label="Chain ID" value={chainId ? String(chainId) : "—"} />
          <Row
            label="Connected wallet"
            value={address ? fmtAddr(address) : "not connected"}
            mono
          />
          <Row label="Virio manager" value={fmtAddr(cfg.contracts.manager)} mono />
          <Row label="USDC" value={fmtAddr(cfg.contracts.usdc)} mono />
          <Row
            label="Fee recipient"
            value={fmtAddr(cfg.contracts.feeRecipient)}
            mono
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onchain testing</CardTitle>
        </CardHeader>
        <EmptyState
          Icon={Construction}
          title="In-app simulators removed"
          description="To exercise the manager, create products and subscribe from the Products / Subscriptions pages — every action signs against your connected wallet and writes to chain. For lower-level calls (manual charge, time-travel, event inspection) use the cast snippets in RUN.md."
        />
        <div className="border-t border-border p-5 text-[12.5px] text-muted-foreground">
          <div className="mb-2 inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Terminal className="h-3.5 w-3.5" />
            Quick reference
          </div>
          <pre className="code-shell overflow-x-auto rounded-lg border border-border bg-secondary/60 p-3 text-[11.5px] text-foreground">
{`# force-charge a subscription
cast send <MANAGER> "charge(bytes32)" <SUB_ID> \\
  --private-key <EXECUTOR_PK> --rpc-url <RPC>

# mint test USDC (MockUSDC only)
cast send <USDC> "mint(address,uint256)" <YOUR_ADDR> 100000000 \\
  --private-key <PK> --rpc-url <RPC>

# advance anvil time
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine          --rpc-url http://127.0.0.1:8545`}
          </pre>
        </div>
      </Card>

      <p className="mt-6 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <FlaskConical className="h-3.5 w-3.5" />
        Every action on this dashboard hits the contract directly — no mock state
        is kept in memory.
      </p>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          mono
            ? "mt-0.5 font-mono text-[12.5px] text-foreground"
            : "mt-0.5 text-[13.5px] font-semibold text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}
