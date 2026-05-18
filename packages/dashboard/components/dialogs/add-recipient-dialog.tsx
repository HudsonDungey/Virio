"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { usePayrollActions } from "@/lib/payroll-actions";
import type { Hex } from "viem";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  planId: Hex | null;
  onAdded: () => void;
}

export function AddRecipientDialog({ open, onOpenChange, planId, onAdded }: Props) {
  const { toast } = useToast();
  const actions = usePayrollActions();
  const [wallet, setWallet] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [spendCap, setSpendCap] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setWallet("");
      setAmount("");
      setSpendCap("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!planId) return toast("No plan selected", "error");
    const trimmed = wallet.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed))
      return toast("Wallet must be a 0x-prefixed 40-char hex address", "error");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast("Amount must be greater than 0", "error");

    setSubmitting(true);
    try {
      toast("Confirm in your wallet…", "success");
      await actions.addRecipient({
        planId,
        wallet: trimmed as Hex,
        amountUsdc: amt,
        spendCapUsdc: spendCap.trim() ? parseFloat(spendCap) : null,
      });
      toast("Recipient added", "success");
      onAdded();
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
        <DialogHeader title="Add recipient" onClose={() => onOpenChange(false)} />
        <DialogBody className="space-y-4">
          <div>
            <Label>Wallet address</Label>
            <Input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>Amount per cycle (USDC)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000.00"
            />
          </div>
          <div>
            <Label>Lifetime spend cap (USDC, optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={spendCap}
              onChange={(e) => setSpendCap(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Auto-removes the recipient once total paid exceeds this cap.
            </div>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Adding requires a one-time USDC allowance for the payroll contract.
            You'll be asked to approve if it isn't already granted.
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !actions.account.address}>
            {submitting
              ? "Confirming…"
              : actions.account.address
                ? "Add recipient"
                : "Connect wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
