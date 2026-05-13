"use client";

import { useState, useEffect } from "react";
import { Plus, X, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSymbolSearch } from "@/lib/queries";

interface AddPositionModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (symbol: string, quantity: number, avg_price: number) => Promise<void>;
}

export function AddPositionModal({ open, onClose, onAdd }: AddPositionModalProps) {
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  const { data: searchResults, isLoading: isSearching } = useSymbolSearch(debouncedQuery);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !qty || !price) return;
    setSubmitting(true);
    try {
      await onAdd(symbol.toUpperCase(), parseFloat(qty), parseFloat(price));
      onClose();
      setSymbol("");
      setQty("");
      setPrice("");
      setQuery("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="surface w-full max-w-md relative z-10 overflow-hidden shadow-2xl border border-zinc-800/80"
          >
            <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
              <h3 className="text-[15px] font-600 text-zinc-100">Add Position</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 flex flex-col gap-5">
              {/* Symbol Search/Input */}
              <div>
                <label className="block text-[13px] font-500 text-zinc-400 mb-1.5">Asset Symbol</label>
                <div className="relative">
                  <input
                    type="text"
                    value={symbol || query}
                    onChange={(e) => {
                      setSymbol("");
                      setQuery(e.target.value.toUpperCase());
                    }}
                    placeholder="Search e.g., AAPL, BTC, NIFTY50"
                    required
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-9 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                  <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
                </div>

                {/* Search Dropdown */}
                {!symbol && query.length >= 1 && (
                  <div className="absolute z-20 mt-1 w-[calc(100%-40px)] max-h-48 overflow-y-auto surface border border-zinc-800 rounded-lg shadow-xl">
                    {isSearching ? (
                      <div className="p-3 text-center text-zinc-500 text-[13px]">Searching...</div>
                    ) : searchResults && searchResults.length > 0 ? (
                      <ul className="py-1">
                        {searchResults.map((res) => (
                          <li
                            key={res.symbol}
                            onClick={() => {
                              setSymbol(res.symbol);
                              setQuery("");
                            }}
                            className="px-3 py-2 hover:bg-zinc-800/50 cursor-pointer flex justify-between items-center"
                          >
                            <span className="text-[13px] font-600 text-zinc-200">{res.symbol}</span>
                            <span className="text-[12px] text-zinc-500 truncate max-w-[150px]">{res.name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-3 text-center text-zinc-500 text-[13px]">No matches found offline.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-500 text-zinc-400 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5 text-[14px] text-zinc-100 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-500 text-zinc-400 mb-1.5">Avg Price</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5 text-[14px] text-zinc-100 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-ghost px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !symbol || !qty || !price} className="btn-primary px-4 py-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : "Add Asset"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
