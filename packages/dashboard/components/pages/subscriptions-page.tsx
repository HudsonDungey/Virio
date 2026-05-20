"use client";

import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useVirioActions } from "@/lib/wallet-actions";
import { fmt$, fmtAddr, fmtNextCharge } from "@/lib/format";
import type { Plan, Subscription } from "@/lib/types";
import type { Hex } from "viem";

interface Props {
  subscriptions: Subscription[];
  plans: Plan[];
  refresh: () => void;
  onCreate: () => void;
}

export function SubscriptionsPage({ subscriptions, refresh, onCreate }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const actions = useVirioActions();
  const [search, setSearch] = React.useState("");
  const [statusF, setStatusF] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  let filtered = subscriptions;
  if (search)
    filtered = filtered.filter((s) =>
      s.customer.toLowerCase().includes(search.toLowerCase()),
    );
  if (statusF) filtered = filtered.filter((s) => s.status === statusF);

  async function cancel(id: string, customer: string) {
    if (!actions.account.address) return toast("Connect your wallet first", "error");
    const connected = actions.account.address.toLowerCase();
    if (connected !== customer.toLowerCase()) {
      toast(
        "Heads-up: only the customer or merchant for this sub can cancel. Make sure your connected wallet is one of them.",
        "success",
      );
    }
    const ok = await confirm({
      title: "Cancel subscription?",
      description: "The customer will no longer be charged. This is permanent on chain.",
      okLabel: "Cancel subscription",
      danger: true,
    });
    if (!ok) return;
    setPendingId(id);
    try {
      toast("Confirm cancellation in your wallet…", "success");
      await actions.cancel(id as Hex);
      toast("Subscription cancelled", "success");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="animate-page-in mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 sm:pt-9 lg:px-12">
      <PageHeader
        title="Subscriptions"
        subtitle="Active and historical customer subscriptions"
        action={
          <Button onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Subscribe
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-2.5 border-b border-border bg-secondary/40 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by customer…"
            className="h-9 w-full sm:w-60"
          />
          <Select
            value={statusF}
            onChange={(e) => setStatusF(e.target.value)}
            className="h-9 w-full sm:w-44"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            Icon={RefreshCw}
            title={subscriptions.length === 0 ? "No subscriptions yet" : "No matches"}
            description={
              subscriptions.length === 0
                ? "Subscribe a customer to a product to see recurring charges here."
                : "Try adjusting your filters."
            }
            action={
              subscriptions.length === 0 ? (
                <Button onClick={onCreate}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Create subscription
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Charges</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Next Charge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, i) => {
                const nc = s.status === "active" ? fmtNextCharge(s.nextChargeAt) : null;
                return (
                  <TableRow
                    key={s.id}
                    className="animate-row-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <TableCell className="font-mono text-xs">
                      {fmtAddr(s.customer)}
                    </TableCell>
                    <TableCell>{s.planName}</TableCell>
                    <TableCell>{s.chargeCount}</TableCell>
                    <TableCell>
                      <strong className="font-semibold tabular-nums">
                        {fmt$(s.totalPaid)}
                      </strong>
                    </TableCell>
                    <TableCell>
                      {nc ? (
                        <span
                          className={
                            nc.soon
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : ""
                          }
                        >
                          {nc.text}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      {s.status === "active" && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => cancel(s.id, s.customer)}
                          disabled={pendingId === s.id}
                        >
                          {pendingId === s.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
