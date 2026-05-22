import { ProvidersWrapper } from "../providers-wrapper";
import { getLocalConfig, publicView } from "@/lib/local-config";
import { ConfirmProvider } from "@/components/ui/confirm";
import { ToastProvider } from "@/components/ui/toast";

/// The wallet provider tree is scoped to `/dashboard/*`. Marketing pages
/// (`/`, `/virio`, `/dev`) and content routes (`/docs/*`, `/raw/*`, `/llms*.txt`)
/// don't use wagmi, so keeping them outside this layout means SSR doesn't have
/// to evaluate wagmi + RainbowKit + MetaMask SDK + WalletConnect for every
/// prerendered page — which was blowing past Vercel's build memory cap.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const publicCfg = publicView(getLocalConfig());
  return (
    <ProvidersWrapper config={publicCfg}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </ProvidersWrapper>
  );
}
