"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { modalVariants, overlayVariants } from "@/lib/motion";

interface Props {
  children: React.ReactNode;
}

export function WalletGate({ children }: Props) {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const connected = mounted && isConnected;
  const checking = !mounted || isConnecting || isReconnecting;

  return (
    <div className="relative">
      <div
        aria-hidden={!connected}
        className={
          connected
            ? "transition-[filter] duration-slow"
            : "pointer-events-none select-none blur-[4px] transition-[filter] duration-slow"
        }
      >
        {children}
      </div>

      <AnimatePresence>
        {!connected && (
          <motion.div
            key="gate"
            variants={overlayVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-background/50 backdrop-blur-sm"
          >
            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="mx-4 w-full max-w-[400px] rounded-xl border border-border bg-card p-8 text-center shadow-e3"
            >
              <div className="mx-auto mb-6 grid h-10 w-10 place-items-center rounded-md border border-border bg-[hsl(var(--surface-2))] text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Connect your wallet
              </h2>
              <p className="mx-auto mt-2 max-w-[280px] text-sm text-muted-foreground">
                Sign in with the wallet you want to use as merchant or customer.
              </p>
              <div className="mt-6 flex justify-center">
                {checking ? (
                  <div className="h-10 w-44 animate-virio rounded-md bg-secondary" />
                ) : (
                  <ConnectButton
                    showBalance={false}
                    chainStatus="icon"
                    accountStatus="address"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
