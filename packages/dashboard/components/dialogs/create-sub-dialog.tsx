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

const PLAN_ID_RE = /^0x[0-9a-fA-F]{64}$/;

export function CreateSubDialog({ open, onOpenChange, plans, onCreated }: Props) {
  const { toast } = useToast();
  const actions = useVirioActions();
  const activePlans = plans.filter((p) => p.active);

  const [mode, setMode] = React.useState<"select" | "paste">("select");
  const [planId, setPlanId] = React.useState("");
  const [rawId, setRawId] = React.useState("");
  const [lookedUp, setLookedUp] = React.useState<Plan | null | "loading" | "not-found">(null);
  const [spendCap, setSpendCap] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [step, setStep] = React.useState<"approve" | "subscribe" | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSpendCap("");
    setMode("select");
    setPlanId(activePlans[0]?.id ?? "");
    setRawId("");
    setLookedUp(null);
    setStep(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lookup plan when rawId changes in paste mode.
  React.useEffect(() => {
    if (mode !== "paste") return;
    if (!PLAN_ID_RE.test(rawId)) {
      setLookedUp(null);
      setPlanId("");
      return;
    }
    setPlanId(rawId);
    setLookedUp("loading");
    api<Plan>("GET", `/api/plans?id=${rawId}`)
      .then((p) => setLookedUp(p))
      .catch(() => setLookedUp("not-found"));
  }, [rawId, mode]);

  function switchMode(next: "select" | "paste") {
    setMode(next);
    if (next === "select") {
      setPlanId(activePlans[0]?.id ?? "");
      setRawId("");
      setLookedUp(null);
    } else {
      setPlanId("");
      setRawId("");
      setLookedUp(null);
    }
  }

  async function handleSubmit() {
    if (!actions.account.address) return toast("Connect your wallet first", "error");
    if (!planId) return toast("Please select or enter a plan", "error");
    if (mode === "paste" && !PLAN_ID_RE.test(planId)) return toast("Enter a valid plan ID (0x + 64 hex chars)", "error");

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
  const canSubmit = mode === "select"
    ? activePlans.length > 0 && !!planId
    : PLAN_ID_RE.test(rawId);

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
            <div className="mb-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => switchMode("select")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === "select"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Select plan
              </button>
              <button
                type="button"
                onClick={() => switchMode("paste")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === "paste"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Paste plan ID
              </button>
            </div>

            {mode === "select" ? (
              <>
                <Label>Product</Label>
                <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  {activePlans.length === 0 && <option value="">No active plans</option>}
                  {activePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmt$(p.price)} / {p.intervalLabel}
                    </option>
                  ))}
                </Select>
              </>
            ) : (
              <>
                <Label>Plan ID</Label>
                <Input
                  value={rawId}
                  onChange={(e) => setRawId(e.target.value.trim())}
                  placeholder="0x…"
                  className="font-mono text-xs"
                />
                <div className="mt-1 text-[11.5px]">
                  {!rawId && (
                    <span className="text-muted-foreground">Paste a bytes32 plan ID to subscribe to any plan</span>
                  )}
                  {rawId && !PLAN_ID_RE.test(rawId) && (
                    <span className="text-destructive">Must be 0x followed by 64 hex characters</span>
                  )}
                  {PLAN_ID_RE.test(rawId) && lookedUp === "loading" && (
                    <span className="text-muted-foreground">Looking up plan…</span>
                  )}
                  {PLAN_ID_RE.test(rawId) && lookedUp === "not-found" && (
                    <span className="text-muted-foreground">Plan not indexed locally — subscription will proceed</span>
                  )}
                  {PLAN_ID_RE.test(rawId) && lookedUp !== null && lookedUp !== "loading" && lookedUp !== "not-found" && (
                    <span className="text-foreground">
                      {lookedUp.name} — {fmt$(lookedUp.price)} / {lookedUp.intervalLabel}
                    </span>
                  )}
                </div>
              </>
            )}
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
            disabled={submitting || !canSubmit || !connected}
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
