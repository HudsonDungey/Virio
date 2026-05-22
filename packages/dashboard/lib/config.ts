import type { VirioConfig } from "./types";
import { CONTRACTS, MERCHANT } from "./addresses";

const CONFIG: VirioConfig = {
  testMode: true,
  testIntervals: [
    { label: "Every 10 seconds", seconds: 10 },
    { label: "Every 30 seconds", seconds: 30 },
    { label: "Every 1 minute", seconds: 60 },
    { label: "Every 5 minutes", seconds: 300 },
  ],
  productionIntervals: [
    { label: "Daily", seconds: 86_400 },
    { label: "Weekly", seconds: 604_800 },
    { label: "Monthly", seconds: 2_592_000 },
    { label: "Annually", seconds: 31_536_000 },
  ],
  scheduler: { testTickMs: 1_000, productionTickMs: 30_000 },
  defaults: {
    merchant: MERCHANT.address,
    feeRecipient: CONTRACTS.feeRecipient,
  },
  maxTransactions: 500,
};

export function getVirioConfig(): VirioConfig {
  return CONFIG;
}
