"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { usePulseActions } from "@/lib/wallet-actions";
import type { IntervalDef } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  testIntervals: IntervalDef[];
  productionIntervals: IntervalDef[];
  onCreated: () => void;
}

export function CreatePlanDialog({
  open,
  onOpenChange,
  testIntervals,
  productionIntervals,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const actions = usePulseActions();
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [interval, setIntervalVal] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setDesc("");
      setPrice("");
      setIntervalVal("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) return toast("Name is required", "error");
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) return toast("Price must be greater than 0", "error");
    // Contract has a 1 USDC flat fee + ~0.35% combined fees; charges below
    // ~1.01 USDC revert at settle time. Guard the merchant up front.
    if (priceNum < 1.01)
      return toast("Price must be at least 1.01 USDC to cover protocol fees", "error");
    const intervalSeconds = parseInt(interval, 10);
    if (!intervalSeconds) return toast("Please select a billing interval", "error");

    const all = [...testIntervals, ...productionIntervals];
    const intervalLabel = all.find((i) => i.seconds === intervalSeconds)?.label ?? `${intervalSeconds}s`;

    setSubmitting(true);
    try {
      toast("Confirm in your wallet…", "success");
      const { planId } = await actions.createPlan({
        priceUsdc: priceNum,
        periodSeconds: intervalSeconds,
      });
      // Persist off-chain metadata (name, description, interval label) so the UI
      // can show "Pro Plan" instead of "Plan 0x12345…".
      await api("POST", "/api/plans", {
        planId,
        name: name.trim(),
        description: desc.trim(),
        intervalLabel,
        intervalSeconds,
      });
      toast(`Product "${name.trim()}" created`, "success");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Create Product" onClose={() => onOpenChange(false)} />
        <DialogBody className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro Plan" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Full access to all features"
            />
          </div>
          <div>
            <Label>Price (USDC)</Label>
            <Input
              type="number"
              min="1.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="9.99"
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Minimum 1.01 USDC — must cover the 1 USDC protocol flat fee plus
              executor and protocol percentages.
            </div>
          </div>
          <div>
            <Label>Billing interval</Label>
            <Select value={interval} onChange={(e) => setIntervalVal(e.target.value)}>
              <option value="">Select an interval…</option>
              <optgroup label="— Test intervals —">
                {testIntervals.map((iv) => (
                  <option key={iv.seconds} value={iv.seconds}>
                    {iv.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="— Production intervals —">
                {productionIntervals.map((iv) => (
                  <option key={iv.seconds} value={iv.seconds}>
                    {iv.label}
                  </option>
                ))}
              </optgroup>
            </Select>
            <div className="mt-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Protocol fee and flat fee are set on the manager by the contract
              owner — they aren't configurable per plan.
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !actions.account.address}>
            {submitting ? "Confirming…" : actions.account.address ? "Create Product" : "Connect wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
