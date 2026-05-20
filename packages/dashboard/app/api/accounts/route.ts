import { NextResponse } from "next/server";
import { displayAccounts, publicClient, USDC_ADDRESS, erc20Abi, usdcDisplay } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Lists the user-configured addresses (their merchant + test customer addresses
/// from virio.local.json) with on-chain balances. No private keys are returned —
/// the dashboard signs from the connected wallet for any writes.
export async function GET() {
  const enriched = await Promise.all(
    displayAccounts.map(async (a) => {
      const [eth, usdc] = await Promise.all([
        publicClient.getBalance({ address: a.address }),
        publicClient
          .readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [a.address],
          })
          .catch(() => 0n) as Promise<bigint>,
      ]);
      return {
        name: a.name,
        address: a.address,
        ethBalance: Number(eth) / 1e18,
        usdcBalance: usdcDisplay(usdc),
      };
    }),
  );
  return NextResponse.json(enriched);
}
