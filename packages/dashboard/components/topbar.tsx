"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface TopbarProps {
  /// Kept for API compatibility with DashboardShell — title now lives in PageHeader.
  title?: string;
  onOpenCommand?: () => void;
  onOpenSidebar?: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  return (
    <header className="sticky top-0 z-[80] flex h-14 items-center gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onOpenSidebar}
        className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <ConnectButton
          chainStatus="icon"
          accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
          showBalance={false}
        />
      </div>
    </header>
  );
}
