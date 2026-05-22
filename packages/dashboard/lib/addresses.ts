import type { Network } from "./types";

export type AddressBookEntry = {
  label: string;
  address: `0x${string}`;
};

export const NETWORK: Network = "sepolia";

export const ADDRESS_BOOK = [
  { label: "VirioManager", address: "0x690cfdbbeb342a76da3f175eeeefb61c2a4b71db" },
  { label: "VirioDelegate7702", address: "0x1b6ec779de9278db687d3826d095840b97b02672" },
  { label: "VirioUSDC", address: "0x9564D59BA3be46C3f2565cA0C9bf09df131Cb604" },
  { label: "VirioFeeRecipient", address: "0x2cA6c628E6Fd6F7a7A4Cfb48daF3dF6f079783A4" },
  { label: "VirioPayrollManager", address: "0xae354afafb4f87ae812f3fe6a15f4ab009dca073" },
  { label: "My Merchant", address: "0x225b791581185B73Eb52156942369843E8B0Eec7" },
  { label: "Fee Recipient Wallet", address: "0x2cA6c628E6Fd6F7a7A4Cfb48daF3dF6f079783A4" },
] as const satisfies readonly AddressBookEntry[];

const ADDRESS_MAP = new Map<string, `0x${string}`>(
  ADDRESS_BOOK.map((entry) => [entry.label, entry.address]),
);

function address(label: string): `0x${string}` {
  const value = ADDRESS_MAP.get(label);
  if (!value) {
    throw new Error(`Missing address for ${label}`);
  }
  return value;
}

export const CONTRACTS = {
  manager: address("VirioManager"),
  usdc: address("VirioUSDC"),
  feeRecipient: address("VirioFeeRecipient"),
  payrollManager: address("VirioPayrollManager"),
  delegate: address("VirioDelegate7702"),
} as const;

export const DEPLOYMENT_BLOCK = 10897006n;
export const PAYROLL_DEPLOYMENT_BLOCK = 10896724n;

export const MERCHANT = {
  address: address("My Merchant"),
  label: "My Merchant",
} as const;

export const TEST_ADDRESSES = [
  {
    label: "Fee Recipient Wallet",
    address: address("Fee Recipient Wallet"),
  },
] as const;
