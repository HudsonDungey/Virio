"use client";

import * as React from "react";
import { useAccount } from "wagmi";
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

export function TransactionsPage({ visible }: Props) {
  const { address } = useAccount();
  const [customer, setCustomer] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [items, setItems] = React.useState<Transaction[]>([]);

  const fetchTx = React.useCallback(async () => {
    if (!address) {
      setItems([]);
      return;
    }
    const params = new URLSearchParams({ wallet: address });
    if (customer) params.set("counterparty", customer);
    if (status) params.set("status", status);
    try {
      const r = await api<Transaction[]>("GET", "/api/transactions?" + params.toString());
      setItems(r);
    } catch {
      /* ignore */
    }
  }, [address, customer, status]);

  React.useEffect(() => {
    if (visible) fetchTx();
  }, [visible, fetchTx]);

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
        </div>
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
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              items.map((t, i) => (
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
