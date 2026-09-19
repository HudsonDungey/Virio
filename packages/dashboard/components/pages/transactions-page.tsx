"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { AlertCircle, Loader2, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { fmt$, fmtAddr, fmtTime } from "@/lib/format";
import type { Transaction } from "@/lib/types";

interface Props {
  visible: boolean;
}

const transactionRequests = new Map<string, Promise<Transaction[]>>();

export function TransactionsPage({ visible }: Props) {
  const { address } = useAccount();
  const [customer, setCustomer] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [items, setItems] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const wallet = address?.toLowerCase();
    if (!visible || !wallet) return;
    const walletKey = wallet;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setItems([]);
      try {
        let request = transactionRequests.get(walletKey);
        if (!request) {
          request = api<Transaction[]>("GET", "/api/transactions?wallet=" + encodeURIComponent(walletKey));
          transactionRequests.set(walletKey, request);
        }
        const r = await request;
        if (!cancelled) setItems(r);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load transaction history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [address, visible]);

  const filteredItems = React.useMemo(() => {
    const counterparty = customer.trim().toLowerCase();
    return items.filter((transaction) => {
      if (counterparty && !transaction.counterparty.toLowerCase().includes(counterparty)) return false;
      return !status || transaction.status === status;
    });
  }, [items, customer, status]);

  const hasActiveFilters = customer.trim().length > 0 || status.length > 0;
  const emptyMessage = !address
    ? "Connect the wallet whose payment history you want to view."
    : hasActiveFilters
      ? "No transactions match those filters."
      : "No transactions found for this wallet.";

  /* The history request intentionally runs once per connected wallet. Filters are local. */
  const clearFilters = () => {
    setCustomer("");
    setStatus("");
  };

  return (
    <section className="animate-page-in mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 sm:pt-9 lg:px-12">
      <PageHeader title="Transactions" subtitle="Full payment history across products and payroll" />

      <Card>
        <div className="flex flex-col gap-2.5 border-b border-border bg-secondary/40 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <Input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Filter by counterparty…"
            className="h-9 w-full sm:w-60"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-full sm:w-44">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </Select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-left text-xs font-medium text-muted-foreground hover:text-foreground sm:ml-auto">
              Clear filters
            </button>
          )}
        </div>
        {error && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:mx-5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading transaction history…</span>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  <span className="inline-flex flex-col items-center gap-2"><ReceiptText className="h-5 w-5" />{emptyMessage}</span>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((t, i) => (
                <TableRow
                  key={t.id}
                  className="animate-row-in cursor-pointer"
                  style={{ animationDelay: `${i * 22}ms` }}
                  onClick={() => window.location.href = `/transaction/${t.id}`}
                >
                  <TableCell className="font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                    {t.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground capitalize">{t.type}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{fmtAddr(t.counterparty)}</TableCell>
                  <TableCell>{t.planName}</TableCell>
                  <TableCell className={`font-semibold tabular-nums ${t.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {t.direction === "in" ? "+" : "−"}{fmt$(t.gross)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmt$(t.fee)}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtTime(t.timestamp)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
