"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "warn" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind, title?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const toast = React.useCallback(
    (message: string, kind: ToastKind = "info", title?: string) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, kind, message, title }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    [],
  );

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none">
            {items.map((t) => (
              <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = item.kind === "success" ? Check : item.kind === "error" ? X : item.kind === "warn" ? AlertTriangle : Info;
  const accent =
    item.kind === "success"
      ? "before:bg-virio-emerald"
      : item.kind === "error"
      ? "before:bg-rose-600"
      : item.kind === "warn"
      ? "before:bg-amber-500"
      : "before:bg-virio-blue";
  const iconBg =
    item.kind === "success"
      ? "bg-virio-emerald text-virio-emerald-ink"
      : item.kind === "error"
      ? "bg-rose-600 text-white"
      : item.kind === "warn"
      ? "bg-amber-500 text-white"
      : "bg-virio-blue text-[#062847]";

  return (
    <div
      onClick={onDismiss}
      className={cn(
        "pointer-events-auto min-w-[280px] max-w-[380px] flex items-start gap-2.5 rounded-xl border border-border bg-popover px-4 py-3 pl-3.5 shadow-lift cursor-pointer animate-toast-in relative overflow-hidden",
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]",
        accent,
      )}
    >
      <div
        className={cn(
          "mt-0.5 grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full",
          iconBg,
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={3} />
      </div>
      <div className="flex-1 text-sm leading-snug text-foreground">
        {item.title ? <strong className="block font-semibold mb-0.5">{item.title}</strong> : null}
        {item.message}
      </div>
    </div>
  );
}
