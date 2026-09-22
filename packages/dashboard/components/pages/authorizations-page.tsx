"use client";

import * as React from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useAccount } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useBillingActions } from "@/lib/billing-actions";
import { fmt$, fmtAddr } from "@/lib/format";
import type { Hex } from "viem";

/// One authorization as the API returns it. Amounts arrive as strings because
/// they are token base units and JSON has no bigint.
export interface AuthorizationRow {
  id: Hex;
  payer: Hex;
  merchant: Hex;
  token: Hex;
  billingType: "recurring" | "metered" | "hybrid";
  maxPerCharge: string;
  periodSpendCap: string;
  totalSpendCap: string;
  spentThisPeriod: string;
  totalSpent: string;
  periodStart: number;
  periodDuration: number;
  validAfter: number;
  validUntil: number;
  active: boolean;
  remainingThisPeriod: string | null;
  remainingLifetime: string | null;
}

interface Props {
  authorizations: AuthorizationRow[];
  refresh: () => void;
}

const USDC_DECIMALS = 1_000_000;

function usd(base: string): number {
  return Number(base) / USDC_DECIMALS;
}

/// "$37.22 / $100 this month" — the sentence a payer actually wants to read.
function spendLabel(row: AuthorizationRow): string {
  const spent = fmt$(usd(row.spentThisPeriod));
  if (row.periodSpendCap === "0") return `${spent} spent this period`;
  return `${spent} / ${fmt$(usd(row.periodSpendCap))} this ${periodWord(row.periodDuration)}`;
}

function periodWord(seconds: number): string {
  if (seconds === 0) return "period";
  if (seconds <= 86_400) return "day";
  if (seconds <= 604_800) return "week";
  if (seconds <= 2_678_400) return "month";
  return "year";
}

function expiryLabel(validUntil: number): string {
  if (validUntil === 0) return "No expiry";
  const date = new Date(validUntil * 1000);
  const expired = validUntil * 1000 <= Date.now();
  return `${expired ? "Expired" : "Expires"} ${date.toLocaleDateString()}`;
}

export function AuthorizationsPage({ authorizations, refresh }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const actions = useBillingActions();
  const { address } = useAccount();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const connected = address?.toLowerCase();

  let filtered = authorizations;
  if (search) {
    const needle = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.merchant.toLowerCase().includes(needle) ||
        a.payer.toLowerCase().includes(needle) ||
        a.id.toLowerCase().includes(needle),
    );
  }
  if (typeFilter) filtered = filtered.filter((a) => a.billingType === typeFilter);

  async function revoke(row: AuthorizationRow) {
    const ok = await confirm({
      title: "Revoke this authorization?",
      description:
        "The merchant can no longer charge you under it — recurring charges and metered usage both stop immediately. " +
        "This is permanent on chain; resuming requires authorizing again.",
      okLabel: "Revoke",
      danger: true,
    });
    if (!ok) return;

    setPendingId(row.id);
    try {
      await actions.revoke(row.id);
      toast("Authorization revoked", "success");
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Revoke failed", "error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Authorizations"
        subtitle="Everything you have allowed a merchant to charge — recurring, metered and hybrid in one place. Revoke any of them at any time."
      />

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <Input
            placeholder="Search by merchant or id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            aria-label="Search authorizations"
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by billing type"
          >
            <option value="">All types</option>
            <option value="recurring">Recurring</option>
            <option value="metered">Metered</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            Icon={ShieldCheck}
            title="No authorizations"
            description="When you authorize a merchant to charge you, it appears here with its spend limits and a revoke button."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Spend this period</TableHead>
                <TableHead>Max per charge</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const isPayer = row.payer.toLowerCase() === connected;
                const isMerchant = row.merchant.toLowerCase() === connected;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {fmtAddr(isPayer ? row.merchant : row.payer)}
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {isPayer ? "you pay them" : "they pay you"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "active" : "inactive"}>{row.billingType}</Badge>
                    </TableCell>
                    <TableCell>{spendLabel(row)}</TableCell>
                    <TableCell>{fmt$(usd(row.maxPerCharge))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expiryLabel(row.validUntil)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "active" : "cancelled"}>
                        {row.active ? "active" : "revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.active && (isPayer || isMerchant) ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => revoke(row)}
                          disabled={pendingId === row.id}
                        >
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                          {pendingId === row.id ? "Revoking…" : "Revoke"}
                        </Button>
                      ) : (
                        <span className="text-2xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
