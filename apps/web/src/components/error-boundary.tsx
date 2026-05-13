"use client";

/**
 * React class-based Error Boundary.
 * Wraps any component that may throw (e.g. lightweight-charts on bad data).
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Chart failed to load</p>}>
 *     <CandleChart ... />
 *   </ErrorBoundary>
 */

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? "unknown"}]`, error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 h-[240px] w-full rounded-[12px] border border-dashed border-zinc-800 bg-zinc-900/20 text-center px-6">
          <AlertTriangle size={24} className="text-amber-500/60" />
          <div>
            <p className="text-[13px] font-500 text-zinc-400">
              {this.props.label ?? "Component"} failed to render
            </p>
            {this.state.error && (
              <p className="text-[11px] text-zinc-600 mt-1 font-mono">
                {this.state.error.message.slice(0, 120)}
              </p>
            )}
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
          >
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
