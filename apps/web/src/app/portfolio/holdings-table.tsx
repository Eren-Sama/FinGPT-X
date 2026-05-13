"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface HoldingsTableProps {
  holdings: { id: number; symbol: string; quantity: number; avg_price: number; added_at: string }[];
  quotes: Record<string, { price: number }>;
  categories: Record<string, { symbol: string; name: string; currency: string; category: string }[]>;
  onDelete: (id: number) => void;
}

export function HoldingsTable({ holdings, quotes, categories, onDelete }: HoldingsTableProps) {
  // Build a fast lookup for metadata
  const metaMap = useMemo(() => {
    const map = new Map<string, { name: string; currency: string; category: string }>();
    Object.values(categories).forEach((list) => {
      list.forEach((item) => map.set(item.symbol, item));
    });
    return map;
  }, [categories]);

  const rows = useMemo(() => {
    return holdings.map((h) => {
      const meta = metaMap.get(h.symbol);
      const currentPrice = quotes[h.symbol]?.price || h.avg_price;
      const invested = h.quantity * h.avg_price;
      const currentValue = h.quantity * currentPrice;
      const pnl = currentValue - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

      return {
        ...h,
        currentPrice,
        currentValue,
        pnl,
        pnlPct,
        name: meta?.name || h.symbol,
        currency: meta?.currency || "USD",
        category: meta?.category || "Unknown",
      };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings, quotes, metaMap]);

  if (rows.length === 0) {
    return (
      <div className="surface p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
          <TrendingUp className="text-zinc-500" size={24} />
        </div>
        <h3 className="text-[15px] font-600 text-zinc-200 mb-1">No positions yet</h3>
        <p className="text-[13px] text-zinc-500 max-w-[250px]">
          Add your first asset to start tracking your offline portfolio performance.
        </p>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
              <th className="py-3 px-4 text-[12px] font-500 text-zinc-400">Asset</th>
              <th className="py-3 px-4 text-[12px] font-500 text-zinc-400 text-right">Price</th>
              <th className="py-3 px-4 text-[12px] font-500 text-zinc-400 text-right">Holdings</th>
              <th className="py-3 px-4 text-[12px] font-500 text-zinc-400 text-right">Total Value</th>
              <th className="py-3 px-4 text-[12px] font-500 text-zinc-400 text-right">Return</th>
              <th className="py-3 px-4 text-[12px] font-500 text-zinc-400 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-800/20 transition-colors group">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-zinc-800/80 flex items-center justify-center text-[12px] font-700 text-zinc-300 border border-zinc-700/50">
                      {row.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[14px] font-600 text-zinc-100 flex items-center gap-2">
                        {row.symbol}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-600 bg-zinc-800 text-zinc-400 uppercase tracking-wider">
                          {row.category}
                        </span>
                      </div>
                      <div className="text-[12px] text-zinc-500 truncate max-w-[150px] sm:max-w-[200px]">
                        {row.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-[14px] font-500 text-zinc-200">
                    {row.currency === "USD" ? "$" : row.currency === "INR" ? "₹" : ""}
                    {row.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[12px] text-zinc-500">
                    Avg: {row.currency === "USD" ? "$" : row.currency === "INR" ? "₹" : ""}
                    {row.avg_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-[14px] font-500 text-zinc-200">
                    {row.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[12px] text-zinc-500">
                    {format(new Date(row.added_at), "MMM d, yyyy")}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-[14px] font-600 text-zinc-100">
                    {row.currency === "USD" ? "$" : row.currency === "INR" ? "₹" : ""}
                    {row.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className={`text-[14px] font-600 flex items-center justify-end gap-1 ${row.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {row.pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {row.currency === "USD" ? "$" : row.currency === "INR" ? "₹" : ""}
                    {Math.abs(row.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[12px] font-500 mt-0.5 ${row.pnlPct >= 0 ? "text-emerald-500/80" : "text-red-500/80"}`}>
                    {row.pnlPct >= 0 ? "+" : ""}{row.pnlPct.toFixed(2)}%
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onDelete(row.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete Position"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
