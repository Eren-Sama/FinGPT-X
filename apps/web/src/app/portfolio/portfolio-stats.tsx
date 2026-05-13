"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface PortfolioStatsProps {
  holdings: { symbol: string; quantity: number; avg_price: number }[];
  quotes: Record<string, { price: number }>;
}

export function PortfolioStats({ holdings, quotes }: PortfolioStatsProps) {
  // Compute enriched portfolio data
  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalValue = 0;

    const items = holdings.map((h) => {
      const invested = h.quantity * h.avg_price;
      const currentPrice = quotes[h.symbol]?.price || h.avg_price;
      const currentValue = h.quantity * currentPrice;

      totalInvested += invested;
      totalValue += currentValue;

      return {
        symbol: h.symbol,
        invested,
        currentValue,
      };
    });

    const totalPnL = totalValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    // Allocation for Pie Chart
    const allocation = items
      .filter((i) => i.currentValue > 0)
      .sort((a, b) => b.currentValue - a.currentValue)
      .map((i) => ({
        name: i.symbol,
        value: i.currentValue,
      }));

    return { totalInvested, totalValue, totalPnL, totalPnLPct, allocation };
  }, [holdings, quotes]);

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Metrics Panel */}
      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Value */}
        <div className="surface p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign size={80} />
          </div>
          <div className="text-[13px] text-zinc-400 font-500 mb-1 z-10">Total Value</div>
          <div className="text-3xl font-700 text-zinc-100 z-10 tracking-tight">
            ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[13px] z-10">
            <span className="text-zinc-500">Invested:</span>
            <span className="text-zinc-300 font-500">
              ${stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Total Return */}
        <div className="surface p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-zinc-500">
            {stats.totalPnL >= 0 ? <TrendingUp size={80} /> : <TrendingDown size={80} />}
          </div>
          <div className="text-[13px] text-zinc-400 font-500 mb-1 z-10">Total Return</div>
          <div
            className={`text-3xl font-700 z-10 tracking-tight ${
              stats.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-4 flex items-center gap-1 z-10">
            <div
              className={`px-2 py-0.5 rounded-full text-[12px] font-600 flex items-center gap-1 ${
                stats.totalPnLPct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}
            >
              {stats.totalPnLPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(stats.totalPnLPct).toFixed(2)}%
            </div>
            <span className="text-zinc-500 text-[12px] ml-2">All time</span>
          </div>
        </div>
      </div>

      {/* Allocation Donut */}
      <div className="surface p-6 flex flex-col h-full">
        <div className="text-[14px] font-600 text-zinc-100 mb-4">Asset Allocation</div>
        {stats.allocation.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-500">
            No active positions
          </div>
        ) : (
          <div className="flex-1 relative min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.allocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.allocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Value"]}
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
                  itemStyle={{ color: "#e4e4e7" }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend inside Donut (Optional, but looks nice if top 1 is shown) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center flex-col">
              <span className="text-[11px] text-zinc-500 font-500 uppercase tracking-wider">Top Asset</span>
              <span className="text-[14px] text-zinc-200 font-700">{stats.allocation[0]?.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Performance Highlights */}
      {stats.allocation.length > 0 && (
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
          {/* Top Performer */}
          <div className="surface p-5 flex items-center justify-between border-l-4 border-l-emerald-500/50">
            <div>
              <div className="text-[12px] text-zinc-500 font-500 uppercase tracking-wider mb-1">Top Performer</div>
              <div className="text-[18px] font-700 text-zinc-100">{stats.allocation[0]?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-600 text-emerald-400">
                ${stats.allocation[0]?.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Worst Performer */}
          <div className="surface p-5 flex items-center justify-between border-l-4 border-l-red-500/50">
            <div>
              <div className="text-[12px] text-zinc-500 font-500 uppercase tracking-wider mb-1">Lowest Value</div>
              <div className="text-[18px] font-700 text-zinc-100">{stats.allocation[stats.allocation.length - 1]?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-600 text-red-400">
                ${stats.allocation[stats.allocation.length - 1]?.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
