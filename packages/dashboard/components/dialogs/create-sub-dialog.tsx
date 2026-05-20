"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { fmt$, fmtAddr } from "@/lib/format";
import { useVirioActions } from "@/lib/wallet-actions";
import type { Plan, Subscription } from "@/lib/types";
import type { Hex } from "viem";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plans: Plan[];
  onCreated: () => void;
}

export function CreateSubDialog({ open, onOpenChange, plans, onCreated }: Props) {
  const { toast } = useToast();
  const actions = useVirioActions();
  const activePlans = plans.filter((p) => p.active);
  const [planId, setPlanId] = React.useState("");
  const [spendCap, setSpendCap] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [step, setStep] = React.useState<"approve" | "subscribe" | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSpendCap("");
    setPlanId(activePlans[0]?.id ?? "");
    setStep(null);
  }, [open, activePlans]);

  async function handleSubmit() {
    if (!actions.account.address) return toast("Connect your wallet first", "error");
    if (!planId) return toast("Please select a plan", "error");

    setSubmitting(true);
    try {
      const { subscriptionId } = await actions.subscribe(
        {
          planId: planId as Hex,
          spendCapUsdc: spendCap.trim() ? parseFloat(spendCap) : null,
        },
        (s) => {
          setStep(s);
          toast(
            s === "approve" ? "Approving USDC — confirm in your wallet…" : "Subscribing — confirm in your wallet…",
            "success",
          );
        },
      );
      // Record off-chain createdAt for nicer display.
      await api<Subscription>("POST", "/api/subscriptions", { subscriptionId });
      toast("Subscription created", "success");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
      setStep(null);
    }
  }

  const connected = actions.account.address;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Create Subscription" onClose={() => onOpenChange(false)} />
        <DialogBody className="space-y-4">
          <div>
            <Label>Customer (your connected wallet)</Label>
            <div className="flex h-10 items-center rounded-md border border-border bg-secondary/50 px-3 font-mono text-[12.5px] text-foreground">
              {connected ? fmtAddr(connected) : "Not connected — use the Connect Wallet button"}
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              The subscription will be created on-chain from this address. A one-time USDC approval is requested if needed.
            </div>
          </div>
          <div>
            <Label>Product</Label>
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {activePlans.length === 0 && <option value="">No active plans</option>}
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {fmt$(p.price)} / {p.intervalLabel}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Spend cap (USDC, optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={spendCap}
              onChange={(e) => setSpendCap(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              Subscription auto-completes when total paid reaches this limit
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || activePlans.length === 0 || !connected}
          >
            {!connected
              ? "Connect wallet"
              : step === "approve"
                ? "Approving…"
                : step === "subscribe"
                  ? "Subscribing…"
                  : submitting
                    ? "Confirming…"
                    : "Subscribe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
