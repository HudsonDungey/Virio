"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import {
  LayoutDashboard,
  Wallet,
  Package,
  RefreshCw,
  ArrowLeftRight,
  FlaskConical,
  BookOpen,
  Code2,
  Plus,
  Zap,
  Send,
} from "lucide-react";
import { Sidebar, type PageKey } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPalette, type Command } from "@/components/command-palette";
import { WalletGate } from "@/components/wallet-gate";
import { DashboardPage } from "@/components/pages/dashboard-page";
import { ProductsPage } from "@/components/pages/products-page";
import { SubscriptionsPage } from "@/components/pages/subscriptions-page";
import { TransactionsPage } from "@/components/pages/transactions-page";
import { PayrollPage } from "@/components/pages/payroll-page";
import { TestingPage } from "@/components/pages/testing-page";
import { CreatePlanDialog } from "@/components/dialogs/create-plan-dialog";
import { CreateSubDialog } from "@/components/dialogs/create-sub-dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { IntervalDef, Plan, Stats, Subscription } from "@/lib/types";

interface ConfigState {
  testMode: boolean;
  testIntervals: IntervalDef[];
  productionIntervals: IntervalDef[];
}

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "Overview",
  payroll: "Payroll",
  products: "Products",
  subscriptions: "Subscriptions",
  transactions: "Transactions",
  testing: "Testing Suite",
};

export function DashboardShell() {
  const { toast } = useToast();
  const { address } = useAccount();
  const [page, setPage] = React.useState<PageKey>("dashboard");
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [createPlanOpen, setCreatePlanOpen] = React.useState(false);
  const [createSubOpen, setCreateSubOpen] = React.useState(false);
  const [config, setConfig] = React.useState<ConfigState>({
    testMode: false,
    testIntervals: [],
    productionIntervals: [],
  });
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [subs, setSubs] = React.useState<Subscription[]>([]);

  const knownTxIdsRef = React.useRef<Set<string>>(new Set());
  const [newTxIds, setNewTxIds] = React.useState<Set<string>>(new Set());

  const fetchConfig = React.useCallback(async () => {
    try {
      setConfig(await api<ConfigState>("GET", "/api/config"));
    } catch (e) {
      console.error("config load failed", e);
    }
  }, []);

  /// All chain reads are scoped to the connected wallet. When no wallet is
  /// connected we keep the local state empty so the UI shows a "connect"
  /// prompt instead of leaking another merchant's data.
  const merchantParam = address ? `?merchant=${address}` : null;

  const fetchStats = React.useCallback(async () => {
    if (!merchantParam) {
      setStats(null);
      knownTxIdsRef.current = new Set();
      setNewTxIds(new Set());
      return;
    }
    try {
      const s = await api<Stats>("GET", `/api/stats${merchantParam}`);
      setStats(s);
      const incoming = s.recentTransactions.map((t) => t.id);
      const fresh = new Set<string>();
      const known = knownTxIdsRef.current;
      for (const id of incoming) if (!known.has(id)) fresh.add(id);
      knownTxIdsRef.current = new Set(incoming);
      setNewTxIds(fresh);
    } catch (e) {
      console.error("stats load failed", e);
    }
  }, [merchantParam]);

  const fetchPlans = React.useCallback(async () => {
    if (!merchantParam) {
      setPlans([]);
      return;
    }
    try {
      setPlans(await api<Plan[]>("GET", `/api/plans${merchantParam}`));
    } catch (e) {
      console.error("plans load failed", e);
    }
  }, [merchantParam]);

  const fetchSubs = React.useCallback(async () => {
    if (!merchantParam) {
      setSubs([]);
      return;
    }
    try {
      setSubs(await api<Subscription[]>("GET", `/api/subscriptions${merchantParam}`));
    } catch (e) {
      console.error("subs load failed", e);
    }
  }, [merchantParam]);

  const refreshAll = React.useCallback(() => {
    fetchStats();
    fetchPlans();
    fetchSubs();
  }, [fetchStats, fetchPlans, fetchSubs]);

  /// Fetch once when the connected wallet changes — never on page navigation.
  /// Refreshes are explicit (post-mutation via refreshAll or a manual reload).
  React.useEffect(() => {
    fetchConfig();
    fetchStats();
    fetchPlans();
    fetchSubs();
  }, [fetchConfig, fetchStats, fetchPlans, fetchSubs]);

  // No timed polling — initial fetch on mount, refreshAll is called by mutations
  // (createPlan, subscribe, cancel, deactivate) so the UI stays consistent.

  async function setTestMode(v: boolean) {
    try {
      const r = await api<{ testMode: boolean }>("POST", "/api/config", { testMode: v });
      setConfig((c) => ({ ...c, testMode: r.testMode }));
      toast(v ? "Test mode enabled" : "Test mode disabled", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const go = React.useCallback((p: PageKey) => setPage(p), []);

  const commands = React.useMemo<Command[]>(
    () => [
      { id: "nav-dashboard", group: "Navigate", label: "Overview", Icon: LayoutDashboard, hint: "G O", run: () => go("dashboard") },
      { id: "nav-payroll", group: "Navigate", label: "Payroll", Icon: Wallet, run: () => go("payroll") },
      { id: "nav-products", group: "Navigate", label: "Products", Icon: Package, run: () => go("products") },
      { id: "nav-subs", group: "Navigate", label: "Subscriptions", Icon: RefreshCw, run: () => go("subscriptions") },
      { id: "nav-tx", group: "Navigate", label: "Transactions", Icon: ArrowLeftRight, run: () => go("transactions") },
      { id: "nav-testing", group: "Navigate", label: "Testing Suite", Icon: FlaskConical, run: () => go("testing") },
      { id: "act-product", group: "Actions", label: "Create product", Icon: Plus, keywords: "new plan pricing", run: () => { go("products"); setCreatePlanOpen(true); } },
      { id: "act-sub", group: "Actions", label: "Create subscription", Icon: Plus, keywords: "subscribe customer", run: () => { go("subscriptions"); setCreateSubOpen(true); } },
      { id: "act-payroll", group: "Actions", label: "Run payroll", Icon: Send, keywords: "pay contractors employees", run: () => go("payroll") },
      { id: "act-test", group: "Actions", label: config.testMode ? "Disable test mode" : "Enable test mode", Icon: Zap, run: () => setTestMode(!config.testMode) },
      { id: "link-docs", group: "Resources", label: "Documentation", Icon: BookOpen, hint: "/docs", run: () => { window.location.href = "/docs"; } },
      { id: "link-dev", group: "Resources", label: "Developer portal", Icon: Code2, hint: "/dev", run: () => { window.location.href = "/dev"; } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.testMode, go],
  );

  return (
    <WalletGate>
      <Sidebar
        page={page}
        onPageChange={setPage}
        testMode={config.testMode}
        onTestModeChange={setTestMode}
        onOpenCommand={() => setCmdOpen(true)}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} commands={commands} />

      <div className="relative z-[1] flex min-h-screen flex-col lg:ml-[248px]">
        <Topbar
          title={PAGE_TITLES[page]}
          onOpenCommand={() => setCmdOpen(true)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden bg-background">
          {page === "dashboard" && (
            <DashboardPage
              stats={stats}
              newTxIds={newTxIds}
              onNavigate={go}
              onCreateProduct={() => {
                go("products");
                setCreatePlanOpen(true);
              }}
              onCreateSubscription={() => {
                go("subscriptions");
                setCreateSubOpen(true);
              }}
            />
          )}
          {page === "payroll" && (
            <PayrollPage
              testMode={config.testMode}
              testIntervals={config.testIntervals}
              productionIntervals={config.productionIntervals}
            />
          )}
          {page === "products" && (
            <ProductsPage
              plans={plans}
              refresh={refreshAll}
              onCreate={() => setCreatePlanOpen(true)}
            />
          )}
          {page === "subscriptions" && (
            <SubscriptionsPage
              subscriptions={subs}
              plans={plans}
              refresh={refreshAll}
              onCreate={() => setCreateSubOpen(true)}
            />
          )}
          {page === "transactions" && <TransactionsPage visible={page === "transactions"} />}
          {page === "testing" && <TestingPage testMode={config.testMode} />}
        </main>
      </div>

      <CreatePlanDialog
        open={createPlanOpen}
        onOpenChange={setCreatePlanOpen}
        testIntervals={config.testIntervals}
        productionIntervals={config.productionIntervals}
        onCreated={refreshAll}
      />
      <CreateSubDialog
        open={createSubOpen}
        onOpenChange={setCreateSubOpen}
        plans={plans}
        onCreated={refreshAll}
      />
    </WalletGate>
  );
}
