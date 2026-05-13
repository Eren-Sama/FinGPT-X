"use client";

import { useState } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import * as api from "@/lib/api";

import { PortfolioStats } from "./portfolio-stats";
import { HoldingsTable } from "./holdings-table";
import { AddPositionModal } from "./add-position-modal";
import { AIInsightsPanel } from "./ai-insights";
import { useMarketCategories } from "@/lib/queries";
import { SiteChrome } from "@/components/site-chrome";

export default function PortfolioPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  // 1. Fetch offline portfolio state (using user_id = 0 for default user)
  const { data: portfolio, isLoading: portfolioLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => api.getPortfolio(0),
  });

  const holdings = portfolio?.holdings || [];
  const symbolList = Array.from(new Set(holdings.map((h) => h.symbol)));

  // 2. Fetch offline quotes for all holdings
  const { data: quotesData } = useQuery({
    queryKey: ["market", "bulk-quotes", symbolList.join(",")],
    queryFn: () => api.getBulkQuotes(symbolList),
    enabled: symbolList.length > 0,
    staleTime: 60_000,
  });

  const quotes = quotesData || {};

  // 3. Fetch offline categories & metadata (used for enriching the table)
  const { data: categories = {} } = useMarketCategories();

  // Mutations
  const addMutation = useMutation({
    mutationFn: (vars: { symbol: string; qty: number; price: number }) =>
      api.addHolding(vars.symbol, vars.qty, vars.price, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Position added");
    },
    onError: (err: any) => toast.error(err.message || "Failed to add position"),
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => api.deleteHolding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Position removed");
    },
    onError: (err: any) => toast.error(err.message || "Failed to remove position"),
  });

  if (portfolioLoading) {
    return (
      <SiteChrome>
        <div className="flex-1 flex items-center justify-center p-8">
          <RefreshCcw className="animate-spin text-zinc-500" size={24} />
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome>
      <div className="flex-1 flex flex-col p-8 overflow-y-auto w-full max-w-6xl mx-auto gap-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-600 tracking-tight text-zinc-100">Portfolio Workspace</h1>
            <p className="text-[14px] text-zinc-500 mt-1">
              Track allocations, performance, and risk across multiple markets (Offline).
            </p>
          </div>

          <button onClick={() => setModalOpen(true)} className="btn-primary py-2 px-4 gap-2 whitespace-nowrap self-start sm:self-auto">
            <Plus size={16} />
            <span>Add Position</span>
          </button>
        </div>

        {/* Stats & Allocation */}
        <PortfolioStats holdings={holdings} quotes={quotes} />

        {/* AI Risk & Insights Panel */}
        <AIInsightsPanel holdings={holdings} />

        {/* Holdings List */}
        <div>
          <h2 className="text-lg font-600 text-zinc-100 mb-4">Current Holdings</h2>
          <HoldingsTable
            holdings={holdings}
            quotes={quotes}
            categories={categories}
            onDelete={(id) => delMutation.mutate(id)}
          />
        </div>

        <AddPositionModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onAdd={async (symbol, qty, price) => {
            await addMutation.mutateAsync({ symbol, qty, price });
          }}
        />
      </div>
    </SiteChrome>
  );
}
