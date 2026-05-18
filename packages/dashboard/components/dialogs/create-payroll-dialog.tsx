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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { usePayrollActions } from "@/lib/payroll-actions";
import type { IntervalDef } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  testIntervals: IntervalDef[];
  productionIntervals: IntervalDef[];
  onCreated: () => void;
}

export function CreatePayrollDialog({
  open,
  onOpenChange,
  testIntervals,
  productionIntervals,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const actions = usePayrollActions();
  const [interval, setIntervalVal] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) setIntervalVal("");
  }, [open]);

  async function handleSubmit() {
    const seconds = parseInt(interval, 10);
    if (!seconds) return toast("Pick a pay cycle interval", "error");

    setSubmitting(true);
    try {
      toast("Confirm in your wallet…", "success");
      await actions.createPlan({ periodSeconds: seconds });
      toast("Payroll plan created", "success");
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
        <DialogHeader title="Create payroll plan" onClose={() => onOpenChange(false)} />
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Plans are containers for recipients. Pick a pay cycle now and add
            recipients after.
          </p>
          <div>
            <Label>Pay cycle</Label>
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
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Token is USDC (set by the contract). Protocol fee, executor fee, and
            flat fee are all set on the manager by the contract owner.
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
                ? "Create plan"
                : "Connect wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
