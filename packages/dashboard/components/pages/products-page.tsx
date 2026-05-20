"use client";

import * as React from "react";
import { Plus, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useVirioActions } from "@/lib/wallet-actions";
import { fmt$ } from "@/lib/format";
import type { Plan } from "@/lib/types";
import type { Hex } from "viem";

interface Props {
  plans: Plan[];
  refresh: () => void;
  onCreate: () => void;
}

export function ProductsPage({ plans, refresh, onCreate }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const actions = useVirioActions();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function deactivate(id: string) {
    if (!actions.account.address) return toast("Connect your merchant wallet first", "error");
    const ok = await confirm({
      title: "Deactivate plan?",
      description:
        "Future charges for subscribers on this plan will revert. Existing subscriptions can still be cancelled. This is one-way — to re-enable, create a new plan.",
      okLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;
    setPendingId(id);
    try {
      toast("Confirm deactivation in your wallet…", "success");
      await actions.deactivatePlan(id as Hex);
      toast("Plan deactivated", "success");
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
        title="Products"
        subtitle="Subscription products created on the Virio manager"
        action={
          <Button onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Create Product
          </Button>
        }
      />

      <Card>
        {plans.length === 0 ? (
          <EmptyState
            Icon={Package}
            title="No products yet"
            description="Create your first subscription product to start billing customers onchain."
            action={
              <Button onClick={onCreate}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Create Product
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p, i) => (
                <TableRow
                  key={p.id}
                  className="animate-row-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <TableCell>
                    <strong className="font-semibold">{p.name}</strong>
                    {p.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <strong className="font-semibold">{fmt$(p.price)}</strong>{" "}
                    <span className="text-muted-foreground">USDC</span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      {p.intervalLabel}
                      {p.isTestInterval && <Badge variant="test">test</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>
                    {p.active ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deactivate(p.id)}
                        disabled={pendingId === p.id}
                      >
                        {pendingId === p.id ? "Deactivating…" : "Deactivate"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Cannot re-activate
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
