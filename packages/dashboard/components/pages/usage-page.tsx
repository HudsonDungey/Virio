"use client";

import * as React from "react";
import { Gauge, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { fmt$, fmtAddr, fmtTime } from "@/lib/format";
import type { AuthorizationRow } from "./authorizations-page";
import type { Hex } from "viem";

export interface SettlementRow {
  id: string;
  authorizationId: Hex;
  module: Hex;
  executor: Hex;
  gross: string;
  merchantAmount: string;
  executorFee: string;
  protocolFee: string;
  periodStart: number;
  txHash: Hex;
  blockNumber: string;
  timestamp: number;
}

interface Props {
  authorizations: AuthorizationRow[];
  settlements: SettlementRow[];
}

const USDC_DECIMALS = 1_000_000;

function usd(base: string): number {
  return Number(base) / USDC_DECIMALS;
}

export function UsagePage({ authorizations, settlements }: Props) {
  const metered = authorizations.filter(
    (a) => a.billingType === "metered" || a.billingType === "hybrid",
  );

  const settledTotal = settlements.reduce((sum, s) => sum + usd(s.gross), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usage"
        subtitle="Settled metered and hybrid billing. Every figure here is a transfer that happened on chain."
      />

      {/* Being explicit about what this page cannot show matters more than
          filling the space with a number we would have to invent. */}
      <Card className="flex items-start gap-3 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Unsettled usage is not shown here, because it does not exist on chain. Usage is counted
          by the merchant&apos;s metering service and only becomes visible when a signed settlement
          statement is submitted. A merchant-signed statement attests to usage — it does not prove
          it. What protects you is the meter&apos;s fixed unit price and your authorization&apos;s
          spend caps, both of which are enforced on chain.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Settled volume
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-foreground">
            {fmt$(settledTotal)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">Settlements</div>
          <div className="mt-1 font-display text-2xl font-semibold text-foreground">
            {settlements.length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Usage-based authorizations
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-foreground">
            {metered.length}
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-[15px] font-semibold text-foreground">Settlements</h2>
        </div>
        {settlements.length === 0 ? (
          <EmptyState
            Icon={Gauge}
            title="No settlements yet"
            description="Metered settlements appear here once a merchant submits a signed usage statement and an executor settles it."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Authorization</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>To merchant</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Executor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">
                    {fmtTime(new Date(s.timestamp * 1000).toISOString())}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-2xs">{fmtAddr(s.authorizationId)}</span>
                  </TableCell>
                  <TableCell>{fmt$(usd(s.gross))}</TableCell>
                  <TableCell>{fmt$(usd(s.merchantAmount))}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmt$(usd(s.executorFee) + usd(s.protocolFee))}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-2xs">{fmtAddr(s.executor)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-[15px] font-semibold text-foreground">
            Usage-based authorizations
          </h2>
        </div>
        {metered.length === 0 ? (
          <EmptyState
            Icon={Gauge}
            title="No metered authorizations"
            description="Metered and hybrid authorizations appear here with the budget each one has left."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Counterparty</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Spent this period</TableHead>
                <TableHead>Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-foreground">
                    {fmtAddr(a.merchant)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.active ? "active" : "inactive"}>{a.billingType}</Badge>
                  </TableCell>
                  <TableCell>{fmt$(usd(a.spentThisPeriod))}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.remainingThisPeriod === null
                      ? "uncapped"
                      : fmt$(usd(a.remainingThisPeriod))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
